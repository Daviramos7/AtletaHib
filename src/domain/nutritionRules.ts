import type { DataConfidence, DataOrigin, SourcedValue } from './dailyTypes';

export function mealOrigin(row: any): DataOrigin {
  const value = String(row?.import_method ?? row?.source ?? '').toLowerCase();
  if (value.includes('json') || value.includes('screenshot')) return 'json';
  if (value.includes('manual')) return 'manual';
  return 'unknown';
}

export function buildNutritionTruth(meals: any[] = []) {
  const kcalValues = meals.map((row) => numericOrNull(row.kcal)).filter(isNumber);
  const macroFields = ['protein_g', 'carbs_g', 'fat_g'] as const;
  const macroComplete = meals.length > 0 && meals.every((row) => macroFields.every((field) => numericOrNull(row[field]) !== null));
  const origin = commonOrigin(meals);
  const confidence: DataConfidence = meals.some((row) => String(row?.confidence).toLowerCase() === 'low') ? 'low' : meals.length ? 'medium' : 'low';

  return {
    kcal: sourcedSum(kcalValues, meals.length > 0, origin, confidence),
    proteinG: sourcedSum(meals.map((row) => numericOrNull(row.protein_g)).filter(isNumber), meals.length > 0, origin, confidence, macroComplete),
    carbsG: sourcedSum(meals.map((row) => numericOrNull(row.carbs_g)).filter(isNumber), meals.length > 0, origin, confidence, macroComplete),
    fatG: sourcedSum(meals.map((row) => numericOrNull(row.fat_g)).filter(isNumber), meals.length > 0, origin, confidence, macroComplete),
    macrosComplete: macroComplete,
  };
}

function sourcedSum(values: number[], hasRows: boolean, origin: DataOrigin, confidence: DataConfidence, complete = true): SourcedValue<number> {
  return {
    value: values.length ? Number(values.reduce((sum, value) => sum + value, 0).toFixed(1)) : null,
    state: !hasRows || !values.length ? 'missing' : complete ? 'present' : 'estimated',
    origin,
    source: origin === 'unknown' ? null : origin,
    confidence: !complete ? 'low' : confidence,
    includedInDailyTotals: true,
  };
}

function commonOrigin(rows: any[]): DataOrigin {
  const origins = new Set(rows.map(mealOrigin));
  return origins.size === 1 ? [...origins][0] : origins.size ? 'derived' : 'unknown';
}

function numericOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isNumber(value: number | null): value is number {
  return value !== null;
}
