import { normalizeDateKey } from '../utils/dates';

export function belongsToReviewWindow(dateValue: unknown, fromDate: string, toDate: string) {
  const date = normalizeDateKey(dateValue);
  return Boolean(date && date >= fromDate && date <= toDate);
}

export function averageKnown(values: Array<number | null | undefined>) {
  const known = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
}
