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
    notes: 'Fluxo recomendado: Redmi Watch 5 Active → Mi Fitness → Health Connect → app Android ponte → Supabase. Enquanto a ponte nativa não existe, use registro manual ou importação de arquivo.',
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
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('wearable_daily_metrics')
    .select('*')
    .eq('user_id', userId)
    .eq('metric_date', todayKey())
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
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

export async function deleteWearableMetric(id: string) {
  const supabase = requireSupabase();
  const { error } = await supabase.from('wearable_daily_metrics').delete().eq('id', id);
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
