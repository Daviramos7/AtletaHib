import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({ insertedWorkout: null as any }));

vi.mock('../lib/supabaseClient', () => ({
  requireSupabase: () => ({
    from: (table: string) => {
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
});
