import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({ insertedWorkout: null as any, insertedSets: null as any, schemaError: null as any }));

vi.mock('../lib/supabaseClient', () => ({
  requireSupabase: () => ({
    from: (table: string) => {
      if (table === 'workout_exercise_sets') return {
        select: () => ({ eq: () => ({ limit: async () => ({ error: mockState.schemaError, data: [] }) }) }),
        insert: async (rows: any) => { mockState.insertedSets = rows; return { error: null }; },
      };
      if (table !== 'workout_sessions') throw new Error(`Tabela inesperada no teste: ${table}`);
      const query: any = {
        insert(row: any) {
          mockState.insertedWorkout = row;
          return query;
        },
        select() {
          return query;
        },
        async single() {
          return { data: { id: 'session-1', ...mockState.insertedWorkout }, error: null };
        },
      };
      return query;
    },
  }),
}));

import { completeStrengthForGymSession } from './workoutService';

describe('persistência do cardio_plan da Academia', () => {
  beforeEach(() => {
    mockState.insertedWorkout = null;
    mockState.insertedSets = null;
    mockState.schemaError = null;
  });

  it.each([
    [25, 20],
    [60, 20],
    [20, 20],
    [10, 10],
  ])('normaliza payload.cardio_plan de %i para %i minutos antes do insert', async (input, output) => {
    const result = await completeStrengthForGymSession('user-1', {
      training_day_id: 'day-1',
      performed_at: '2026-08-30T18:00:00-03:00',
      cardio_plan: {
        planned: true,
        activity_label: 'Esteira',
        target_minutes: input,
        intensity: 'leve',
        target_rpe: '5–6',
        notes: null,
      },
      sets: [],
    });

    expect(mockState.insertedWorkout.cardio_plan.target_minutes).toBe(output);
    expect(result.session.cardio_plan.target_minutes).toBe(output);
  });
  it('persists duration in seconds and no kilogram or repetition value', async () => {
    await completeStrengthForGymSession('user-1', { sets: [{ exercise_name: 'Prancha', planned_reps: '20-45s', duration_seconds: 30, reps: 30, load_kg: 30, set_number: 1 }] });
    expect(mockState.insertedSets[0]).toMatchObject({ duration_seconds: 30, reps: 0, load_kg: 0 });
  });
  it('blocks before creating a session when the duration migration is absent', async () => {
    mockState.schemaError = { code: '42703', message: 'missing duration_seconds' };
    await expect(completeStrengthForGymSession('user-1', { sets: [{ planned_reps: '20-45s', duration_seconds: 30 }] })).rejects.toThrow('migration');
    expect(mockState.insertedWorkout).toBeNull(); expect(mockState.insertedSets).toBeNull();
  });
  it('does not misreport network errors as missing schema', async () => {
    mockState.schemaError = new Error('Sem conexão');
    await expect(completeStrengthForGymSession('user-1', { sets: [{ planned_reps: '20-45s', duration_seconds: 30 }] })).rejects.toThrow('Sem conexão');
    expect(mockState.insertedWorkout).toBeNull();
  });
  it('normal and bodyweight sets do not require the new column', async () => {
    mockState.schemaError = { code: '42703' };
    await completeStrengthForGymSession('user-1', { sets: [{ exercise_name: 'Flexão', reps: 12, load_kg: 0, set_number: 1 }] });
    expect(mockState.insertedSets[0]).toMatchObject({ reps: 12, load_kg: 0 });
    expect(mockState.insertedSets[0]).not.toHaveProperty('duration_seconds');
  });
});
