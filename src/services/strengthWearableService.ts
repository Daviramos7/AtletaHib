import { requireSupabase } from '../lib/supabaseClient';
import { buildLocalDateTimeIso, localDateKeyFromInstant, normalizeDateKey, normalizeTimeKey, todayLocalKey } from '../utils/dates';
import { integerOrNull, numberOrNull, parseDurationSeconds, slug } from '../utils/durations';
import { rankGymImportCandidates, withOptionalWorkoutLink } from '../domain/gymSession';
import { assertImportDateValue, assertImportTimeValue, assertReasonableImportDate, assertSafeImportPayload, boundedInteger, boundedNumber, boundedText } from '../utils/importSecurity';

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

export async function saveWearableWorkoutSessionFromJson(userId, rawPayload, options: any = {}) {
  const client = requireSupabase();
  const payload = normalizeWearableWorkoutPayload(rawPayload);
  const row = withOptionalWorkoutLink(payload, options.workoutSessionId);

  const { data, error } = await client
    .from('wearable_workout_sessions')
    .upsert({ user_id: userId, ...row }, { onConflict: 'user_id,dedupe_key' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function findStrengthGymCandidates(userId, performedAt) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('workout_sessions')
    .select('*, training_day:training_days(id,title), wearable_workout_sessions(id)')
    .eq('user_id', userId)
    .gte('performed_at', dayBoundary(performedAt, -1))
    .lte('performed_at', dayBoundary(performedAt, 1));
  if (error) throw error;
  return rankGymImportCandidates({ userId, performedAt, sessions: data ?? [], kind: 'strength' });
}

export async function linkWearableToGymSession(userId, wearableSessionId, workoutSessionId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('wearable_workout_sessions')
    .update({ workout_session_id: workoutSessionId })
    .eq('user_id', userId)
    .eq('id', wearableSessionId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function unlinkWearableFromGymSession(userId, wearableSessionId) {
  return linkWearableToGymSession(userId, wearableSessionId, null);
}

export function normalizeWearableWorkoutPayload(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('JSON inválido: envie um objeto de sessão de treino do relógio.');
  }
  assertSafeImportPayload(raw);

  const activityType = normalizeActivityType(raw.activity_type ?? raw.activityType ?? raw.type);
  const rawDate = raw.date ?? raw.performed_date ?? raw.performedDate;
  const rawStartTime = raw.start_time ?? raw.startTime ?? raw.started_at_time ?? raw.startedAtTime;
  if (rawDate !== null && rawDate !== undefined && rawDate !== '') assertImportDateValue(rawDate, 'Data do treino');
  assertImportTimeValue(rawStartTime, 'Horário do treino');
  const date = normalizeDateKey(rawDate);
  const startTime = normalizeTimeKey(rawStartTime);
  const performedAt = normalizePerformedAt(raw.performed_at ?? raw.performedAt, date, startTime);
  const durationSeconds = parseDurationSeconds(raw.duration_seconds ?? raw.durationSeconds, { numericUnit: 'seconds' })
    ?? parseDurationSeconds(raw.duration_minutes ?? raw.durationMinutes, { numericUnit: 'minutes' })
    ?? parseDurationSeconds(raw.duration_text ?? raw.durationText ?? raw.time ?? raw.tempo ?? raw.duration, { numericUnit: 'reject' });
  const source = boundedText(raw.source, 'Origem', 80) ?? 'mi_fitness_screenshot';
  const importMethod = boundedText(raw.import_method ?? raw.importMethod, 'Método de importação', 80) ?? 'screenshot_json';
  const sourceApp = boundedText(raw.source_app ?? raw.sourceApp, 'Aplicativo de origem', 120) ?? 'Mi Fitness';

  if (!performedAt) throw new Error('JSON sem data válida. Use date: YYYY-MM-DD e start_time: HH:mm ou performed_at ISO.');
  if (!durationSeconds || durationSeconds <= 0) throw new Error('JSON sem duração válida. Use duration_seconds, duration_minutes ou duration_text. Não use duration numérico sem unidade.');
  const safeDurationSeconds = boundedInteger(durationSeconds, 'Duração do treino', 1, 86_400);
  const localDate = localDateKeyFromInstant(performedAt) ?? date ?? todayLocalKey();
  assertReasonableImportDate(localDate, 'Data do treino');

  const dedupeKey = boundedText(raw.dedupe_key ?? raw.dedupeKey ?? buildDedupeKey({
    date: localDate,
    activityType,
    startTime: startTime || localStartMinute(performedAt),
    durationSeconds: safeDurationSeconds,
    sourceApp,
  }), 'Chave de deduplicação', 500);

  return {
    workout_session_id: raw.workout_session_id ?? raw.workoutSessionId ?? null,
    performed_at: performedAt,
    activity_type: activityType,
    activity_label: boundedText(raw.activity_label ?? raw.activityLabel, 'Nome da atividade', 120) ?? labelForActivity(activityType),

    source,
    import_method: importMethod,
    source_app: sourceApp,
    device_name: boundedText(raw.device_name ?? raw.deviceName, 'Dispositivo', 120),

    duration_seconds: safeDurationSeconds,
    active_kcal: boundedInteger(integerOrNull(raw.active_kcal ?? raw.activeKcal ?? raw.kcal_active ?? raw.kcalAtiva), 'Kcal ativas', 0, 100_000),
    total_kcal: boundedInteger(integerOrNull(raw.total_kcal ?? raw.totalKcal), 'Kcal totais', 0, 100_000),
    avg_heart_rate: boundedInteger(integerOrNull(raw.avg_heart_rate ?? raw.avgHeartRate ?? raw.bpm_medio ?? raw.bpmMedio), 'Frequência cardíaca média', 0, 300),
    max_heart_rate: boundedInteger(integerOrNull(raw.max_heart_rate ?? raw.maxHeartRate ?? raw.bpm_maximo ?? raw.bpmMaximo), 'Frequência cardíaca máxima', 0, 300),
    training_effect: boundedNumber(numberOrNull(raw.training_effect ?? raw.trainingEffect), 'Efeito do treino', 0, 10),
    vitality_score: boundedInteger(integerOrNull(raw.vitality_score ?? raw.vitalityScore), 'Vitalidade', 0, 100_000),

    heart_rate_zones: normalizeHeartRateZones(raw.heart_rate_zones ?? raw.heartRateZones),
    raw_json: raw,

    counts_toward_daily_totals: Boolean(raw.counts_toward_daily_totals ?? false),
    metrics_may_already_exist_in_health_connect: Boolean(raw.metrics_may_already_exist_in_health_connect ?? true),
    confidence: normalizeConfidence(raw.confidence),
    dedupe_key: dedupeKey,
    notes: boundedText(raw.notes, 'Observações', 1_000) ?? 'Sessão de treino do relógio extraída de print. Complementa a execução do app sem duplicar totais diários.',
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

function normalizeHeartRateZones(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const zones: Record<string, number | null> = {};
  for (const key of ['light_seconds', 'intensive_seconds', 'aerobic_seconds', 'anaerobic_seconds', 'vo2max_seconds']) {
    zones[key] = boundedInteger(value[key], `Zona ${key}`, 0, 86_400);
  }
  return zones;
}

function buildDedupeKey({ date, activityType, startTime, durationSeconds, sourceApp }) {
  return `${date}_${activityType}_${String(startTime || '').replace(':', '')}_${durationSeconds}s_${slug(sourceApp || 'manual')}`;
}

function dayBoundary(performedAt, offsetDays) {
  const date = new Date(performedAt);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}
