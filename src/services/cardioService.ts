import { requireSupabase } from '../lib/supabaseClient';

const VALID_ACTIVITY_TYPES = new Set(['treadmill', 'outdoor_run', 'walk', 'stairs', 'bike', 'elliptical', 'other']);

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
  const durationSeconds = toSeconds(payload.duration_seconds ?? (Number(payload.duration_minutes || 0) * 60));

  if (!durationSeconds || durationSeconds <= 0) {
    throw new Error('Informe uma duração para finalizar o cardio.');
  }

  const activityLabel = payload.activity_label ?? labelForActivity(activityType);
  const source = payload.source ?? 'manual';
  const dedupeKey = String(payload.dedupe_key ?? buildDedupeKey({
    date: dateFromPerformedAt(performedAt),
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
    distance_km: toNumber(payload.distance_km),
    duration_seconds: durationSeconds,
    active_kcal: toInteger(payload.active_kcal),
    total_kcal: toInteger(payload.total_kcal),
    avg_heart_rate: toInteger(payload.avg_heart_rate),
    max_heart_rate: toInteger(payload.max_heart_rate),
    confidence: 'manual_review',
    counts_toward_daily_totals: false,
    metrics_may_already_exist_in_health_connect: true,
    dedupe_key: dedupeKey,
    notes: payload.notes ?? null,
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
  const date = raw.date ?? raw.performed_date ?? raw.performedDate;
  const startTime = raw.start_time ?? raw.startTime ?? raw.started_at_time ?? raw.startedAtTime;
  const performedAt = normalizePerformedAt(raw.performed_at ?? raw.performedAt, date, startTime);
  const durationSeconds = toSeconds(raw.duration_seconds ?? raw.durationSeconds ?? raw.duration ?? raw.time ?? raw.tempo);
  const distanceKm = toNumber(raw.distance_km ?? raw.distanceKm ?? raw.distance);
  const source = raw.source ?? 'mi_fitness_screenshot';
  const importMethod = raw.import_method ?? raw.importMethod ?? 'screenshot_json';
  const sourceApp = raw.source_app ?? raw.sourceApp ?? 'Mi Fitness';
  const deviceName = raw.device_name ?? raw.deviceName ?? null;

  if (!performedAt) throw new Error('JSON sem data válida. Use date: YYYY-MM-DD e start_time: HH:mm ou performed_at ISO.');
  if (!durationSeconds || durationSeconds <= 0) throw new Error('JSON sem duração válida. Use duration_seconds ou duration: HH:mm:ss.');

  const dedupeKey = String(raw.dedupe_key ?? raw.dedupeKey ?? buildDedupeKey({
    date: dateFromPerformedAt(performedAt),
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
    active_kcal: toInteger(raw.active_kcal ?? raw.activeKcal ?? raw.kcal_active ?? raw.kcalAtiva),
    total_kcal: toInteger(raw.total_kcal ?? raw.totalKcal),
    avg_heart_rate: toInteger(raw.avg_heart_rate ?? raw.avgHeartRate ?? raw.bpm_medio ?? raw.bpmMedio),
    max_heart_rate: toInteger(raw.max_heart_rate ?? raw.maxHeartRate ?? raw.bpm_maximo ?? raw.bpmMaximo),
    avg_pace_seconds_per_km: toPaceSeconds(raw.avg_pace_min_per_km ?? raw.avgPaceMinPerKm ?? raw.avg_pace ?? raw.avgPace),
    best_pace_seconds_per_km: toPaceSeconds(raw.best_pace_min_per_km ?? raw.bestPaceMinPerKm ?? raw.max_pace ?? raw.maxPace),
    avg_speed_kmh: toNumber(raw.avg_speed_kmh ?? raw.avgSpeedKmh),
    max_speed_kmh: toNumber(raw.max_speed_kmh ?? raw.maxSpeedKmh),
    steps: toInteger(raw.steps ?? raw.passos),
    avg_cadence_spm: toInteger(raw.avg_cadence_spm ?? raw.avgCadenceSpm ?? raw.cadence_avg ?? raw.cadencia_media),
    max_cadence_spm: toInteger(raw.max_cadence_spm ?? raw.maxCadenceSpm ?? raw.cadence_max ?? raw.cadencia_maxima),
    avg_stride_cm: toInteger(raw.avg_stride_cm ?? raw.avgStrideCm ?? raw.stride_avg_cm ?? raw.passada_media_cm),
    max_stride_cm: toInteger(raw.max_stride_cm ?? raw.maxStrideCm ?? raw.stride_max_cm ?? raw.passada_maxima_cm),
    training_effect: toNumber(raw.training_effect ?? raw.trainingEffect),
    heart_rate_zones: raw.heart_rate_zones ?? raw.heartRateZones ?? null,
    splits: raw.splits ?? null,
    raw_json: raw,
    confidence: normalizeConfidence(raw.confidence),
    counts_toward_daily_totals: Boolean(raw.counts_toward_daily_totals ?? false),
    metrics_may_already_exist_in_health_connect: Boolean(raw.metrics_may_already_exist_in_health_connect ?? true),
    dedupe_key: dedupeKey,
    notes: raw.notes ?? 'Sessão importada por JSON de print. Métricas diárias continuam vindo do Health Connect para evitar duplicidade.',
  };
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
  const raw = String(value).trim();
  if (/^\d+:\d{2}:\d{2}$/.test(raw)) {
    const [h, m, s] = raw.split(':').map(Number);
    return (h * 3600) + (m * 60) + s;
  }
  if (/^\d+:\d{2}$/.test(raw)) {
    const [m, s] = raw.split(':').map(Number);
    return (m * 60) + s;
  }
  return toInteger(raw);
}

function toPaceSeconds(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Math.round(value * 60);
  const raw = String(value).trim();
  const match = raw.match(/(\d+)\s*[':]\s*(\d{1,2})/);
  if (match) return (Number(match[1]) * 60) + Number(match[2]);
  return toSeconds(raw);
}

function normalizeConfidence(value) {
  const raw = String(value || 'manual_review').toLowerCase();
  return ['low', 'medium', 'high', 'manual_review'].includes(raw) ? raw : 'manual_review';
}

function buildDedupeKey({ date, activityType, distanceKm, durationSeconds, source }) {
  const distance = distanceKm === null || distanceKm === undefined ? 'sem-distancia' : `${Number(distanceKm).toFixed(2)}km`;
  return `${date}_${activityType}_${distance}_${durationSeconds}s_${String(source || 'manual').toLowerCase()}`;
}

function slug(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'cardio';
}
