import type { SourcedValue } from './dailyTypes';

export function buildSleepTruth(sessions: any[] = [], wearableRows: any[] = []): SourcedValue<number> {
  const selected = [...sessions].sort(compareSleep)[0];
  if (selected && numberOrNull(selected.duration_minutes) !== null) {
    return {
      value: numberOrNull(selected.duration_minutes),
      state: String(selected.confidence).toLowerCase() === 'low' ? 'estimated' : 'present',
      origin: String(selected.import_method).includes('json') ? 'json' : 'manual',
      source: selected.source_app ?? selected.source ?? null,
      confidence: normalizeConfidence(selected.confidence),
      includedInDailyTotals: selected.counts_toward_daily_totals !== false,
    };
  }
  const wearable = wearableRows.find((row) => numberOrNull(row.sleep_minutes) !== null);
  return {
    value: numberOrNull(wearable?.sleep_minutes),
    state: wearable ? 'estimated' : 'missing',
    origin: wearable ? 'wearable' : 'unknown',
    source: wearable?.source ?? wearable?.provider ?? null,
    confidence: wearable ? 'medium' : 'low',
    includedInDailyTotals: Boolean(wearable),
  };
}

function compareSleep(a: any, b: any) {
  const priority = (row: any) => (row.replaces_health_connect_sleep ? 100 : 0) + ({ high: 30, medium: 20, manual_review: 10, low: 0 }[row.confidence] ?? 5);
  return priority(b) - priority(a) || String(b.updated_at ?? b.created_at ?? '').localeCompare(String(a.updated_at ?? a.created_at ?? ''));
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeConfidence(value: unknown): 'high' | 'medium' | 'low' | 'manual_review' {
  const confidence = String(value ?? 'manual_review');
  return ['high', 'medium', 'low', 'manual_review'].includes(confidence) ? confidence as any : 'manual_review';
}
