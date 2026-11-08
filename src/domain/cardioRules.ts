// Teto RECOMENDADO de cardio por sessão. Valor real acima disso é preservado (só gera aviso),
// mas nunca vira meta. Fonte única: todo clamp/aviso de cardio deriva daqui.
export const CARDIO_RECOMMENDED_CAP_SECONDS = 25 * 60;
export const CARDIO_RECOMMENDED_CAP_MINUTES = CARDIO_RECOMMENDED_CAP_SECONDS / 60;

export type CardioIntensity = 'leve' | 'moderado';

export interface CardioPrescription {
  minMinutes: number;
  maxMinutes: number;
  intensity: CardioIntensity;
}

export function clampCardioMinutes(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.round(value), 0), CARDIO_RECOMMENDED_CAP_MINUTES);
}

/** Lê a prescrição de cardio salva no dia do plano. Null quando o plano é antigo ou incompleto. */
export function cardioPrescriptionFromDay(day: any): CardioPrescription | null {
  const min = numericOrNull(day?.cardio_min_minutes);
  const max = numericOrNull(day?.cardio_max_minutes);
  if (min === null && max === null) return null;
  const maxMinutes = clampCardioMinutes(max ?? min ?? 0);
  const minMinutes = Math.min(clampCardioMinutes(min ?? max ?? 0), maxMinutes);
  if (maxMinutes <= 0) return null;
  const intensity: CardioIntensity = day?.cardio_intensity === 'moderado' ? 'moderado' : 'leve';
  return { minMinutes, maxMinutes, intensity };
}

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
