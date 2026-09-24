import { describe, expect, it } from 'vitest';
import { exerciseTracking, formatSetExecution, hasSetExecution, initialTrackingValues, isDurationExercise, recordedDuration, setExecutionPayload, setVolumeKg } from './exerciseTracking';
import { calculateVolumeKg, buildWeeklyStrengthProgress } from '../services/workoutService';
import { buildStrengthPlanSnapshot } from './gymSession';
import { buildExerciseProgress, buildWorkoutProgressSummary } from '../utils/strengthProgression';
import { mergeRowsPreservingInput } from './workoutDraft';
import { buildWeeklyBuckets } from '../components/StrengthHistoryView';

describe('duration tracking', () => {
  const plank = { exercise_name: 'Prancha', sets: '2', reps: '20-45s' };
  const actual = { exercise_name: 'Prancha', planned_reps: '20-45s', duration_seconds: 30, reps: 0, load_kg: 0, performed_at: '2026-09-24T12:00:00Z', set_number: 1 };
  it('uses the unit in the prescription, not a name comparison', () => {
    expect(exerciseTracking(plank)).toBe('duration');
    expect(exerciseTracking({ exercise_name: 'Outro isométrico', reps: '30 segundos' })).toBe('duration');
    expect(exerciseTracking({ exercise_name: 'Prancha', reps: '10' })).toBe('reps');
  });
  it('supports an explicit tracking type', () => expect(exerciseTracking({ tracking_type: 'duration', reps: 10 })).toBe('duration'));
  it('preserves the 2 x 20-45s prescription', () => {
    expect(initialTrackingValues(plank)).toMatchObject({ tracking_type: 'duration', duration_seconds: 20, reps: 0, load_kg: 0 });
    expect(plank).toEqual({ exercise_name: 'Prancha', sets: '2', reps: '20-45s' });
  });
  it('requires seconds, not a load', () => {
    expect(hasSetExecution(actual)).toBe(true);
    expect(setExecutionPayload({ ...actual, load_kg: undefined })).toEqual({ duration_seconds: 30, reps: 0, load_kg: 0 });
  });
  it('does not put seconds in reps or kilograms', () => expect(formatSetExecution(actual)).toBe('30 s'));
  it('historical seconds appear in history', () => expect(formatSetExecution({ ...actual, duration_seconds: 45 })).toBe('45 s'));
  it('does not infer duration from an ambiguous historical rep count', () => {
    const legacy = { planned_reps: '20-45s', reps: 30, load_kg: 0 };
    expect(recordedDuration(legacy)).toBeNull(); expect(formatSetExecution(legacy)).toContain('legado');
    expect(hasSetExecution(legacy)).toBe(false);
  });
  it('does not infer historical weight as duration or strength volume', () => {
    const legacy = { planned_reps: '20-45s', reps: 30, load_kg: 30 };
    expect(setVolumeKg(legacy)).toBe(0); expect(formatSetExecution(legacy)).not.toContain('kg');
    expect(legacy.load_kg).toBe(30);
  });
  it('normal exercises still record load and reps', () => {
    expect(setExecutionPayload({ reps: 12, load_kg: 20 })).toEqual({ reps: 12, load_kg: 20 });
    expect(formatSetExecution({ reps: 12, load_kg: 20 })).toBe('20 kg × 12 reps');
  });
  it('bodyweight reps remain valid without load', () => {
    expect(hasSetExecution({ reps: 12, load_kg: 0 })).toBe(true);
    expect(setExecutionPayload({ reps: 12 })).toEqual({ reps: 12, load_kg: 0 });
  });
  it('duration never contributes to kg x reps', () => expect(calculateVolumeKg([actual, { reps: 10, load_kg: 20 }])).toBe(200));
  it('no 1RM or load recommendation for timed sets', () => {
    const progress = buildExerciseProgress('Prancha', [actual]);
    expect(progress.bestOneRm).toBe(0); expect(progress.suggestion).not.toContain('kg');
    expect(buildExerciseProgress('Prancha', [], plank).suggestion).toContain('segundos');
  });
  it('completed timed sets count as exercise completion', () => {
    expect(buildWorkoutProgressSummary([{ ...actual, done: true }]).completedExercises).toBe(1);
  });
  it('prescription snapshots keep the unit and no planned weight', () => {
    expect(buildStrengthPlanSnapshot([actual, { ...actual, set_number: 2 }])[0]).toMatchObject({ planned_sets: 2, planned_reps: '20-45s', tracking_type: 'duration', planned_load_kg: null });
  });
  it('weekly strength statistics exclude timed volume', () => {
    expect(buildWeeklyStrengthProgress([actual], 'Prancha')).toEqual([]);
    expect(buildWeeklyBuckets([actual])[0].volume).toBe(0);
  });
  it('does not mark an old draft as a measured new duration', () => {
    const [row] = mergeRowsPreservingInput([{ rowId: '1', tracking_type: 'duration', duration_seconds: 20 }], [{ rowId: '1', reps: 30, done: true }]);
    expect(row.duration_seconds).toBeNull(); expect(row.done).toBe(false); expect(row.reps).toBe(30);
  });
  it.each([null, '', 0, -1, 1.5, 86401])('rejects invalid duration %s', (value) => {
    expect(recordedDuration({ duration_seconds: value })).toBeNull();
    expect(() => setExecutionPayload({ tracking_type: 'duration', duration_seconds: value })).toThrow();
  });
  it('duration field alone carries semantics for new records', () => expect(isDurationExercise({ duration_seconds: 30 })).toBe(true));
});
