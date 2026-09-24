export type ExerciseTracking = 'duration' | 'reps';

/** Explicit tracking wins; older plans already encode time with a seconds suffix, not an exercise-name special case. */
export function exerciseTracking(row: any): ExerciseTracking {
  if (row?.tracking_type === 'duration' || row?.tracking_type === 'reps') return row.tracking_type;
  if (row?.duration_seconds != null && row.duration_seconds !== '') return 'duration';
  const prescription = row?.planned_reps ?? row?.exercise?.reps ?? row?.reps;
  return /\d\s*(?:s|seg\.?|segundos?)\s*$/i.test(String(prescription ?? '')) ? 'duration' : 'reps';
}

export function isDurationExercise(row: any) { return exerciseTracking(row) === 'duration'; }
export function recordedDuration(row: any): number | null {
  const value = row?.duration_seconds;
  if (value === '' || value == null) return null;
  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds > 0 && seconds <= 86400 ? seconds : null;
}
export function hasSetExecution(row: any) {
  return isDurationExercise(row) ? recordedDuration(row) !== null : Number(row?.reps) > 0;
}
export function setVolumeKg(row: any) {
  return isDurationExercise(row) ? 0 : Number(row?.load_kg || 0) * Number(row?.reps || 0);
}
export function formatSetExecution(row: any) {
  if (isDurationExercise(row)) return recordedDuration(row) === null
    ? 'Duração não registrada (legado)' : `${recordedDuration(row)} s`;
  return `${Number(row?.load_kg || 0)} kg × ${Number(row?.reps || 0)} reps`;
}
export function initialTrackingValues(exercise: any) {
  const duration = isDurationExercise(exercise);
  const first = Number(String(exercise?.reps ?? '').match(/\d+/)?.[0]) || (duration ? 20 : 10);
  return { tracking_type: exerciseTracking(exercise), reps: duration ? 0 : first,
    load_kg: duration ? 0 : exercise?.load_kg ?? '', duration_seconds: duration ? first : null };
}
export function setExecutionPayload(row: any) {
  if (isDurationExercise(row)) {
    const seconds = recordedDuration(row);
    if (seconds === null) throw new Error('Informe a duração da série em segundos.');
    return { reps: 0, load_kg: 0, duration_seconds: seconds };
  }
  return { reps: Number(row.reps), load_kg: Number(row.load_kg || 0) };
}
