import { requireSupabase } from '../lib/supabaseClient';
import { calculateReadiness } from './checkinService';

export async function loadWeeklyReview(userId, profile, days = 7) {
  const client = requireSupabase();
  const dates = getLastDates(days);
  const fromDate = dates[0];
  const fromIso = new Date(`${fromDate}T00:00:00`).toISOString();
  const kcalGoal = Number(profile?.kcal_goal ?? 2300);
  const waterGoal = Number(profile?.water_goal_ml ?? 3000);

  const [dailyRes, mealRes, workoutRes, setRes, runRes, weightRes, checkinRes] = await Promise.all([
    client.from('daily_logs').select('*').eq('user_id', userId).gte('log_date', fromDate),
    client.from('meal_entries').select('*').eq('user_id', userId).gte('log_date', fromDate),
    client.from('workout_sessions').select('*').eq('user_id', userId).gte('performed_at', fromIso).order('performed_at', { ascending: false }),
    client.from('workout_exercise_sets').select('*').eq('user_id', userId).gte('performed_at', fromIso),
    client.from('run_sessions').select('*').eq('user_id', userId).gte('performed_at', fromIso).order('performed_at', { ascending: false }),
    client.from('weight_logs').select('*').eq('user_id', userId).order('log_date', { ascending: false }).limit(8),
    client.from('daily_checkins').select('*').eq('user_id', userId).gte('log_date', fromDate),
  ]);

  [dailyRes, mealRes, workoutRes, setRes, runRes, weightRes, checkinRes].forEach((res) => {
    if (res.error) throw res.error;
  });

  const mealsByDate = groupSum(mealRes.data ?? [], 'log_date', 'kcal');
  const dailyByDate = new Map((dailyRes.data ?? []).map((row) => [row.log_date, row]));
  const checkinByDate = new Map((checkinRes.data ?? []).map((row) => [row.log_date, row]));

  const daysData = dates.map((date) => {
    const kcal = mealsByDate.get(date) ?? 0;
    const water = Number(dailyByDate.get(date)?.water_ml ?? 0);
    const checkin = checkinByDate.get(date);
    const readiness = calculateReadiness(checkin);
    return {
      date,
      kcal,
      water,
      kcalHit: kcal >= kcalGoal - 450 && kcal <= kcalGoal + 100,
      waterHit: water >= waterGoal,
      readiness,
      hasMeals: kcal > 0,
      hasCheckin: Boolean(checkin),
    };
  });

  const mealLoggedDays = daysData.filter((day) => day.hasMeals).length;
  const avgKcal = mealLoggedDays ? sum(daysData.map((day) => day.kcal)) / mealLoggedDays : 0;
  const kcalHitDays = daysData.filter((day) => day.kcalHit).length;
  const waterHitDays = daysData.filter((day) => day.waterHit).length;
  const checkinDays = daysData.filter((day) => day.hasCheckin).length;
  const avgReadiness = checkinDays ? sum(daysData.filter((day) => day.hasCheckin).map((day) => day.readiness.score)) / checkinDays : 0;
  const totalKm = sum((runRes.data ?? []).map((run) => Number(run.distance_km || 0)));
  const strengthVolume = sum((setRes.data ?? []).map((set) => Number(set.load_kg || 0) * Number(set.reps || 0)));
  const strengthSets = (setRes.data ?? []).length;
  const workouts = (workoutRes.data ?? []).filter((item) => item.completed).length;
  const runs = (runRes.data ?? []).length;
  const latestWeight = weightRes.data?.[0] ?? null;
  const oldestWeight = [...(weightRes.data ?? [])].sort((a, b) => a.log_date.localeCompare(b.log_date))[0] ?? null;
  const weightChange = latestWeight && oldestWeight ? Number(oldestWeight.weight_kg) - Number(latestWeight.weight_kg) : null;

  return {
    days,
    daysData,
    kcalGoal,
    waterGoal,
    avgKcal,
    kcalHitDays,
    waterHitDays,
    mealLoggedDays,
    checkinDays,
    avgReadiness,
    workouts,
    runs,
    totalKm,
    strengthVolume,
    strengthSets,
    latestWeight,
    weightChange,
    decision: buildDecision({ avgKcal, mealLoggedDays, kcalHitDays, waterHitDays, workouts, runs, checkinDays, avgReadiness, kcalGoal }),
  };
}

function buildDecision(stats) {
  if (stats.mealLoggedDays < 5) return { title: 'Prioridade: registrar comida', body: 'Sem registro alimentar, o app vira chute. Antes de reduzir kcal, registre 5 dias seguidos.' };
  if (stats.avgKcal > stats.kcalGoal + 180) return { title: 'Prioridade: cortar vazamento calórico', body: 'A média passou da meta. Olhe lanches, fim de semana, óleo, bebida e porções sem pesar.' };
  if (stats.workouts < 3) return { title: 'Prioridade: musculação', body: 'O mínimo estratégico é 3 treinos de força na semana. Corrida sem força aumenta risco de dor.' };
  if (stats.waterHitDays < 4) return { title: 'Prioridade: água', body: 'Bata 3 L em pelo menos 4 dias. Água baixa bagunça fome, treino e peso na balança.' };
  if (stats.checkinDays < 4) return { title: 'Prioridade: check-in', body: 'Registre sono, dor e fome. Isso evita insistir em corrida pesada em dia ruim.' };
  if (stats.avgReadiness && stats.avgReadiness < 60) return { title: 'Prioridade: recuperação', body: 'Seu corpo está avisando. Mantenha treino, mas reduza impacto e proteja sono.' };
  return { title: 'Prioridade: repetir', body: 'A semana está no caminho. Não inventa corte agressivo: repete o básico e progride devagar.' };
}

function getLastDates(days) {
  const today = new Date();
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(toDateKey(d));
  }
  return out;
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function groupSum(rows, key, valueKey) {
  const map = new Map();
  rows.forEach((row) => {
    map.set(row[key], (map.get(row[key]) ?? 0) + Number(row[valueKey] || 0));
  });
  return map;
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}
