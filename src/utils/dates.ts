const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const BR_DATE_RE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
const TIME_RE = /(\d{1,2})[:hH](\d{2})/;

export function pad2(value: number | string) {
  return String(value).padStart(2, '0');
}

export function todayLocalKey(now = new Date()) {
  return localDateKey(now);
}

export function localDateKey(value: Date | string | number | null | undefined) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function isDateKey(value: unknown) {
  return DATE_KEY_RE.test(String(value ?? ''));
}

export function normalizeDateKey(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim();

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return isValidCalendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3])) ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;

  const br = raw.match(BR_DATE_RE);
  if (br) return isValidCalendarDate(Number(br[3]), Number(br[2]), Number(br[1])) ? `${br[3]}-${pad2(br[2])}-${pad2(br[1])}` : null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return localDateKey(parsed);
}

export function localDayRangeIso(dateKey: string) {
  const safeDate = normalizeDateKey(dateKey);
  if (!safeDate) return null;
  const [year, month, day] = safeDate.split('-').map(Number);
  return {
    startIso: new Date(year, month - 1, day, 0, 0, 0, 0).toISOString(),
    endIso: new Date(year, month - 1, day + 1, 0, 0, 0, 0).toISOString(),
  };
}

export function normalizeTimeKey(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim();
  const match = raw.match(TIME_RE);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function buildLocalDateTimeIso(dateKey: string, timeKey = '12:00') {
  const safeDate = normalizeDateKey(dateKey);
  const safeTime = normalizeTimeKey(timeKey) ?? '12:00';
  if (!safeDate) return null;

  const [year, month, day] = safeDate.split('-').map(Number);
  const [hour, minute] = safeTime.split(':').map(Number);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function localDateKeyFromInstant(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return normalizeDateKey(value);
  return localDateKey(parsed);
}

export function shiftDateKey(dateKey: string, days: number) {
  const safeDate = normalizeDateKey(dateKey);
  if (!safeDate) return null;
  const [year, month, day] = safeDate.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function timeToMinutes(timeKey: string) {
  const safeTime = normalizeTimeKey(timeKey);
  if (!safeTime) return null;
  const [hour, minute] = safeTime.split(':').map(Number);
  return hour * 60 + minute;
}

export function startOfWeekLocal(dateValue: Date | string | number = new Date()) {
  const date = dateValue instanceof Date ? new Date(dateValue) : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return new Date();
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatDatePtBr(dateKey: unknown) {
  const safeDate = normalizeDateKey(dateKey);
  if (!safeDate) return '--';
  const [year, month, day] = safeDate.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0).toLocaleDateString('pt-BR');
}

function isValidCalendarDate(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
