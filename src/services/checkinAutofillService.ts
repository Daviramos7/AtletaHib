import { requireSupabase } from '../lib/supabaseClient';
import { getWearableMetricForDate } from './wearableService';

export async function loadCheckinAutofill(userId, logDate) {
  const client = requireSupabase();
  const { startIso, endIso } = dateRangeIso(logDate);

  const [daily, meals, sleep, wearable, workouts, cardio] = await Promise.all([
    safeMaybeSingle(() => client.from('daily_logs').select('*').eq('user_id', userId).eq('log_date', logDate).maybeSingle()),
    safeList(() => client.from('meal_entries').select('*').eq('user_id', userId).eq('log_date', logDate)),
    safeList(() => client.from('sleep_sessions').select('*').eq('user_id', userId).eq('sleep_date', logDate).order('sleep_date', { ascending: false }).limit(1)),
    getWearableMetricForDate(userId, logDate).catch(() => null),
    safeList(() => client.from('workout_sessions').select('*').eq('user_id', userId).eq('completed', true).gte('performed_at', startIso).lt('performed_at', endIso)),
    safeList(() => client.from('cardio_sessions').select('*').eq('user_id', userId).gte('performed_at', startIso).lt('performed_at', endIso)),
  ]);

  const correctedSleep = sleep?.[0] ?? null;
  const sleepMinutes = integerOrNull(correctedSleep?.duration_minutes ?? wearable?.sleep_minutes);
  const sleepHours = sleepMinutes ? Number((sleepMinutes / 60).toFixed(2)) : null;
  const steps = integerOrNull(wearable?.steps);
  const waterMl = Number(daily?.water_ml ?? 0);
  const kcal = sum(meals, 'kcal');
  const protein = sum(meals, 'protein_g');
  const carbs = sum(meals, 'carbs_g');
  const fat = sum(meals, 'fat_g');
  const activeKcal = numberOrNull(wearable?.active_kcal);

  return {
    log_date: logDate,
    sleep_hours: sleepHours,
    sleep_minutes: sleepMinutes || null,
    sleep_source: correctedSleep ? 'Sono importado corrigido' : wearable?.sleep_minutes ? sourceLabel(wearable) : null,
    steps,
    steps_source: steps ? sourceLabel(wearable) : null,
    water_ml: waterMl,
    meals_count: meals.length,
    kcal,
    protein_g: Number(protein.toFixed(1)),
    carbs_g: Number(carbs.toFixed(1)),
    fat_g: Number(fat.toFixed(1)),
    workout_count: workouts.length,
    cardio_count: cardio.length,
    active_kcal: activeKcal,
    wearable_source: wearable ? sourceLabel(wearable) : null,
    has_data: Boolean(sleepHours || steps || waterMl || meals.length || workouts.length || cardio.length || activeKcal),
  };
}

async function safeList(buildQuery) {
  try {
    const { data, error } = await buildQuery();
    if (error) throw error;
    return data ?? [];
  } catch {
    return [];
  }
}

async function safeMaybeSingle(buildQuery) {
  try {
    const { data, error } = await buildQuery();
    if (error) throw error;
    return data ?? null;
  } catch {
    return null;
  }
}

function dateRangeIso(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function sourceLabel(row) {
  return [row?.provider, row?.source].filter(Boolean).join(' · ') || row?.source_app || 'Health Connect';
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function integerOrNull(value) {
  const number = numberOrNull(value);
  return number === null ? null : Math.round(number);
}

function sum(rows, field) {
  return (rows ?? []).reduce((total, row) => total + Number(row?.[field] ?? 0), 0);
}
