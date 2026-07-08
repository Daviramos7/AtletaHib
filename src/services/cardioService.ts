import { requireSupabase } from '../lib/supabaseClient';
import { buildLocalDateTimeIso, localDateKeyFromInstant, normalizeDateKey, normalizeTimeKey, todayLocalKey } from '../utils/dates';
import { integerOrNull, numberOrNull, parseDurationSeconds, slug } from '../utils/durations';

const VALID_ACTIVITY_TYPES = new Set(['treadmill', 'outdoor_run', 'walk', 'stairs', 'bike', 'elliptical', 'other']);
const CARDIO_CAP_SECONDS = 20 * 60;

export async function listCardioSessions(userId, limit = 30) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('cardio_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('performed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function deleteCardioSession(userId, sessionId) {
  if (!sessionId) throw new Error('Sessão de cardio sem ID para apagar.');

  const client = requireSupabase();
  const { error } = await client
    .from('cardio_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('id', sessionId);

  if (error) throw error;
  return true;
}

export async function saveCardioSessionFromJson(userId, rawPayload) {
  const client = requireSupabase();
  const payload = normalizeCardioImportPayload(rawPayload);
  const { data, error } = await client
    .from('cardio_sessions')
    .upsert({ user_id: userId, ...payload }, { onConflict: 'user_id,dedupe_key' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function saveManualCardioSession(userId, payload) {
  const client = requireSupabase();
  const performedAt = payload.performed_at ?? new Date().toISOString();
  const activityType = normalizeActivityType(payload.activity_type ?? 'other');
  const durationSeconds = parseDurationSeconds(payload.duration_seconds, { numericUnit: 'seconds' })
    ?? parseDurationSeconds(payload.duration_minutes, { numericUnit: 'minutes' });

  if (!durationSeconds || durationSeconds <= 0) {
    throw new Error('Informe uma duração válida para finalizar o cardio.');
  }

  const activityLabel = payload.activity_label ?? labelForActivity(activityType);
  const source = payload.source ?? 'manual';
  const localDate = localDateKeyFromInstant(performedAt) ?? todayLocalKey();
  const startMinute = localStartMinute(performedAt);
  const dedupeKey = String(payload.dedupe_key ?? buildDedupeKey({
    date: localDate,
    startMinute,
    activityType,
    distanceKm: payload.distance_km ?? null,
    durationSeconds,
    source: `${source}_${slug(activityLabel)}`,
  }));

  const row = {
    user_id: userId,
    performed_at: performedAt,
    activity_type: activityType,
    activity_label: activityLabel,
    source,
    import_method: 'manual',
    source_app: payload.source_app ?? 'Atleta Híbrido',
    device_name: payload.device_name ?? null,
    distance_km: numberOrNull(payload.distance_km),
    duration_seconds: durationSeconds,
    active_kcal: integerOrNull(payload.active_kcal),
    total_kcal: integerOrNull(payload.total_kcal),
    avg_heart_rate: integerOrNull(payload.avg_heart_rate),
    max_heart_rate: integerOrNull(payload.max_heart_rate),
    confidence: 'manual_review',
    counts_toward_daily_totals: false,
    metrics_may_already_exist_in_health_connect: true,
    dedupe_key: dedupeKey,
    notes: buildCardioNotes(payload.notes, durationSeconds),
    raw_json: payload,
  };

  const { data, error } = await client
    .from('cardio_sessions')
    .upsert(row, { onConflict: 'user_id,dedupe_key' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export function normalizeCardioImportPayload(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('JSON inválido: envie um objeto de sessão de cardio.');
  }

  const activityType = normalizeActivityType(raw.activity_type ?? raw.activityType ?? raw.type);
  const date = normalizeDateKey(raw.date ?? raw.performed_date ?? raw.performedDate);
  const startTime = normalizeTimeKey(raw.start_time ?? raw.startTime ?? raw.started_at_time ?? raw.startedAtTime);
  const performedAt = normalizePerformedAt(raw.performed_at ?? raw.performedAt, date, startTime);
  const durationSeconds = parseDurationSeconds(raw.duration_seconds ?? raw.durationSeconds, { numericUnit: 'seconds' })
    ?? parseDurationSeconds(raw.duration_minutes ?? raw.durationMinutes, { numericUnit: 'minutes' })
    ?? parseDurationSeconds(raw.duration_text ?? raw.durationText ?? raw.time ?? raw.tempo ?? raw.duration, { numericUnit: 'reject' });
  const distanceKm = numberOrNull(raw.distance_km ?? raw.distanceKm ?? raw.distance);
  const source = raw.source ?? 'mi_fitness_screenshot';
  const importMethod = raw.import_method ?? raw.importMethod ?? 'screenshot_json';
  const sourceApp = raw.source_app ?? raw.sourceApp ?? 'Mi Fitness';
  const deviceName = raw.device_name ?? raw.deviceName ?? null;

  if (!performedAt) throw new Error('JSON sem data válida. Use date: YYYY-MM-DD e start_time: HH:mm ou performed_at ISO.');
  if (!durationSeconds || durationSeconds <= 0) throw new Error('JSON sem duração válida. Use duration_seconds, duration_minutes ou duration_text. Não use duration numérico sem unidade.');

  const localDate = localDateKeyFromInstant(performedAt) ?? date ?? todayLocalKey();
  const dedupeKey = String(raw.dedupe_key ?? raw.dedupeKey ?? buildDedupeKey({
    date: localDate,
    startMinute: startTime ?? localStartMinute(performedAt),
    activityType,
    distanceKm,
    durationSeconds,
    source,
  }));

  return {
    performed_at: performedAt,
    activity_type: activityType,
    activity_label: raw.activity_label ?? raw.activityLabel ?? labelForActivity(activityType),
    source,
    import_method: importMethod,
    source_app: sourceApp,
    device_name: deviceName,
    distance_km: distanceKm,
    duration_seconds: durationSeconds,
    active_kcal: integerOrNull(raw.active_kcal ?? raw.activeKcal ?? raw.kcal_active ?? raw.kcalAtiva),
    total_kcal: integerOrNull(raw.total_kcal ?? raw.totalKcal),
    avg_heart_rate: integerOrNull(raw.avg_heart_rate ?? raw.avgHeartRate ?? raw.bpm_medio ?? raw.bpmMedio),
    max_heart_rate: integerOrNull(raw.max_heart_rate ?? raw.maxHeartRate ?? raw.bpm_maximo ?? raw.bpmMaximo),
    avg_pace_seconds_per_km: toPaceSeconds(raw.avg_pace_min_per_km ?? raw.avgPaceMinPerKm ?? raw.avg_pace ?? raw.avgPace),
    best_pace_seconds_per_km: toPaceSeconds(raw.best_pace_min_per_km ?? raw.bestPaceMinPerKm ?? raw.max_pace ?? raw.maxPace),
    avg_speed_kmh: numberOrNull(raw.avg_speed_kmh ?? raw.avgSpeedKmh),
    max_speed_kmh: numberOrNull(raw.max_speed_kmh ?? raw.maxSpeedKmh),
    steps: integerOrNull(raw.steps ?? raw.passos),
    avg_cadence_spm: integerOrNull(raw.avg_cadence_spm ?? raw.avgCadenceSpm ?? raw.cadence_avg ?? raw.cadencia_media),
    max_cadence_spm: integerOrNull(raw.max_cadence_spm ?? raw.maxCadenceSpm ?? raw.cadence_max ?? raw.cadencia_maxima),
    avg_stride_cm: integerOrNull(raw.avg_stride_cm ?? raw.avgStrideCm ?? raw.stride_avg_cm ?? raw.passada_media_cm),
    max_stride_cm: integerOrNull(raw.max_stride_cm ?? raw.maxStrideCm ?? raw.stride_max_cm ?? raw.passada_maxima_cm),
    training_effect: numberOrNull(raw.training_effect ?? raw.trainingEffect),
    heart_rate_zones: raw.heart_rate_zones ?? raw.heartRateZones ?? null,
    splits: raw.splits ?? null,
    raw_json: raw,
    confidence: normalizeConfidence(raw.confidence),
    counts_toward_daily_totals: Boolean(raw.counts_toward_daily_totals ?? false),
    metrics_may_already_exist_in_health_connect: Boolean(raw.metrics_may_already_exist_in_health_connect ?? true),
    dedupe_key: dedupeKey,
    notes: buildCardioNotes(raw.notes ?? 'Sessão importada por JSON de print. Métricas diárias continuam vindo do Health Connect para evitar duplicidade.', durationSeconds),
  };
}

export function isCardioImportShape(raw) {
  if (!raw || typeof raw !== 'object') return false;
  const type = String(raw.type ?? raw.activity_type ?? raw.activityType ?? '').toLowerCase();
  const label = String(raw.activity_label ?? raw.activityLabel ?? '').toLowerCase();
  return (
    type.includes('cardio') || type.includes('run') || type.includes('corrida') ||
    ['treadmill', 'esteira', 'outdoor_run', 'walk', 'caminhada', 'stairs', 'escada', 'bike', 'elliptical'].some((term) => type.includes(term) || label.includes(term)) ||
    raw.distance_km !== undefined || raw.distanceKm !== undefined || raw.avg_pace_min_per_km !== undefined || raw.avgPaceMinPerKm !== undefined ||
    raw.steps !== undefined || raw.avg_speed_kmh !== undefined || raw.avgSpeedKmh !== undefined
  );
}

function normalizeActivityType(input) {
  const raw = String(input || '').toLowerCase().trim();
  const normalized = raw
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

  if (['cardio_session', 'cardio'].includes(normalized)) return 'other';
  if (['esteira', 'treadmill'].includes(normalized)) return 'treadmill';
  if (['corrida', 'outdoor_run', 'run', 'running'].includes(normalized)) return 'outdoor_run';
  if (['caminhada', 'walk', 'walking'].includes(normalized)) return 'walk';
  if (['escada', 'stairs', 'stair_climber'].includes(normalized)) return 'stairs';
  if (['bike', 'bicicleta', 'cycling', 'cycle'].includes(normalized)) return 'bike';
  if (['eliptico', 'elliptical'].includes(normalized)) return 'elliptical';
  return VALID_ACTIVITY_TYPES.has(normalized) ? normalized : 'other';
}

function labelForActivity(type) {
  return ({
    treadmill: 'Esteira',
    outdoor_run: 'Corrida',
    walk: 'Caminhada',
    stairs: 'Escada',
    bike: 'Bike',
    elliptical: 'Elíptico',
    other: 'Cardio',
  })[type] ?? 'Cardio';
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

function toPaceSeconds(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Math.round(value * 60);
  const raw = String(value).trim();
  const match = raw.match(/(\d+)\s*[':]\s*(\d{1,2})/);
  if (match) return (Number(match[1]) * 60) + Number(match[2]);
  return parseDurationSeconds(raw, { numericUnit: 'reject' });
}

function normalizeConfidence(value) {
  const raw = String(value || 'manual_review').toLowerCase();
  return ['low', 'medium', 'high', 'manual_review'].includes(raw) ? raw : 'manual_review';
}

function buildDedupeKey({ date, startMinute, activityType, distanceKm, durationSeconds, source }) {
  const distance = distanceKm === null || distanceKm === undefined ? 'sem_distancia' : `${Number(distanceKm).toFixed(3)}km`;
  const start = String(startMinute || 'sem_hora').replace(':', '');
  return `${date}_${start}_${activityType}_${distance}_${Math.round(durationSeconds)}s_${slug(source)}`;
}

function buildCardioNotes(notes, durationSeconds) {
  const parts = [notes].filter(Boolean);
  if (durationSeconds > CARDIO_CAP_SECONDS) {
    parts.push(`Aviso: sessão acima do teto recomendado de 20 min (${formatSeconds(durationSeconds)} registrados).`);
  }
  return parts.join(' · ') || null;
}

function formatSeconds(seconds) {
  const total = Math.max(0, Math.round(Number(seconds || 0)));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return sec ? `${min}min ${sec}s` : `${min}min`;
}
