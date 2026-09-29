import { requireSupabase } from '../lib/supabaseClient';
import { buildLocalDateTimeIso, normalizeDateKey, normalizeTimeKey, shiftDateKey, timeToMinutes } from '../utils/dates';
import { assertImportDateValue, assertImportTimeValue, assertReasonableImportDate, assertSafeImportPayload, boundedInteger, boundedText } from '../utils/importSecurity';

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
  assertSafeImportPayload(raw);

  const rawDate = raw.date ?? raw.sleep_date ?? raw.metric_date;
  const rawStartTime = raw.sleep_start ?? raw.start_time ?? raw.started_at_time;
  const rawEndTime = raw.sleep_end ?? raw.end_time ?? raw.ended_at_time;
  if (rawDate !== null && rawDate !== undefined && rawDate !== '') assertImportDateValue(rawDate, 'Data do sono');
  assertImportTimeValue(rawStartTime, 'Início do sono');
  assertImportTimeValue(rawEndTime, 'Fim do sono');
  const sleepDate = normalizeDate(rawDate);
  const startTime = normalizeTime(rawStartTime);
  const endTime = normalizeTime(rawEndTime);
  const durationMinutes = boundedInteger(toNumber(raw.duration_minutes ?? raw.duration ?? raw.duration_text ?? raw.tempo_total), 'Duração do sono', 1, 1440);
  const source = boundedText(raw.source, 'Origem', 80) ?? 'mi_fitness_screenshot';
  const sourceApp = boundedText(raw.source_app ?? raw.sourceApp, 'Aplicativo de origem', 120) ?? 'Mi Fitness';
  const importMethod = normalizeImportMethod(raw.import_method ?? raw.importMethod);

  if (!sleepDate) throw new Error('JSON sem data válida. Use date: YYYY-MM-DD.');
  assertReasonableImportDate(sleepDate, 'Data do sono');
  if (!startTime || !endTime) throw new Error('JSON sem horário válido. Use sleep_start e sleep_end no formato HH:mm.');
  if (!durationMinutes || durationMinutes <= 0) throw new Error('JSON sem duração válida. Use duration_minutes ou duration_text.');

  const { startAt, endAt } = buildSleepDateTimes(sleepDate, startTime, endTime);
  const dedupeKey = boundedText(raw.dedupe_key ?? raw.dedupeKey ?? buildDedupeKey({
    date: sleepDate,
    startTime,
    endTime,
    sourceApp,
  }), 'Chave de deduplicação', 500);

  return {
    sleep_date: sleepDate,
    sleep_start_at: startAt,
    sleep_end_at: endAt,
    sleep_start_time: startTime,
    sleep_end_time: endTime,
    duration_minutes: durationMinutes,

    sleep_score: boundedInteger(toNumber(raw.sleep_score ?? raw.sleepScore), 'Pontuação do sono', 0, 100),
    sleep_quality_label: boundedText(raw.sleep_quality_label ?? raw.sleepQualityLabel, 'Qualidade do sono', 120),
    sleep_score_delta: boundedInteger(toNumber(raw.sleep_score_delta ?? raw.sleepScoreDelta), 'Variação da pontuação', -100, 100),
    sleep_percentile_text: boundedText(raw.sleep_percentile_text ?? raw.sleepPercentileText, 'Percentil do sono', 300),

    deep_sleep_minutes: boundedInteger(toNumber(raw.deep_sleep_minutes ?? raw.deepSleepMinutes), 'Sono profundo', 0, 1440),
    deep_sleep_percent: boundedInteger(toNumber(raw.deep_sleep_percent ?? raw.deepSleepPercent), 'Percentual de sono profundo', 0, 100),
    deep_sleep_reference: boundedText(raw.deep_sleep_reference ?? raw.deepSleepReference, 'Referência de sono profundo', 120),

    light_sleep_minutes: boundedInteger(toNumber(raw.light_sleep_minutes ?? raw.lightSleepMinutes), 'Sono leve', 0, 1440),
    light_sleep_percent: boundedInteger(toNumber(raw.light_sleep_percent ?? raw.lightSleepPercent), 'Percentual de sono leve', 0, 100),
    light_sleep_reference: boundedText(raw.light_sleep_reference ?? raw.lightSleepReference, 'Referência de sono leve', 120),

    rem_sleep_minutes: boundedInteger(toNumber(raw.rem_sleep_minutes ?? raw.remSleepMinutes), 'Sono REM', 0, 1440),
    rem_sleep_percent: boundedInteger(toNumber(raw.rem_sleep_percent ?? raw.remSleepPercent), 'Percentual de sono REM', 0, 100),
    rem_sleep_reference: boundedText(raw.rem_sleep_reference ?? raw.remSleepReference, 'Referência de sono REM', 120),

    awake_minutes: boundedInteger(toNumber(raw.awake_minutes ?? raw.awakeMinutes), 'Tempo acordado', 0, 1440),
    awake_count: boundedInteger(toNumber(raw.awake_count ?? raw.awakeCount), 'Despertares', 0, 200),
    awake_reference: boundedText(raw.awake_reference ?? raw.awakeReference, 'Referência de despertares', 120),
    awake_warning_label: boundedText(raw.awake_warning_label ?? raw.awakeWarningLabel, 'Alerta de despertares', 120),

    avg_heart_rate: boundedInteger(toNumber(raw.avg_heart_rate ?? raw.avgHeartRate), 'Frequência cardíaca média', 0, 300),
    min_heart_rate: boundedInteger(toNumber(raw.min_heart_rate ?? raw.minHeartRate), 'Frequência cardíaca mínima', 0, 300),
    max_heart_rate: boundedInteger(toNumber(raw.max_heart_rate ?? raw.maxHeartRate), 'Frequência cardíaca máxima', 0, 300),
    avg_spo2: boundedInteger(toNumber(raw.avg_spo2 ?? raw.avgSpo2), 'SpO2 média', 0, 100),
    min_spo2: boundedInteger(toNumber(raw.min_spo2 ?? raw.minSpo2), 'SpO2 mínima', 0, 100),
    breathing_score: boundedInteger(toNumber(raw.breathing_score ?? raw.breathingScore), 'Pontuação respiratória', 0, 100),

    source,
    import_method: importMethod,
    source_app: sourceApp,
    device_name: boundedText(raw.device_name ?? raw.deviceName, 'Dispositivo', 120),

    replaces_health_connect_sleep: Boolean(raw.replaces_health_connect_sleep ?? true),
    counts_toward_daily_totals: Boolean(raw.counts_toward_daily_totals ?? true),
    metrics_may_already_exist_in_health_connect: Boolean(raw.metrics_may_already_exist_in_health_connect ?? true),

    overlap_detected: Boolean(raw.overlap_detected ?? false),
    corrected_from_overlapping_records: Boolean(raw.corrected_from_overlapping_records ?? false),
    raw_json: raw,
    confidence: normalizeConfidence(raw.confidence),
    dedupe_key: dedupeKey,
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map((warning) => boundedText(warning, 'Aviso', 300)).filter(Boolean) : [],
    notes: boundedText(raw.notes, 'Observações', 1_000) ?? 'Sono importado por JSON de print. Este registro tem prioridade sobre sono automático do Health Connect para este dia.',
  };
}

function buildSleepDateTimes(sleepDate, startTime, endTime) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  let startDate = sleepDate;
  let endDate = sleepDate;

  // Regra oficial do app: sleep_date representa o dia em que acordou.
  // Se a fonte usar data de início, o leitor precisa enviar sleep_date_basis no futuro.
  if (startMinutes !== null && endMinutes !== null && startMinutes > endMinutes) {
    startDate = shiftDateKey(sleepDate, -1) ?? sleepDate;
  }

  return {
    startAt: buildLocalDateTimeIso(startDate, startTime) ?? `${startDate}T${startTime}:00`,
    endAt: buildLocalDateTimeIso(endDate, endTime) ?? `${endDate}T${endTime}:00`,
  };
}

function normalizeDate(value) {
  return normalizeDateKey(value);
}

function normalizeTime(value) {
  return normalizeTimeKey(value);
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

function normalizeImportMethod(value) {
  const method = String(value ?? 'screenshot_json').toLowerCase();
  return ['manual', 'screenshot_json', 'health_connect_corrected', 'other'].includes(method) ? method : 'other';
}

function buildDedupeKey({ date, startTime, endTime, sourceApp }) {
  return `${date}_sleep_${String(startTime).replace(':', '')}_${String(endTime).replace(':', '')}_${String(sourceApp || 'manual').toLowerCase().replace(/\s+/g, '_')}`;
}
