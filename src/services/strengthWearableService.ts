import { requireSupabase } from '../lib/supabaseClient';

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
  const date = raw.date ?? raw.performed_date ?? raw.performedDate;
  const startTime = raw.start_time ?? raw.startTime ?? raw.started_at_time ?? raw.startedAtTime;
  const performedAt = normalizePerformedAt(raw.performed_at ?? raw.performedAt, date, startTime);
  const durationSeconds = toSeconds(raw.duration_seconds ?? raw.durationSeconds ?? raw.duration ?? raw.time ?? raw.tempo);
  const source = raw.source ?? 'mi_fitness_screenshot';
  const importMethod = raw.import_method ?? raw.importMethod ?? 'screenshot_json';
  const sourceApp = raw.source_app ?? raw.sourceApp ?? 'Mi Fitness';

  if (!performedAt) throw new Error('JSON sem data válida. Use date: YYYY-MM-DD e start_time: HH:mm ou performed_at ISO.');
  if (!durationSeconds || durationSeconds <= 0) throw new Error('JSON sem duração válida. Use duration_seconds ou duration_text.');

  const dedupeKey = String(raw.dedupe_key ?? raw.dedupeKey ?? buildDedupeKey({
    date: dateFromPerformedAt(performedAt),
    activityType,
    startTime: startTime || String(performedAt).slice(11, 16),
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
    active_kcal: toInteger(raw.active_kcal ?? raw.activeKcal ?? raw.kcal_active ?? raw.kcalAtiva),
    total_kcal: toInteger(raw.total_kcal ?? raw.totalKcal),
    avg_heart_rate: toInteger(raw.avg_heart_rate ?? raw.avgHeartRate ?? raw.bpm_medio ?? raw.bpmMedio),
    max_heart_rate: toInteger(raw.max_heart_rate ?? raw.maxHeartRate ?? raw.bpm_maximo ?? raw.bpmMaximo),
    training_effect: toNumber(raw.training_effect ?? raw.trainingEffect),
    vitality_score: toInteger(raw.vitality_score ?? raw.vitalityScore),

    heart_rate_zones: raw.heart_rate_zones ?? raw.heartRateZones ?? null,
    raw_json: raw,

    counts_toward_daily_totals: Boolean(raw.counts_toward_daily_totals ?? false),
    metrics_may_already_exist_in_health_connect: Boolean(raw.metrics_may_already_exist_in_health_connect ?? true),
    confidence: normalizeConfidence(raw.confidence),
    dedupe_key: dedupeKey,
    notes: raw.notes ?? 'Sessão de treino do relógio extraída de print. Complementa a execução do app sem duplicar totais diários.',
  };
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
  const safeTime = startTime ? String(startTime).slice(0, 5) : '12:00';
  const parsed = new Date(`${date}T${safeTime}:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function dateFromPerformedAt(performedAt) {
  return String(performedAt).slice(0, 10);
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const cleaned = String(value).replace(',', '.').replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value) {
  const parsed = toNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

function toSeconds(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Math.round(value);

  const raw = String(value).trim().toLowerCase();

  if (/^\d+:\d{2}:\d{2}$/.test(raw)) {
    const [h, m, s] = raw.split(':').map(Number);
    return (h * 3600) + (m * 60) + s;
  }

  if (/^\d+:\d{2}$/.test(raw)) {
    const [m, s] = raw.split(':').map(Number);
    return (m * 60) + s;
  }

  const hourMinute = raw.match(/(\d+)\s*h\s*(\d+)?/);
  if (hourMinute) {
    return (Number(hourMinute[1] || 0) * 3600) + (Number(hourMinute[2] || 0) * 60);
  }

  return toInteger(raw);
}

function normalizeConfidence(value) {
  const raw = String(value || 'manual_review').toLowerCase();
  return ['low', 'medium', 'high', 'manual_review'].includes(raw) ? raw : 'manual_review';
}

function buildDedupeKey({ date, activityType, startTime, durationSeconds, sourceApp }) {
  return `${date}_${activityType}_${String(startTime || '').replace(':', '')}_${durationSeconds}s_${String(sourceApp || 'manual').toLowerCase().replace(/\s+/g, '_')}`;
}
