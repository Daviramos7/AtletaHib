import { requireSupabase } from '../lib/supabaseClient';
import { todayKey } from './dailyService';

export type SyncMode = 'manual' | 'health_connect' | 'strava' | 'xiaomi_export' | 'apple_health' | 'other';

export type HealthIntegration = {
  id?: string;
  user_id: string;
  provider: string;
  device_name: string;
  source_app: string;
  sync_mode: SyncMode | string;
  status: 'planned' | 'configured' | 'connected' | 'paused' | 'error' | string;
  permissions_text?: string;
  notes?: string;
  last_sync_at?: string | null;
};

export type WearableDailyMetric = {
  id?: string;
  user_id: string;
  metric_date: string;
  provider: string;
  source: string;
  steps?: number | string | null;
  sleep_minutes?: number | string | null;
  avg_heart_rate?: number | string | null;
  resting_heart_rate?: number | string | null;
  active_kcal?: number | string | null;
  workout_minutes?: number | string | null;
  distance_km?: number | string | null;
  readiness_hint?: string | null;
  notes?: string | null;
  raw_payload?: Record<string, unknown> | null;
};

export async function listHealthIntegrations(userId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('health_integrations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function upsertHealthIntegration(userId: string, payload: Partial<HealthIntegration>) {
  const supabase = requireSupabase();
  const record = {
    user_id: userId,
    provider: payload.provider ?? 'manual',
    device_name: payload.device_name ?? '',
    source_app: payload.source_app ?? '',
    sync_mode: payload.sync_mode ?? 'manual',
    status: payload.status ?? 'planned',
    permissions_text: payload.permissions_text ?? '',
    notes: payload.notes ?? '',
    last_sync_at: payload.last_sync_at ?? null,
  };

  const { data, error } = await supabase
    .from('health_integrations')
    .upsert(record, { onConflict: 'user_id,provider,sync_mode' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function configureRedmiMiFitness(userId: string) {
  return upsertHealthIntegration(userId, {
    provider: 'redmi_mi_fitness',
    device_name: 'Redmi Watch 5 Active',
    source_app: 'Mi Fitness',
    sync_mode: 'health_connect',
    status: 'configured',
    permissions_text: 'passos, sono, frequência cardíaca, treino, distância, calorias ativas',
    notes: 'Fluxo recomendado: Redmi Watch 5 Active → Mi Fitness → Health Connect → aplicativo Android Atleta Hib → Supabase. Registro manual e importação continuam disponíveis como alternativas.',
  });
}

export async function listWearableMetrics(userId: string, limit = 14) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('wearable_daily_metrics')
    .select('*')
    .eq('user_id', userId)
    .order('metric_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getTodayWearableMetric(userId: string) {
  return getWearableMetricForDate(userId, todayKey());
}

export async function getWearableMetricForDate(userId: string, metricDate: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('wearable_daily_metrics')
    .select('*')
    .eq('user_id', userId)
    .eq('metric_date', metricDate)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return mergeWearableDailyMetrics(data ?? [], metricDate);
}

export async function upsertWearableMetric(userId: string, payload: Partial<WearableDailyMetric>) {
  const supabase = requireSupabase();
  const source = payload.source || payload.provider || 'manual';
  const record = {
    user_id: userId,
    metric_date: payload.metric_date || todayKey(),
    provider: payload.provider || 'manual',
    source,
    steps: numberOrNull(payload.steps),
    sleep_minutes: numberOrNull(payload.sleep_minutes),
    avg_heart_rate: numberOrNull(payload.avg_heart_rate),
    resting_heart_rate: numberOrNull(payload.resting_heart_rate),
    active_kcal: numberOrNull(payload.active_kcal),
    workout_minutes: numberOrNull(payload.workout_minutes),
    distance_km: numberOrNull(payload.distance_km),
    readiness_hint: payload.readiness_hint || buildReadinessHint(payload),
    notes: payload.notes || null,
    raw_payload: payload.raw_payload || null,
  };

  const { data, error } = await supabase
    .from('wearable_daily_metrics')
    .upsert(record, { onConflict: 'user_id,metric_date,source' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteWearableMetric(userId: string, id: string) {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('wearable_daily_metrics')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw error;
}

export function buildReadinessHint(metric: Partial<WearableDailyMetric>) {
  const sleepHours = Number(metric.sleep_minutes || 0) / 60;
  const restingHr = Number(metric.resting_heart_rate || 0);
  const workoutMinutes = Number(metric.workout_minutes || 0);

  if (sleepHours && sleepHours < 5.5) return 'Sono baixo: prefira treino controlado ou recuperação.';
  if (restingHr && restingHr >= 85) return 'FC de repouso alta: aqueça bem e reduza intensidade se necessário.';
  if (workoutMinutes >= 60) return 'Dia ativo: cuidado para não empilhar cardio pesado.';
  if (Number(metric.steps || 0) >= 9000) return 'Boa atividade diária: mantenha hidratação e recuperação.';
  return 'Sem alerta crítico. Use junto do check-in subjetivo.';
}

function numberOrNull(value: unknown) {
  if (value === '' || value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}


function mergeWearableDailyMetrics(rows: WearableDailyMetric[], metricDate: string) {
  if (!rows.length) return null;
  const ranked = [...rows].sort((a, b) => sourceRank(b.source) - sourceRank(a.source));
  const base = ranked[0] as any;
  const merged: any = { ...base, metric_date: metricDate };

  for (const field of ['steps', 'sleep_minutes', 'active_kcal', 'workout_minutes', 'distance_km'] as Array<keyof WearableDailyMetric>) {
    merged[field] = bestNumericValue(ranked, field, 'max');
  }
  for (const field of ['avg_heart_rate', 'resting_heart_rate'] as Array<keyof WearableDailyMetric>) {
    merged[field] = bestNumericValue(ranked, field, 'first');
  }

  merged.source = rows.length > 1 ? 'merged_sources' : base.source;
  merged.sources = rows.map((row) => row.source).filter(Boolean);
  merged.notes = rows.length > 1
    ? `Métricas consolidadas de ${rows.length} fontes: ${merged.sources.join(', ')}.`
    : base.notes;
  return merged;
}

function sourceRank(source: unknown) {
  const value = String(source ?? '').toLowerCase();
  if (value.includes('health_connect')) return 40;
  if (value.includes('mi_fitness')) return 30;
  if (value.includes('manual')) return 20;
  return 10;
}

function bestNumericValue(rows: WearableDailyMetric[], field: keyof WearableDailyMetric, mode: 'max' | 'first') {
  const values = rows
    .map((row) => numberOrNull(row[field]))
    .filter((value): value is number => value !== null);
  if (!values.length) return null;
  return mode === 'max' ? Math.max(...values) : values[0];
}
