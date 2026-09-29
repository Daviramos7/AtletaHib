import { requireSupabase } from '../lib/supabaseClient';
import { buildLocalDateTimeIso, localDateKeyFromInstant, normalizeDateKey, normalizeTimeKey, todayLocalKey } from '../utils/dates';
import { integerOrNull, numberOrNull, parseDurationSeconds, slug } from '../utils/durations';
import { cardioStatusAfterDeletingLinkedExecution, rankGymImportCandidates, withOptionalWorkoutLink } from '../domain/gymSession';
import { assertImportDateValue, assertImportTimeValue, assertReasonableImportDate, assertSafeImportPayload, boundedInteger, boundedNumber, boundedText } from '../utils/importSecurity';

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
  const current = await client
    .from('cardio_sessions')
    .select('id,workout_session_id')
    .eq('user_id', userId)
    .eq('id', sessionId)
    .maybeSingle();
  if (current.error) throw current.error;

  const { error } = await client
    .from('cardio_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('id', sessionId);

  if (error) throw error;
  if (current.data?.workout_session_id) {
    const parent = await client
      .from('workout_sessions')
      .select('cardio_plan,completed')
      .eq('user_id', userId)
      .eq('id', current.data.workout_session_id)
      .maybeSingle();
    if (parent.error) throw parent.error;
    const status = cardioStatusAfterDeletingLinkedExecution(parent.data?.cardio_plan, parent.data?.completed === true);
    const restored = await client
      .from('workout_sessions')
      .update({ cardio_status: status })
      .eq('user_id', userId)
      .eq('id', current.data.workout_session_id);
    if (restored.error) throw restored.error;
  }
  return true;
}

export async function saveCardioSessionFromJson(userId, rawPayload, options: any = {}) {
  const client = requireSupabase();
  const payload = normalizeCardioImportPayload(rawPayload);
  const row = withOptionalWorkoutLink(payload, options.workoutSessionId);
  const { data, error } = await client
    .from('cardio_sessions')
    .upsert({ user_id: userId, ...row }, { onConflict: 'user_id,dedupe_key' })
    .select('*')
    .single();
  if (error) throw error;
  if (data?.workout_session_id) await markLinkedCardioCompleted(client, userId, data.workout_session_id);
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

  const row: any = {
    user_id: userId,
    performed_at: performedAt,
    activity_type: activityType,
    activity_label: activityLabel,
    source,
    import_method: 'manual',
    source_app: payload.source_app ?? 'Atleta Híbrido',
    device_name: payload.device_name ?? null,
    distance_km: numberOrNull(payload.distance_km),
    distance_source: payload.distance_source ?? (payload.distance_km == null ? null : 'manual'),
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
  if (payload.workout_session_id) row.workout_session_id = payload.workout_session_id;

  const { data, error } = await client
    .from('cardio_sessions')
    .upsert(row, { onConflict: 'user_id,dedupe_key' })
    .select('*')
    .single();

  if (error) throw error;
  if (data?.workout_session_id) await markLinkedCardioCompleted(client, userId, data.workout_session_id);
  return data;
}

export async function findCardioGymCandidates(userId, performedAt) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('workout_sessions')
    .select('*, training_day:training_days(id,title), cardio_sessions(id)')
    .eq('user_id', userId)
    .gte('performed_at', dayBoundary(performedAt, -1))
    .lte('performed_at', dayBoundary(performedAt, 1));
  if (error) throw error;
  return rankGymImportCandidates({ userId, performedAt, sessions: data ?? [], kind: 'cardio' });
}

export async function linkCardioToGymSession(userId, cardioSessionId, workoutSessionId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('cardio_sessions')
    .update({ workout_session_id: workoutSessionId })
    .eq('user_id', userId)
    .eq('id', cardioSessionId)
    .select('*')
    .single();
  if (error) throw error;
  await markLinkedCardioCompleted(client, userId, workoutSessionId);
  return data;
}

export async function unlinkCardioFromGymSession(userId, cardioSessionId) {
  const client = requireSupabase();
  const current = await client.from('cardio_sessions').select('workout_session_id').eq('user_id', userId).eq('id', cardioSessionId).single();
  if (current.error) throw current.error;
  const { data, error } = await client
    .from('cardio_sessions')
    .update({ workout_session_id: null })
    .eq('user_id', userId)
    .eq('id', cardioSessionId)
    .select('*')
    .single();
  if (error) throw error;
  if (current.data?.workout_session_id) {
    const parent = await client.from('workout_sessions').select('cardio_plan,completed').eq('user_id', userId).eq('id', current.data.workout_session_id).single();
    if (parent.error) throw parent.error;
    const update = await client.from('workout_sessions').update({ cardio_status: cardioStatusAfterDeletingLinkedExecution(parent.data?.cardio_plan, parent.data?.completed === true) }).eq('user_id', userId).eq('id', current.data.workout_session_id);
    if (update.error) throw update.error;
  }
  return data;
}

export function normalizeCardioImportPayload(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('JSON inválido: envie um objeto de sessão de cardio.');
  }
  assertSafeImportPayload(raw);

  const activityType = normalizeActivityType(raw.activity_type ?? raw.activityType ?? raw.type);
  const rawDate = raw.date ?? raw.performed_date ?? raw.performedDate;
  const rawStartTime = raw.start_time ?? raw.startTime ?? raw.started_at_time ?? raw.startedAtTime;
  if (rawDate !== null && rawDate !== undefined && rawDate !== '') assertImportDateValue(rawDate, 'Data do cardio');
  assertImportTimeValue(rawStartTime, 'Horário do cardio');
  const date = normalizeDateKey(rawDate);
  const startTime = normalizeTimeKey(rawStartTime);
  const performedAt = normalizePerformedAt(raw.performed_at ?? raw.performedAt, date, startTime);
  const durationSeconds = parseDurationSeconds(raw.duration_seconds ?? raw.durationSeconds, { numericUnit: 'seconds' })
    ?? parseDurationSeconds(raw.duration_minutes ?? raw.durationMinutes, { numericUnit: 'minutes' })
    ?? parseDurationSeconds(raw.duration_text ?? raw.durationText ?? raw.time ?? raw.tempo ?? raw.duration, { numericUnit: 'reject' });
  const distanceKm = boundedNumber(numberOrNull(raw.distance_km ?? raw.distanceKm ?? raw.distance), 'Distância', 0, 1_000);
  const source = boundedText(raw.source, 'Origem', 80) ?? 'mi_fitness_screenshot';
  const importMethod = normalizeImportMethod(raw.import_method ?? raw.importMethod);
  const sourceApp = boundedText(raw.source_app ?? raw.sourceApp, 'Aplicativo de origem', 120) ?? 'Mi Fitness';
  const deviceName = boundedText(raw.device_name ?? raw.deviceName, 'Dispositivo', 120);

  if (!performedAt) throw new Error('JSON sem data válida. Use date: YYYY-MM-DD e start_time: HH:mm ou performed_at ISO.');
  if (!durationSeconds || durationSeconds <= 0) throw new Error('JSON sem duração válida. Use duration_seconds, duration_minutes ou duration_text. Não use duration numérico sem unidade.');
  const safeDurationSeconds = boundedInteger(durationSeconds, 'Duração do cardio', 1, 86_400);

  const localDate = localDateKeyFromInstant(performedAt) ?? date ?? todayLocalKey();
  assertReasonableImportDate(localDate, 'Data do cardio');
  const dedupeKey = boundedText(raw.dedupe_key ?? raw.dedupeKey ?? buildDedupeKey({
    date: localDate,
    startMinute: startTime ?? localStartMinute(performedAt),
    activityType,
    distanceKm,
    durationSeconds: safeDurationSeconds,
    source,
  }), 'Chave de deduplicação', 500);

  return {
    workout_session_id: null,
    performed_at: performedAt,
    activity_type: activityType,
    activity_label: boundedText(raw.activity_label ?? raw.activityLabel, 'Nome da atividade', 120) ?? labelForActivity(activityType),
    source,
    import_method: importMethod,
    source_app: sourceApp,
    device_name: deviceName,
    distance_km: distanceKm,
    distance_source: boundedText(raw.distance_source ?? raw.distanceSource, 'Origem da distância', 80) ?? (distanceKm == null ? null : 'wearable'),
    duration_seconds: safeDurationSeconds,
    active_kcal: boundedInteger(integerOrNull(raw.active_kcal ?? raw.activeKcal ?? raw.kcal_active ?? raw.kcalAtiva), 'Kcal ativas', 0, 100_000),
    total_kcal: boundedInteger(integerOrNull(raw.total_kcal ?? raw.totalKcal), 'Kcal totais', 0, 100_000),
    avg_heart_rate: boundedInteger(integerOrNull(raw.avg_heart_rate ?? raw.avgHeartRate ?? raw.bpm_medio ?? raw.bpmMedio), 'Frequência cardíaca média', 0, 300),
    max_heart_rate: boundedInteger(integerOrNull(raw.max_heart_rate ?? raw.maxHeartRate ?? raw.bpm_maximo ?? raw.bpmMaximo), 'Frequência cardíaca máxima', 0, 300),
    avg_pace_seconds_per_km: boundedInteger(toPaceSeconds(raw.avg_pace_min_per_km ?? raw.avgPaceMinPerKm ?? raw.avg_pace ?? raw.avgPace), 'Ritmo médio', 0, 86_400),
    best_pace_seconds_per_km: boundedInteger(toPaceSeconds(raw.best_pace_min_per_km ?? raw.bestPaceMinPerKm ?? raw.max_pace ?? raw.maxPace), 'Melhor ritmo', 0, 86_400),
    avg_speed_kmh: boundedNumber(numberOrNull(raw.avg_speed_kmh ?? raw.avgSpeedKmh), 'Velocidade média', 0, 200),
    max_speed_kmh: boundedNumber(numberOrNull(raw.max_speed_kmh ?? raw.maxSpeedKmh), 'Velocidade máxima', 0, 200),
    steps: boundedInteger(integerOrNull(raw.steps ?? raw.passos), 'Passos', 0, 1_000_000),
    avg_cadence_spm: boundedInteger(integerOrNull(raw.avg_cadence_spm ?? raw.avgCadenceSpm ?? raw.cadence_avg ?? raw.cadencia_media), 'Cadência média', 0, 400),
    max_cadence_spm: boundedInteger(integerOrNull(raw.max_cadence_spm ?? raw.maxCadenceSpm ?? raw.cadence_max ?? raw.cadencia_maxima), 'Cadência máxima', 0, 400),
    avg_stride_cm: boundedInteger(integerOrNull(raw.avg_stride_cm ?? raw.avgStrideCm ?? raw.stride_avg_cm ?? raw.passada_media_cm), 'Passada média', 0, 500),
    max_stride_cm: boundedInteger(integerOrNull(raw.max_stride_cm ?? raw.maxStrideCm ?? raw.stride_max_cm ?? raw.passada_maxima_cm), 'Passada máxima', 0, 500),
    training_effect: boundedNumber(numberOrNull(raw.training_effect ?? raw.trainingEffect), 'Efeito do treino', 0, 10),
    heart_rate_zones: normalizeHeartRateZones(raw.heart_rate_zones ?? raw.heartRateZones),
    splits: normalizeSplits(raw.splits),
    raw_json: raw,
    confidence: normalizeConfidence(raw.confidence),
    counts_toward_daily_totals: Boolean(raw.counts_toward_daily_totals ?? false),
    metrics_may_already_exist_in_health_connect: Boolean(raw.metrics_may_already_exist_in_health_connect ?? true),
    dedupe_key: dedupeKey,
    notes: buildCardioNotes(boundedText(raw.notes, 'Observações', 1_000) ?? 'Sessão importada por JSON de print. Métricas diárias continuam vindo do Health Connect para evitar duplicidade.', safeDurationSeconds),
  };
}

async function markLinkedCardioCompleted(client, userId, workoutSessionId) {
  const { error } = await client
    .from('workout_sessions')
    .update({ cardio_status: 'completed' })
    .eq('user_id', userId)
    .eq('id', workoutSessionId);
  if (error) throw error;
}

function dayBoundary(performedAt, offsetDays) {
  const date = new Date(performedAt);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
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

function normalizeImportMethod(value) {
  const method = String(value ?? 'screenshot_json').toLowerCase();
  return ['manual', 'screenshot_json', 'health_connect_inferred', 'other'].includes(method) ? method : 'other';
}

function normalizeHeartRateZones(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const zones: Record<string, number | null> = {};
  for (const key of ['light_seconds', 'intensive_seconds', 'aerobic_seconds', 'anaerobic_seconds', 'vo2max_seconds']) {
    zones[key] = boundedInteger(value[key], `Zona ${key}`, 0, 86_400);
  }
  return zones;
}

function normalizeSplits(value) {
  if (!Array.isArray(value)) return null;
  return value.map((split, index) => ({
    km: boundedNumber(split?.km, `Distância da parcial ${index + 1}`, 0, 1_000),
    pace_min_per_km: boundedText(split?.pace_min_per_km, `Ritmo da parcial ${index + 1}`, 30),
    notes: boundedText(split?.notes, `Observação da parcial ${index + 1}`, 200),
  }));
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
