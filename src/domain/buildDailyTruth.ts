import { requireSupabase } from '../lib/supabaseClient';
import { localDayRangeIso, normalizeDateKey } from '../utils/dates';
import { buildCardioTruth } from './cardioRules';
import { splitDailyCheckin } from './checkinRules';
import { buildDailyWarnings, scoreDailyQuality } from './dataQualityRules';
import type { DailyTruth, DailyTruthRaw, SourcedValue } from './dailyTypes';
import { buildNutritionTruth } from './nutritionRules';
import { buildSleepTruth } from './sleepRules';

export async function buildDailyTruth(userId: string, dateValue: string): Promise<DailyTruth> {
  if (!userId) throw new Error('Usuário ausente ao montar a verdade diária.');
  const date = normalizeDateKey(dateValue);
  if (!date) throw new Error('Data inválida ao montar a verdade diária.');
  const raw = await loadDailyTruthRaw(userId, date);
  return assembleDailyTruth(userId, date, raw);
}

export function assembleDailyTruth(userId: string, date: string, raw: DailyTruthRaw): DailyTruth {
  const nutrition = buildNutritionTruth(raw.meals);
  const sleepTruth = buildSleepTruth(raw.sleep, raw.wearableDaily);
  const cardioTruth = buildCardioTruth(raw.cardio);
  const wearableTruth = buildWearableTruth(raw.wearableDaily);
  const checkins = splitDailyCheckin(raw.checkin);
  const warnings = buildDailyWarnings(raw, nutrition, sleepTruth);
  const dataQualityScore = scoreDailyQuality(warnings);

  return {
    userId,
    date,
    ...raw,
    hydration: sourcedWater(raw.daily),
    nutrition,
    sleepTruth,
    cardioTruth,
    wearableTruth,
    checkinMorning: checkins.morning,
    checkinEvening: checkins.evening,
    warnings,
    data_quality_score: dataQualityScore,
    confidence: dataQualityScore >= 88 ? 'high' : dataQualityScore >= 65 ? 'medium' : 'low',
  };
}

async function loadDailyTruthRaw(userId: string, date: string): Promise<DailyTruthRaw> {
  const client = requireSupabase();
  const range = localDayRangeIso(date);
  if (!range) throw new Error('Não foi possível calcular a janela local do dia.');

  const results = await Promise.all([
    client.from('daily_logs').select('*').eq('user_id', userId).eq('log_date', date).maybeSingle(),
    client.from('meal_entries').select('*').eq('user_id', userId).eq('log_date', date).order('created_at'),
    client.from('sleep_sessions').select('*').eq('user_id', userId).eq('sleep_date', date).order('updated_at', { ascending: false }),
    client.from('cardio_sessions').select('*').eq('user_id', userId).gte('performed_at', range.startIso).lt('performed_at', range.endIso).order('performed_at'),
    client.from('workout_sessions').select('*').eq('user_id', userId).eq('completed', true).gte('performed_at', range.startIso).lt('performed_at', range.endIso),
    client.from('wearable_workout_sessions').select('*').eq('user_id', userId).gte('performed_at', range.startIso).lt('performed_at', range.endIso),
    client.from('wearable_daily_metrics').select('*').eq('user_id', userId).eq('metric_date', date).order('updated_at', { ascending: false }),
    client.from('daily_checkins').select('*').eq('user_id', userId).eq('log_date', date).maybeSingle(),
    client.from('weight_logs').select('*').eq('user_id', userId).lte('log_date', date).order('log_date', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const error = results.find((result) => result.error)?.error;
  if (error) throw error;
  return {
    daily: results[0].data ?? null,
    meals: results[1].data ?? [],
    sleep: results[2].data ?? [],
    cardio: results[3].data ?? [],
    strengthApp: results[4].data ?? [],
    strengthWearable: results[5].data ?? [],
    wearableDaily: results[6].data ?? [],
    checkin: results[7].data ?? null,
    weight: results[8].data ?? null,
  };
}

function sourcedWater(daily: any): SourcedValue<number> {
  const value = daily?.water_ml === null || daily?.water_ml === undefined ? null : Number(daily.water_ml);
  return {
    value: Number.isFinite(value) ? value : null,
    state: daily ? 'present' : 'missing',
    origin: daily ? 'manual' : 'unknown',
    source: daily ? 'Atleta Híbrido' : null,
    confidence: daily ? 'high' : 'low',
    includedInDailyTotals: true,
  };
}

function buildWearableTruth(rows: any[]) {
  const fields = ['steps', 'sleep_minutes', 'active_kcal', 'workout_minutes', 'distance_km', 'avg_heart_rate', 'resting_heart_rate'];
  const ranked = [...rows].sort((a, b) => sourceRank(b.source) - sourceRank(a.source));
  return Object.fromEntries(fields.map((field) => {
    const selected = ranked.find((row) => finiteOrNull(row[field]) !== null);
    return [field, {
      value: finiteOrNull(selected?.[field]),
      state: selected ? 'estimated' : 'missing',
      origin: selected ? 'wearable' : 'unknown',
      source: selected?.source ?? selected?.provider ?? null,
      confidence: selected ? 'medium' : 'low',
      includedInDailyTotals: Boolean(selected),
    } satisfies SourcedValue<number>];
  }));
}

function sourceRank(source: unknown) {
  const value = String(source ?? '').toLowerCase();
  if (value.includes('health_connect') || value.includes('bridge')) return 40;
  if (value.includes('mi_fitness')) return 30;
  if (value.includes('manual')) return 20;
  return 10;
}

function finiteOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
