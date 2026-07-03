import { requireSupabase } from '../lib/supabaseClient';
import { calculateReadiness } from './checkinService';

const DEFAULT_TARGETS = {
  minMealLoggedDays7: 5,
  minWaterHitDays7: 4,
  minStrengthSessions7: 3,
  minCardioSessions7: 2,
  idealCardioSessions7: 3,
  minCheckinDays7: 4,
  minAvgSleepHours: 6.0,
  goodAvgSleepHours: 7.0,
  minAvgSteps: 5000,
};

export async function loadWeeklyReview(userId, profile, days = 7) {
  const client = requireSupabase();
  const dates = getLastDates(days);
  const fromDate = dates[0];
  const fromIso = new Date(`${fromDate}T00:00:00`).toISOString();
  const kcalGoal = Number(profile?.kcal_goal ?? 2300);
  const waterGoal = Number(profile?.water_goal_ml ?? 3000);

  const [dailyRes, mealRes, workoutRes, setRes, runRes, cardioRes, sleepRes, wearableRes, weightRes, checkinRes] = await Promise.all([
    client.from('daily_logs').select('*').eq('user_id', userId).gte('log_date', fromDate),
    client.from('meal_entries').select('*').eq('user_id', userId).gte('log_date', fromDate),
    client.from('workout_sessions').select('*').eq('user_id', userId).gte('performed_at', fromIso).order('performed_at', { ascending: false }),
    client.from('workout_exercise_sets').select('*').eq('user_id', userId).gte('performed_at', fromIso),
    client.from('run_sessions').select('*').eq('user_id', userId).gte('performed_at', fromIso).order('performed_at', { ascending: false }),
    client.from('cardio_sessions').select('*').eq('user_id', userId).gte('performed_at', fromIso).order('performed_at', { ascending: false }),
    client.from('sleep_sessions').select('*').eq('user_id', userId).gte('sleep_date', fromDate).order('sleep_date', { ascending: false }),
    client.from('wearable_daily_metrics').select('*').eq('user_id', userId).gte('metric_date', fromDate).order('metric_date', { ascending: false }),
    client.from('weight_logs').select('*').eq('user_id', userId).order('log_date', { ascending: false }).limit(8),
    client.from('daily_checkins').select('*').eq('user_id', userId).gte('log_date', fromDate),
  ]);

  [dailyRes, mealRes, workoutRes, setRes, runRes, cardioRes, sleepRes, wearableRes, weightRes, checkinRes].forEach((res) => {
    if (res.error) throw res.error;
  });

  const mealsByDate = groupSum(mealRes.data ?? [], 'log_date', 'kcal');
  const dailyByDate = new Map((dailyRes.data ?? []).map((row) => [row.log_date, row]));
  const checkinByDate = new Map((checkinRes.data ?? []).map((row) => [row.log_date, row]));
  const wearableByDate = new Map((wearableRes.data ?? []).map((row) => [row.metric_date, row]));
  const correctedSleepByDate = new Map((sleepRes.data ?? []).map((row) => [row.sleep_date, row]));

  const daysData = dates.map((date) => {
    const kcal = mealsByDate.get(date) ?? 0;
    const water = Number(dailyByDate.get(date)?.water_ml ?? 0);
    const checkin = checkinByDate.get(date);
    const wearable = wearableByDate.get(date);
    const correctedSleep = correctedSleepByDate.get(date);
    const readiness = calculateReadiness(checkin);
    const sleepMinutes = correctedSleep?.duration_minutes ?? wearable?.sleep_minutes ?? 0;
    const sleepHours = sleepMinutes ? Number(sleepMinutes) / 60 : 0;
    const steps = Number(wearable?.steps ?? 0);
    return {
      date,
      kcal,
      water,
      sleepHours,
      sleepMinutes: Number(sleepMinutes || 0),
      sleepSource: correctedSleep ? 'sleep_screenshot_corrected' : wearable?.sleep_minutes ? formatSource(wearable.source, wearable.provider) : null,
      correctedSleep: correctedSleep ?? null,
      steps,
      activeKcal: Number(wearable?.active_kcal ?? 0),
      avgHeartRate: Number(correctedSleep?.avg_heart_rate ?? wearable?.avg_heart_rate ?? 0),
      restingHeartRate: Number(wearable?.resting_heart_rate ?? 0),
      avgSpo2: Number(correctedSleep?.avg_spo2 ?? 0),
      breathingScore: Number(correctedSleep?.breathing_score ?? 0),
      kcalHit: kcal >= kcalGoal - 450 && kcal <= kcalGoal + 100,
      waterHit: water >= waterGoal,
      readiness,
      hasMeals: kcal > 0,
      hasCheckin: Boolean(checkin),
      hasWearable: Boolean(wearable),
      hasCorrectedSleep: Boolean(correctedSleep),
    };
  });

  const mealLoggedDays = daysData.filter((day) => day.hasMeals).length;
  const avgKcal = mealLoggedDays ? sum(daysData.map((day) => day.kcal)) / mealLoggedDays : 0;
  const kcalHitDays = daysData.filter((day) => day.kcalHit).length;
  const waterHitDays = daysData.filter((day) => day.waterHit).length;
  const checkinDays = daysData.filter((day) => day.hasCheckin).length;
  const avgReadiness = checkinDays ? sum(daysData.filter((day) => day.hasCheckin).map((day) => day.readiness.score)) / checkinDays : 0;

  const wearableDays = daysData.filter((day) => day.hasWearable).length;
  const sleepDays = daysData.filter((day) => day.sleepHours > 0).length;
  const correctedSleepDays = daysData.filter((day) => day.hasCorrectedSleep).length;
  const avgSleepHours = sleepDays ? sum(daysData.map((day) => day.sleepHours)) / sleepDays : 0;
  const stepDays = daysData.filter((day) => day.steps > 0).length;
  const avgSteps = stepDays ? sum(daysData.map((day) => day.steps)) / stepDays : 0;
  const avgActiveKcal = wearableDays ? sum(daysData.map((day) => day.activeKcal)) / wearableDays : 0;

  const totalKm = sum([
    ...(runRes.data ?? []).map((run) => Number(run.distance_km || 0)),
    ...(cardioRes.data ?? []).map((session) => Number(session.distance_km || 0)),
  ]);
  const strengthVolume = sum((setRes.data ?? []).map((set) => Number(set.load_kg || 0) * Number(set.reps || 0)));
  const strengthSets = (setRes.data ?? []).length;
  const workouts = (workoutRes.data ?? []).filter((item) => item.completed).length;
  const cardioSessions = (runRes.data ?? []).length + (cardioRes.data ?? []).length;
  const latestWeight = weightRes.data?.[0] ?? null;
  const oldestWeight = [...(weightRes.data ?? [])].sort((a, b) => a.log_date.localeCompare(b.log_date))[0] ?? null;
  const weightChange = latestWeight && oldestWeight ? Number(oldestWeight.weight_kg) - Number(latestWeight.weight_kg) : null;

  const stats = {
    days,
    kcalGoal,
    waterGoal,
    avgKcal,
    kcalHitDays,
    waterHitDays,
    mealLoggedDays,
    checkinDays,
    avgReadiness,
    workouts,
    cardioSessions,
    totalKm,
    strengthVolume,
    strengthSets,
    latestWeight,
    weightChange,
    wearableDays,
    sleepDays,
    correctedSleepDays,
    avgSleepHours,
    stepDays,
    avgSteps,
    avgActiveKcal,
  };

  const decision = buildDecision(stats);
  const ruleReport = buildRuleReport(stats);
  const exportPayload = buildWeeklyReportExport({
    profile,
    stats,
    daysData,
    decision,
    ruleReport,
    daily: dailyRes.data ?? [],
    meals: mealRes.data ?? [],
    strengthSessions: workoutRes.data ?? [],
    strengthSets: setRes.data ?? [],
    runSessions: runRes.data ?? [],
    cardioSessions: cardioRes.data ?? [],
    sleepSessions: sleepRes.data ?? [],
    wearableMetrics: wearableRes.data ?? [],
    weightLogs: weightRes.data ?? [],
    checkins: checkinRes.data ?? [],
    fromDate,
    toDate: dates[dates.length - 1],
  });

  return {
    ...stats,
    runs: cardioSessions,
    daysData,
    decision,
    ruleReport,
    exportPayload,
  };
}

function buildDecision(stats) {
  if (stats.mealLoggedDays < scaledTarget(DEFAULT_TARGETS.minMealLoggedDays7, stats.days)) return { title: 'Prioridade: registrar comida', body: 'Sem registro alimentar, o app vira chute. Antes de reduzir kcal, registre a maioria dos dias da semana.' };
  if (stats.avgKcal > stats.kcalGoal + 180) return { title: 'Prioridade: cortar vazamento calórico', body: 'A média passou da meta. Olhe lanches, fim de semana, óleo, bebida e porções sem pesar.' };
  if (stats.workouts < scaledTarget(DEFAULT_TARGETS.minStrengthSessions7, stats.days)) return { title: 'Prioridade: musculação', body: 'O mínimo estratégico é manter força com consistência. Corrida sem força aumenta risco de dor.' };
  if (stats.waterHitDays < scaledTarget(DEFAULT_TARGETS.minWaterHitDays7, stats.days)) return { title: 'Prioridade: água', body: 'Bata a meta de água na maioria dos dias. Água baixa bagunça fome, treino e peso na balança.' };
  if (stats.checkinDays < scaledTarget(DEFAULT_TARGETS.minCheckinDays7, stats.days)) return { title: 'Prioridade: check-in', body: 'Registre sono, dor e fome. Isso evita insistir em corrida pesada em dia ruim.' };
  if (stats.avgReadiness && stats.avgReadiness < 60) return { title: 'Prioridade: recuperação', body: 'Seu corpo está avisando. Mantenha treino, mas reduza impacto e proteja sono.' };
  return { title: 'Prioridade: repetir', body: 'A semana está no caminho. Não inventa corte agressivo: repete o básico e progride devagar.' };
}

function buildRuleReport(stats) {
  const targets = {
    meal: scaledTarget(DEFAULT_TARGETS.minMealLoggedDays7, stats.days),
    water: scaledTarget(DEFAULT_TARGETS.minWaterHitDays7, stats.days),
    strength: scaledTarget(DEFAULT_TARGETS.minStrengthSessions7, stats.days),
    cardio: scaledTarget(DEFAULT_TARGETS.minCardioSessions7, stats.days),
    cardioIdeal: scaledTarget(DEFAULT_TARGETS.idealCardioSessions7, stats.days),
    checkin: scaledTarget(DEFAULT_TARGETS.minCheckinDays7, stats.days),
  };

  const ruleScores = [
    scoreRule('Dieta registrada', stats.mealLoggedDays, targets.meal, 18),
    scoreRule('Água', stats.waterHitDays, targets.water, 14),
    scoreRule('Musculação', stats.workouts, targets.strength, 18),
    scoreRule('Cardio', stats.cardioSessions, targets.cardioIdeal, 14),
    scoreRule('Check-in', stats.checkinDays, targets.checkin, 12),
    scoreSleep(stats.avgSleepHours, 12),
    scoreSteps(stats.avgSteps, 8),
    scoreWeight(stats.weightChange, 4),
  ];

  const score = Math.round(ruleScores.reduce((total, item) => total + item.points, 0));
  const strengths = [];
  const improvements = [];
  const nextWeekFocus = [];

  if (stats.workouts >= targets.strength) {
    strengths.push({ title: 'Força consistente', body: `Você concluiu ${stats.workouts} treino(s). Isso protege articulações e melhora performance no futebol.` });
  } else {
    improvements.push({ title: 'Musculação abaixo do alvo', body: `Foram ${stats.workouts} treino(s). Meta mínima da janela: ${targets.strength}.` });
    nextWeekFocus.push('Agendar os treinos de força primeiro. Cardio entra depois, não no lugar da musculação.');
  }

  if (stats.cardioSessions >= targets.cardio) {
    strengths.push({ title: 'Cardio apareceu na semana', body: `${stats.cardioSessions} sessão(ões), ${stats.totalKm.toFixed(2)} km registrados. Bom sinal para a meta do 1 km.` });
  } else {
    improvements.push({ title: 'Cardio ainda baixo', body: `Foram ${stats.cardioSessions} sessão(ões). Para evoluir corrida, mire ${targets.cardio} a ${targets.cardioIdeal} cardios curtos.` });
    nextWeekFocus.push('Fazer 2 a 3 cardios curtos de 20 minutos, sem transformar todo cardio em teste máximo.');
  }

  if (stats.mealLoggedDays >= targets.meal) {
    strengths.push({ title: 'Registro alimentar útil', body: `${stats.mealLoggedDays}/${stats.days} dias com comida registrada. Agora dá para analisar sem achismo.` });
  } else {
    improvements.push({ title: 'Dados de dieta insuficientes', body: `${stats.mealLoggedDays}/${stats.days} dias registrados. Sem isso, a análise de emagrecimento fica fraca.` });
    nextWeekFocus.push('Registrar pelo menos café, almoço, jantar e beliscos. Não precisa ficar perfeito; precisa ser honesto.');
  }

  if (stats.waterHitDays >= targets.water) {
    strengths.push({ title: 'Hidratação encaminhada', body: `${stats.waterHitDays}/${stats.days} dias batendo água. Isso ajuda treino, fome e recuperação.` });
  } else {
    improvements.push({ title: 'Água irregular', body: `${stats.waterHitDays}/${stats.days} dias batendo meta. Água baixa pode parecer fome e piorar treino.` });
    nextWeekFocus.push('Começar o dia com garrafa separada e bater pelo menos metade da meta até o almoço.');
  }

  if (stats.avgSleepHours >= DEFAULT_TARGETS.goodAvgSleepHours) {
    strengths.push({ title: 'Sono forte', body: `Média de ${stats.avgSleepHours.toFixed(1)}h nos dias registrados. Boa base para treinar cedo.` });
  } else if (stats.avgSleepHours > 0 && stats.avgSleepHours < DEFAULT_TARGETS.minAvgSleepHours) {
    improvements.push({ title: 'Sono limitando evolução', body: `Média de ${stats.avgSleepHours.toFixed(1)}h. Treinar cedo só funciona se dormir mais cedo.` });
    nextWeekFocus.push('Nos dias de treino cedo, mirar cama entre 21:30 e 22:00.');
  } else if (!stats.avgSleepHours) {
    improvements.push({ title: 'Sono sem leitura confiável', body: 'Não há sono suficiente registrado para análise. Sincronize o Bridge ou confira o Health Connect.' });
  }

  if (stats.checkinDays < targets.checkin) {
    improvements.push({ title: 'Check-in baixo', body: `${stats.checkinDays}/${stats.days} dias. Sem energia, fome, dor e estresse, o app não sabe se você está recuperando.` });
    nextWeekFocus.push('Fazer check-in em menos de 1 minuto antes ou depois do treino.');
  } else {
    strengths.push({ title: 'Check-ins suficientes', body: `${stats.checkinDays}/${stats.days} dias registrados. Isso melhora a leitura de recuperação.` });
  }

  if (stats.avgSteps >= DEFAULT_TARGETS.minAvgSteps) {
    strengths.push({ title: 'Movimento diário razoável', body: `Média de ${Math.round(stats.avgSteps)} passos nos dias com registro.` });
  } else if (stats.avgSteps > 0) {
    improvements.push({ title: 'Passos baixos', body: `Média de ${Math.round(stats.avgSteps)} passos. Um pouco mais de caminhada ajuda sem exigir treino pesado.` });
  }

  if (stats.weightChange !== null) {
    if (stats.weightChange > 0) {
      strengths.push({ title: 'Peso em queda', body: `Variação aproximada de -${Math.abs(stats.weightChange).toFixed(1)} kg na janela. Continue olhando tendência, não um dia isolado.` });
    } else if (stats.weightChange < -0.8) {
      improvements.push({ title: 'Peso subiu na janela', body: `Variação aproximada de +${Math.abs(stats.weightChange).toFixed(1)} kg. Pode ser retenção, mas confira dieta, sal e fim de semana.` });
    }
  }

  while (nextWeekFocus.length < 3) {
    const fallback = [
      'Manter 4 treinos de força ou o máximo possível sem sacrificar sono.',
      'Fazer cardio curto e controlado: constância vence sofrimento.',
      'Registrar refeições e água todos os dias úteis.',
    ][nextWeekFocus.length];
    nextWeekFocus.push(fallback);
  }

  return {
    score,
    label: score >= 85 ? 'Semana forte' : score >= 70 ? 'Semana boa' : score >= 55 ? 'Semana instável' : 'Semana fraca',
    tone: score >= 70 ? 'good' : score >= 55 ? 'warning' : 'danger',
    summary: buildSummary(score, stats),
    strengths: strengths.slice(0, 4),
    improvements: improvements.slice(0, 4),
    nextWeekFocus: nextWeekFocus.slice(0, 3),
    rules: ruleScores.map((item) => ({
      label: item.label,
      points: Math.round(item.points),
      max: item.max,
      status: item.points >= item.max * 0.8 ? 'ok' : item.points >= item.max * 0.45 ? 'medium' : 'bad',
    })),
  };
}

function buildSummary(score, stats) {
  if (score >= 85) return 'Você fechou uma semana muito consistente. O próximo passo é repetir sem aumentar tudo de uma vez.';
  if (score >= 70) return 'A base está boa. Ajuste um ou dois pontos, principalmente o que ficou abaixo da meta.';
  if (score >= 55) return 'A semana teve coisas boas, mas ainda está irregular. Foque em previsibilidade antes de intensidade.';
  if (stats.mealLoggedDays < 3) return 'O app ainda tem poucos dados confiáveis. A prioridade é registrar a rotina, não buscar conclusão perfeita.';
  return 'A semana ficou abaixo do necessário. Recomece pelo básico: força, comida registrada, água e sono.';
}

function scoreRule(label, value, target, max) {
  const ratio = target <= 0 ? 1 : Math.min(Number(value || 0) / target, 1);
  return { label, points: ratio * max, max };
}

function scoreSleep(avgSleepHours, max) {
  if (!avgSleepHours) return { label: 'Sono', points: 0, max };
  if (avgSleepHours >= DEFAULT_TARGETS.goodAvgSleepHours) return { label: 'Sono', points: max, max };
  if (avgSleepHours >= DEFAULT_TARGETS.minAvgSleepHours) return { label: 'Sono', points: max * 0.7, max };
  return { label: 'Sono', points: max * 0.35, max };
}

function scoreSteps(avgSteps, max) {
  if (!avgSteps) return { label: 'Passos', points: 0, max };
  return { label: 'Passos', points: Math.min(avgSteps / DEFAULT_TARGETS.minAvgSteps, 1) * max, max };
}

function scoreWeight(weightChange, max) {
  if (weightChange === null || weightChange === undefined) return { label: 'Peso', points: max * 0.4, max };
  if (weightChange > 0) return { label: 'Peso', points: max, max };
  if (weightChange > -0.7) return { label: 'Peso', points: max * 0.65, max };
  return { label: 'Peso', points: max * 0.25, max };
}

function scaledTarget(weeklyTarget, days) {
  return Math.max(1, Math.round((weeklyTarget / 7) * days));
}


function buildWeeklyReportExport({
  profile,
  stats,
  daysData,
  decision,
  ruleReport,
  daily,
  meals,
  strengthSessions,
  strengthSets,
  runSessions,
  cardioSessions,
  sleepSessions,
  wearableMetrics,
  weightLogs,
  checkins,
  fromDate,
  toDate,
}) {
  return {
    type: 'weekly_report_export',
    generated_at: new Date().toISOString(),
    period: {
      start_date: fromDate,
      end_date: toDate,
      days: stats.days,
    },
    user_goal: {
      main_goal: profile?.objective ?? 'emagrecimento e condicionamento',
      kcal_goal: stats.kcalGoal,
      water_goal_ml: stats.waterGoal,
      strength_goal_weekly: profile?.weekly_strength_days ?? 4,
      cardio_goal_weekly: profile?.weekly_cardio_days ?? 3,
      target_weight_kg: profile?.target_weight_kg ?? null,
      current_weight_kg: profile?.current_weight_kg ?? null,
    },
    summary: {
      meal_logged_days: stats.mealLoggedDays,
      avg_kcal_logged_days: Math.round(stats.avgKcal || 0),
      kcal_hit_days: stats.kcalHitDays,
      water_goal_days_hit: stats.waterHitDays,
      strength_sessions: stats.workouts,
      strength_sets: stats.strengthSets,
      strength_volume_kg: Math.round(stats.strengthVolume || 0),
      cardio_sessions: stats.cardioSessions,
      total_cardio_km: Number(stats.totalKm.toFixed(2)),
      sleep_days: stats.sleepDays,
      corrected_sleep_days: stats.correctedSleepDays,
      avg_sleep_hours: Number((stats.avgSleepHours || 0).toFixed(2)),
      avg_steps: Math.round(stats.avgSteps || 0),
      avg_active_kcal: Math.round(stats.avgActiveKcal || 0),
      checkin_days: stats.checkinDays,
      avg_readiness: Math.round(stats.avgReadiness || 0),
      latest_weight_kg: stats.latestWeight?.weight_kg ?? null,
      weight_change_kg: stats.weightChange === null ? null : Number(stats.weightChange.toFixed(2)),
    },
    daily: daysData,
    raw_tables: {
      daily_logs: daily,
      meal_entries: meals,
      strength_sessions: strengthSessions,
      strength_sets: strengthSets,
      run_sessions: runSessions,
      cardio_sessions: cardioSessions,
      sleep_sessions: sleepSessions,
      wearable_daily_metrics: wearableMetrics,
      weight_logs: weightLogs,
      daily_checkins: checkins,
    },
    rules_report: ruleReport,
    decision,
    interpretation_prompt_hint: 'Envie este JSON para o chat Analista Semanal do projeto Atleta Híbrido.',
  };
}

function formatSource(source, provider) {
  const raw = String(source || provider || '').toLowerCase();
  if (raw.includes('health_connect') || raw.includes('bridge')) return 'Health Connect';
  if (raw.includes('sleep_screenshot') || raw.includes('screenshot')) return 'Sono corrigido por print';
  if (raw.includes('mi_fitness') || raw.includes('redmi')) return 'Mi Fitness';
  if (raw.includes('manual')) return 'manual';
  return source || provider || 'wearable';
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
