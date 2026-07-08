export function parseLocaleNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(',', '.').replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function integerOrNull(value: unknown) {
  const parsed = parseLocaleNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

export function numberOrNull(value: unknown) {
  return parseLocaleNumber(value);
}

export function parseDurationSeconds(value: unknown, options: { numericUnit?: 'seconds' | 'minutes' | 'reject' } = {}) {
  if (value === null || value === undefined || value === '') return null;
  const numericUnit = options.numericUnit ?? 'reject';

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    if (numericUnit === 'seconds') return Math.round(value);
    if (numericUnit === 'minutes') return Math.round(value * 60);
    return null;
  }

  const raw = String(value).trim().toLowerCase();
  if (!raw) return null;

  if (/^\d+:\d{2}:\d{2}$/.test(raw)) {
    const [h, m, s] = raw.split(':').map(Number);
    return (h * 3600) + (m * 60) + s;
  }

  if (/^\d+:\d{2}$/.test(raw)) {
    const [m, s] = raw.split(':').map(Number);
    return (m * 60) + s;
  }

  const hourMinute = raw.match(/(\d+(?:[,.]\d+)?)\s*h(?:\s*(\d+(?:[,.]\d+)?)\s*(?:m|min|minutos?)?)?/);
  if (hourMinute) {
    const hours = Number(hourMinute[1].replace(',', '.')) || 0;
    const minutes = hourMinute[2] ? Number(hourMinute[2].replace(',', '.')) || 0 : 0;
    return Math.round((hours * 3600) + (minutes * 60));
  }

  const minutes = raw.match(/(\d+(?:[,.]\d+)?)\s*(?:m|min|minuto|minutos)\b/);
  if (minutes) return Math.round(Number(minutes[1].replace(',', '.')) * 60);

  const seconds = raw.match(/(\d+(?:[,.]\d+)?)\s*(?:s|seg|segundos?)\b/);
  if (seconds) return Math.round(Number(seconds[1].replace(',', '.')));

  const parsed = parseLocaleNumber(raw);
  if (parsed === null || parsed <= 0) return null;
  if (numericUnit === 'seconds') return Math.round(parsed);
  if (numericUnit === 'minutes') return Math.round(parsed * 60);
  return null;
}

export function parseDurationMinutes(value: unknown, options: { numericUnit?: 'minutes' | 'seconds' | 'reject' } = {}) {
  const unit = options.numericUnit === 'seconds' ? 'seconds' : options.numericUnit === 'minutes' ? 'minutes' : 'reject';
  const seconds = parseDurationSeconds(value, { numericUnit: unit });
  return seconds === null ? null : Math.round(seconds / 60);
}

export function slug(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'na';
}
