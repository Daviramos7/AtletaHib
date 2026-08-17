import { describe, expect, it } from 'vitest';
import { buildExerciseProgress, buildWorkoutProgressSummary } from './strengthProgression';

describe('progressão consciente de adaptação', () => {
  it('mantém o comportamento normal para sessões-base comparáveis', () => {
    const progress = buildExerciseProgress('Supino máquina', [
      set('new', '2026-08-17T08:00:00Z', 50, 10, 'base', { progression_allowed: true }),
      set('old', '2026-08-10T08:00:00Z', 45, 10, 'base', { progression_allowed: true }),
    ]);
    expect(progress.trendLabel).toContain('Subindo');
    expect(progress.suggestion).toContain('52.5 kg');
  });

  it('não chama redução prescrita de regressão', () => {
    const progress = buildExerciseProgress('Supino máquina', [
      set('adapted', '2026-08-17T08:00:00Z', 50, 10, 'adapted', { readinessLevel: 'baixa', progression_allowed: false }),
      set('base', '2026-08-10T08:00:00Z', 50, 10, 'base', { progression_allowed: true }),
      { ...set('base', '2026-08-10T08:01:00Z', 50, 10, 'base', { progression_allowed: true }), set_number: 2 },
    ]);
    expect(progress.trendLabel).toBe('Sessão adaptada — volume reduzido pela prontidão');
    expect(progress.suggestion).toContain('não aumente a carga');
  });

  it('marca o volume atual como não comparável quando a progressão está bloqueada', () => {
    const summary = buildWorkoutProgressSummary(
      [{ exercise_name: 'Supino máquina', load_kg: 50, reps: 10, done: true }],
      [set('base', '2026-08-10T08:00:00Z', 50, 10, 'base', { progression_allowed: true })],
      { workout_variant: 'adapted', adaptation_summary: { progression_allowed: false } },
    );
    expect(summary.diffLabel).toBe('Sessão adaptada — volume não comparável');
  });

  it('compara uma sessão normal com a última sessão realmente comparável', () => {
    const summary = buildWorkoutProgressSummary(
      [{ exercise_name: 'Supino máquina', load_kg: 55, reps: 10, done: true }],
      [
        set('adapted', '2026-08-17T08:00:00Z', 20, 5, 'adapted', { progression_allowed: false }),
        set('base', '2026-08-10T08:00:00Z', 50, 10, 'base', { progression_allowed: true }),
      ],
      { workout_variant: 'base', adaptation_summary: { progression_allowed: true } },
    );
    expect(summary.lastWorkoutVolume).toBe(500);
    expect(summary.diffLabel).toBe('+10% vs último');
  });

  it('permite progressão quando a adaptação foi apenas de cardio e o snapshot liberou progressão', () => {
    const progress = buildExerciseProgress('Supino máquina', [
      set('adapted-cardio', '2026-08-17T08:00:00Z', 50, 10, 'adapted', { progression_allowed: true }),
      set('base', '2026-08-10T08:00:00Z', 45, 10, 'base', { progression_allowed: true }),
    ]);
    expect(progress.trendLabel).toContain('Subindo');
    expect(progress.suggestion).toContain('52.5 kg');
  });
});

function set(sessionId, performedAt, load, reps, variant, adaptationSummary) {
  return {
    workout_session_id: sessionId,
    exercise_name: 'Supino máquina',
    set_number: 1,
    performed_at: performedAt,
    load_kg: load,
    reps,
    perceived_effort: 7,
    workout_variant: variant,
    adaptation_summary: adaptationSummary,
  };
}
