export const CARDIO_RECOMMENDED_CAP_SECONDS = 20 * 60;

export function buildCardioTruth(sessions: any[] = []) {
  const distances = sessions.map((row) => numericOrNull(row.distance_km)).filter(isNumber);
  const kcal = sessions.map((row) => numericOrNull(row.active_kcal)).filter(isNumber);
  return {
    sessions: sessions.length,
    durationSeconds: sessions.reduce((sum, row) => sum + Math.max(0, numericOrNull(row.duration_seconds) ?? 0), 0),
    distanceKm: distances.length ? Number(distances.reduce((sum, value) => sum + value, 0).toFixed(3)) : null,
    sessionKcal: kcal.length ? Math.round(kcal.reduce((sum, value) => sum + value, 0)) : null,
    sessionKcalIncludedInDailyTotals: false as const,
  };
}

export function cardioCountsForProgression(row: any, todayKey: string) {
  if (!row?.performed_at || !todayKey) return false;
  if (row.counts_toward_progression === false) return false;
  const performed = new Date(row.performed_at);
  if (Number.isNaN(performed.getTime())) return false;
  const localKey = `${performed.getFullYear()}-${String(performed.getMonth() + 1).padStart(2, '0')}-${String(performed.getDate()).padStart(2, '0')}`;
  return localKey <= todayKey;
}

function numericOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isNumber(value: number | null): value is number { return value !== null; }
