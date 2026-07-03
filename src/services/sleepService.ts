import { requireSupabase } from '../lib/supabaseClient';

export async function listSleepSessions(userId, limit = 30) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('sleep_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('sleep_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function saveSleepSessionFromJson(userId, rawPayload) {
  const client = requireSupabase();
  const payload = normalizeSleepImportPayload(rawPayload);

  const { data, error } = await client
    .from('sleep_sessions')
    .upsert({ user_id: userId, ...payload }, { onConflict: 'user_id,dedupe_key' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export function normalizeSleepImportPayload(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('JSON inválido: envie um objeto de sessão de sono.');
  }

  const sleepDate = normalizeDate(raw.date ?? raw.sleep_date ?? raw.metric_date);
  const startTime = normalizeTime(raw.sleep_start ?? raw.start_time ?? raw.started_at_time);
  const endTime = normalizeTime(raw.sleep_end ?? raw.end_time ?? raw.ended_at_time);
  const durationMinutes = toInteger(raw.duration_minutes ?? raw.duration ?? raw.duration_text ?? raw.tempo_total);
  const source = raw.source ?? 'mi_fitness_screenshot';
  const sourceApp = raw.source_app ?? raw.sourceApp ?? 'Mi Fitness';
  const importMethod = raw.import_method ?? raw.importMethod ?? 'screenshot_json';

  if (!sleepDate) throw new Error('JSON sem data válida. Use date: YYYY-MM-DD.');
  if (!startTime || !endTime) throw new Error('JSON sem horário válido. Use sleep_start e sleep_end no formato HH:mm.');
  if (!durationMinutes || durationMinutes <= 0) throw new Error('JSON sem duração válida. Use duration_minutes ou duration_text.');

  const { startAt, endAt } = buildSleepDateTimes(sleepDate, startTime, endTime);
  const dedupeKey = String(raw.dedupe_key ?? raw.dedupeKey ?? buildDedupeKey({
    date: sleepDate,
    startTime,
    endTime,
    sourceApp,
  }));

  return {
    sleep_date: sleepDate,
    sleep_start_at: startAt,
    sleep_end_at: endAt,
    sleep_start_time: startTime,
    sleep_end_time: endTime,
    duration_minutes: durationMinutes,

    sleep_score: toInteger(raw.sleep_score ?? raw.sleepScore),
    sleep_quality_label: raw.sleep_quality_label ?? raw.sleepQualityLabel ?? null,
    sleep_score_delta: toInteger(raw.sleep_score_delta ?? raw.sleepScoreDelta),
    sleep_percentile_text: raw.sleep_percentile_text ?? raw.sleepPercentileText ?? null,

    deep_sleep_minutes: toInteger(raw.deep_sleep_minutes ?? raw.deepSleepMinutes),
    deep_sleep_percent: toInteger(raw.deep_sleep_percent ?? raw.deepSleepPercent),
    deep_sleep_reference: raw.deep_sleep_reference ?? raw.deepSleepReference ?? null,

    light_sleep_minutes: toInteger(raw.light_sleep_minutes ?? raw.lightSleepMinutes),
    light_sleep_percent: toInteger(raw.light_sleep_percent ?? raw.lightSleepPercent),
    light_sleep_reference: raw.light_sleep_reference ?? raw.lightSleepReference ?? null,

    rem_sleep_minutes: toInteger(raw.rem_sleep_minutes ?? raw.remSleepMinutes),
    rem_sleep_percent: toInteger(raw.rem_sleep_percent ?? raw.remSleepPercent),
    rem_sleep_reference: raw.rem_sleep_reference ?? raw.remSleepReference ?? null,

    awake_minutes: toInteger(raw.awake_minutes ?? raw.awakeMinutes),
    awake_count: toInteger(raw.awake_count ?? raw.awakeCount),
    awake_reference: raw.awake_reference ?? raw.awakeReference ?? null,
    awake_warning_label: raw.awake_warning_label ?? raw.awakeWarningLabel ?? null,

    avg_heart_rate: toInteger(raw.avg_heart_rate ?? raw.avgHeartRate),
    min_heart_rate: toInteger(raw.min_heart_rate ?? raw.minHeartRate),
    max_heart_rate: toInteger(raw.max_heart_rate ?? raw.maxHeartRate),
    avg_spo2: toInteger(raw.avg_spo2 ?? raw.avgSpo2),
    min_spo2: toInteger(raw.min_spo2 ?? raw.minSpo2),
    breathing_score: toInteger(raw.breathing_score ?? raw.breathingScore),

    source,
    import_method: importMethod,
    source_app: sourceApp,
    device_name: raw.device_name ?? raw.deviceName ?? null,

    replaces_health_connect_sleep: Boolean(raw.replaces_health_connect_sleep ?? true),
    counts_toward_daily_totals: Boolean(raw.counts_toward_daily_totals ?? true),
    metrics_may_already_exist_in_health_connect: Boolean(raw.metrics_may_already_exist_in_health_connect ?? true),

    overlap_detected: Boolean(raw.overlap_detected ?? false),
    corrected_from_overlapping_records: Boolean(raw.corrected_from_overlapping_records ?? false),
    raw_json: raw,
    confidence: normalizeConfidence(raw.confidence),
    dedupe_key: dedupeKey,
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
    notes: raw.notes ?? 'Sono importado por JSON de print. Este registro tem prioridade sobre sono automático do Health Connect para este dia.',
  };
}

function buildSleepDateTimes(sleepDate, startTime, endTime) {
  const startOnSameDate = `${sleepDate}T${startTime}:00`;
  const endOnSameDate = `${sleepDate}T${endTime}:00`;
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  let startDate = sleepDate;
  let endDate = sleepDate;

  // Se dormiu 22:57 e acordou 06:20, a data do sono é o dia que acordou.
  // Então o início fica no dia anterior.
  if (startMinutes > endMinutes) {
    startDate = shiftDate(sleepDate, -1);
  }

  const startAt = new Date(`${startDate}T${startTime}:00`);
  const endAt = new Date(`${endDate}T${endTime}:00`);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return { startAt: startOnSameDate, endAt: endOnSameDate };
  }

  return {
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
  };
}

function normalizeDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeTime(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/(\d{1,2})[:hH](\d{2})/);
  if (!match) return null;
  return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`;
}

function toInteger(value) {
  const parsed = toNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const raw = String(value).toLowerCase().trim();

  // "7h18min", "7 h 18 min"
  const hourMinute = raw.match(/(\d+)\s*h\s*(\d+)?/);
  if (hourMinute) {
    const hours = Number(hourMinute[1] || 0);
    const minutes = Number(hourMinute[2] || 0);
    return (hours * 60) + minutes;
  }

  // "00:22:48" ou "7:18"
  if (/^\d+:\d{2}(:\d{2})?$/.test(raw)) {
    const parts = raw.split(':').map(Number);
    if (parts.length === 3) return (parts[0] * 60) + parts[1] + Math.round(parts[2] / 60);
    return (parts[0] * 60) + parts[1];
  }

  const cleaned = raw.replace(',', '.').replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeConfidence(value) {
  const raw = String(value || 'manual_review').toLowerCase();
  return ['low', 'medium', 'high', 'manual_review'].includes(raw) ? raw : 'manual_review';
}

function buildDedupeKey({ date, startTime, endTime, sourceApp }) {
  return `${date}_sleep_${String(startTime).replace(':', '')}_${String(endTime).replace(':', '')}_${String(sourceApp || 'manual').toLowerCase().replace(/\s+/g, '_')}`;
}

function timeToMinutes(value) {
  const [h, m] = String(value).split(':').map(Number);
  return (h * 60) + m;
}

function shiftDate(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
