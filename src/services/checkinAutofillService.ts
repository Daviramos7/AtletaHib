import { buildDailyTruth } from '../domain/buildDailyTruth';

export async function loadCheckinAutofill(userId, logDate) {
  const truth = await buildDailyTruth(userId, logDate);
  const sleepMinutes = truth.sleepTruth.value;
  const steps = truth.wearableTruth.steps?.value ?? null;
  const activeKcal = truth.wearableTruth.active_kcal?.value ?? null;

  return {
    log_date: truth.date,
    sleep_hours: sleepMinutes === null ? null : Number((sleepMinutes / 60).toFixed(2)),
    sleep_minutes: sleepMinutes,
    sleep_source: sourceLabel(truth.sleepTruth),
    steps,
    steps_source: sourceLabel(truth.wearableTruth.steps),
    water_ml: truth.hydration.value,
    meals_count: truth.meals.length,
    kcal: truth.nutrition.kcal.value,
    protein_g: truth.nutrition.proteinG.value,
    carbs_g: truth.nutrition.carbsG.value,
    fat_g: truth.nutrition.fatG.value,
    macros_complete: truth.nutrition.macrosComplete,
    workout_count: truth.strengthApp.length,
    cardio_count: truth.cardio.length,
    active_kcal: activeKcal,
    wearable_source: sourceLabel(truth.wearableTruth.active_kcal),
    data_quality_score: truth.data_quality_score,
    warnings: truth.warnings,
    has_data: [sleepMinutes, steps, truth.hydration.value, truth.nutrition.kcal.value, activeKcal]
      .some((value) => value !== null) || truth.strengthApp.length > 0 || truth.cardio.length > 0,
  };
}

function sourceLabel(metric) {
  if (!metric?.source) return null;
  const state = metric.state === 'estimated' ? 'estimado' : 'registrado';
  return `${metric.source} · ${state}`;
}
