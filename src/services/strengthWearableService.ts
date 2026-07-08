import { requireSupabase } from '../lib/supabaseClient';
import { buildLocalDateTimeIso, localDateKeyFromInstant, normalizeDateKey, normalizeTimeKey, todayLocalKey } from '../utils/dates';
import { integerOrNull, numberOrNull, parseDurationSeconds, slug } from '../utils/durations';

const VALID_ACTIVITY_TYPES = new Set([
  'strength_training',
  'functional',
  'bodyweight',
  'cross_training',
  'other',
]);

export async function listWearableWorkoutSessions(userId, limit = 30) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('wearable_workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('performed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function deleteWearableWorkoutSession(userId, sessionId) {
  if (!sessionId) throw new Error('Sessão do relógio sem ID para apagar.');

  const client = requireSupabase();
  const { error } = await client
    .from('wearable_workout_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('id', sessionId);

  if (error) throw error;
  return true;
}

export async function saveWearableWorkoutSessionFromJson(userId, rawPayload) {
  const client = requireSupabase();
  const payload = normalizeWearableWorkoutPayload(rawPayload);

  const { data, error } = await client
    .from('wearable_workout_sessions')
    .upsert({ user_id: userId, ...payload }, { onConflict: 'user_id,dedupe_key' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export function normalizeWearableWorkoutPayload(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('JSON inválido: envie um objeto de sessão de treino do relógio.');
  }

  const activityType = normalizeActivityType(raw.activity_type ?? raw.activityType ?? raw.type);
  const date = normalizeDateKey(raw.date ?? raw.performed_date ?? raw.performedDate);
  const startTime = normalizeTimeKey(raw.start_time ?? raw.startTime ?? raw.started_at_time ?? raw.startedAtTime);
  const performedAt = normalizePerformedAt(raw.performed_at ?? raw.performedAt, date, startTime);
  const durationSeconds = parseDurationSeconds(raw.duration_seconds ?? raw.durationSeconds, { numericUnit: 'seconds' })
    ?? parseDurationSeconds(raw.duration_minutes ?? raw.durationMinutes, { numericUnit: 'minutes' })
    ?? parseDurationSeconds(raw.duration_text ?? raw.durationText ?? raw.time ?? raw.tempo ?? raw.duration, { numericUnit: 'reject' });
  const source = raw.source ?? 'mi_fitness_screenshot';
  const importMethod = raw.import_method ?? raw.importMethod ?? 'screenshot_json';
  const sourceApp = raw.source_app ?? raw.sourceApp ?? 'Mi Fitness';

  if (!performedAt) throw new Error('JSON sem data válida. Use date: YYYY-MM-DD e start_time: HH:mm ou performed_at ISO.');
  if (!durationSeconds || durationSeconds <= 0) throw new Error('JSON sem duração válida. Use duration_seconds, duration_minutes ou duration_text. Não use duration numérico sem unidade.');

  const dedupeKey = String(raw.dedupe_key ?? raw.dedupeKey ?? buildDedupeKey({
    date: localDateKeyFromInstant(performedAt) ?? date ?? todayLocalKey(),
    activityType,
    startTime: startTime || localStartMinute(performedAt),
    durationSeconds,
    sourceApp,
  }));

  return {
    workout_session_id: raw.workout_session_id ?? raw.workoutSessionId ?? null,
    performed_at: performedAt,
    activity_type: activityType,
    activity_label: raw.activity_label ?? raw.activityLabel ?? labelForActivity(activityType),

    source,
    import_method: importMethod,
    source_app: sourceApp,
    device_name: raw.device_name ?? raw.deviceName ?? null,

    duration_seconds: durationSeconds,
    active_kcal: integerOrNull(raw.active_kcal ?? raw.activeKcal ?? raw.kcal_active ?? raw.kcalAtiva),
    total_kcal: integerOrNull(raw.total_kcal ?? raw.totalKcal),
    avg_heart_rate: integerOrNull(raw.avg_heart_rate ?? raw.avgHeartRate ?? raw.bpm_medio ?? raw.bpmMedio),
    max_heart_rate: integerOrNull(raw.max_heart_rate ?? raw.maxHeartRate ?? raw.bpm_maximo ?? raw.bpmMaximo),
    training_effect: numberOrNull(raw.training_effect ?? raw.trainingEffect),
    vitality_score: integerOrNull(raw.vitality_score ?? raw.vitalityScore),

    heart_rate_zones: raw.heart_rate_zones ?? raw.heartRateZones ?? null,
    raw_json: raw,

    counts_toward_daily_totals: Boolean(raw.counts_toward_daily_totals ?? false),
    metrics_may_already_exist_in_health_connect: Boolean(raw.metrics_may_already_exist_in_health_connect ?? true),
    confidence: normalizeConfidence(raw.confidence),
    dedupe_key: dedupeKey,
    notes: raw.notes ?? 'Sessão de treino do relógio extraída de print. Complementa a execução do app sem duplicar totais diários.',
  };
}

export function isStrengthWearableImportShape(raw) {
  if (!raw || typeof raw !== 'object') return false;
  const type = String(raw.type ?? raw.activity_type ?? raw.activityType ?? '').toLowerCase();
  return (
    type.includes('strength') || type.includes('força') || type.includes('forca') || type.includes('muscul') ||
    raw.vitality_score !== undefined || raw.vitalityScore !== undefined ||
    raw.training_effect !== undefined || raw.trainingEffect !== undefined
  );
}

function normalizeActivityType(input) {
  const raw = String(input || '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

  if (['strength_wearable_session', 'forca', 'força', 'musculacao', 'musculação', 'weight_training', 'strength'].includes(raw)) return 'strength_training';
  if (['funcional', 'functional'].includes(raw)) return 'functional';
  if (['peso_corporal', 'bodyweight', 'calisthenics'].includes(raw)) return 'bodyweight';
  if (['cross_training', 'crossfit'].includes(raw)) return 'cross_training';
  return VALID_ACTIVITY_TYPES.has(raw) ? raw : 'other';
}

function labelForActivity(type) {
  return ({
    strength_training: 'Força',
    functional: 'Funcional',
    bodyweight: 'Peso corporal',
    cross_training: 'Cross training',
    other: 'Treino',
  })[type] ?? 'Treino';
}

function normalizePerformedAt(performedAt, date, startTime) {
  if (performedAt) {
    const parsed = new Date(performedAt);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  if (!date) return null;
  return buildLocalDateTimeIso(date, startTime ?? '12:00');
}

function localStartMinute(performedAt) {
  const parsed = new Date(String(performedAt));
  if (Number.isNaN(parsed.getTime())) return '1200';
  return `${String(parsed.getHours()).padStart(2, '0')}${String(parsed.getMinutes()).padStart(2, '0')}`;
}

function normalizeConfidence(value) {
  const raw = String(value || 'manual_review').toLowerCase();
  return ['low', 'medium', 'high', 'manual_review'].includes(raw) ? raw : 'manual_review';
}

function buildDedupeKey({ date, activityType, startTime, durationSeconds, sourceApp }) {
  return `${date}_${activityType}_${String(startTime || '').replace(':', '')}_${durationSeconds}s_${slug(sourceApp || 'manual')}`;
}
