import { describe, expect, it } from 'vitest';
import {
  activeDraftKey,
  activePointerKey,
  canStartNewWorkoutSession,
  clearActiveWorkoutDraft,
  createActiveWorkoutDraft,
  loadActiveWorkoutDraft,
  loadPendingWorkoutRows,
  mergeRowsPreservingInput,
  pendingDraftKey,
  resolveSessionPerformedAt,
  saveActiveWorkoutDraft,
  savePendingWorkoutRows,
  type StorageLike,
} from './workoutDraft';

describe('rascunho estável da sessão', () => {
  it('preserva identidade, startedAt e data local ao atravessar meia-noite', () => {
    const storage = new MemoryStorage();
    const startedAt = '2026-08-17T23:55:00-03:00';
    const original = createActiveWorkoutDraft({
      sessionId: 'stable-1',
      startedAt,
      sessionLocalDate: '2026-08-17',
      planDayId: 'day-1',
      planDayWeekday: 1,
      workoutVariant: 'adapted',
      recommendation: { readinessLevel: 'moderada', progression_allowed: false },
      rows: [{ rowId: 'supino-1', reps: 10, load_kg: 50, done: false }],
      selectedCardioChoice: 'Cardio pós-treino',
      duration: '',
      effort: '7',
    });
    saveActiveWorkoutDraft(storage, 'user-1', original);

    const afterMidnight = loadActiveWorkoutDraft(storage, 'user-1');
    expect(afterMidnight?.sessionId).toBe('stable-1');
    expect(afterMidnight?.startedAt).toBe(startedAt);
    expect(afterMidnight?.sessionLocalDate).toBe('2026-08-17');
    expect(afterMidnight?.workoutVariant).toBe('adapted');
    expect(afterMidnight?.recommendation).toEqual({ readinessLevel: 'moderada', progression_allowed: false });
    expect(storage.getItem(activePointerKey('user-1'))).toContain('stable-1');
    expect(storage.getItem(activeDraftKey('user-1', 'stable-1'))).toContain(startedAt);
  });

  it('restaura snapshot adaptado sem recriar séries removidas', () => {
    const storage = new MemoryStorage();
    const rows = [
      { rowId: 'leg-1', exercise_name: 'Leg press 45°', reps: 10, load_kg: 100, perceived_effort: 8, done: true },
      { rowId: 'leg-2', exercise_name: 'Leg press 45°', reps: 9, load_kg: 100, perceived_effort: 8, done: false },
    ];
    saveActiveWorkoutDraft(storage, 'user-1', createActiveWorkoutDraft({
      sessionId: 'adapted-1',
      startedAt: '2026-08-17T05:00:00-03:00',
      sessionLocalDate: '2026-08-17',
      planDayId: 'lower-a',
      planDayWeekday: 2,
      workoutVariant: 'adapted',
      recommendation: { targetSets: 2 },
      rows,
      selectedCardioChoice: '',
      duration: '',
      effort: '7',
    }));

    const restored = loadActiveWorkoutDraft(storage, 'user-1');
    expect(restored?.rows).toEqual(rows);
    expect(restored?.rows.find((row) => row.rowId === 'leg-3')).toBeUndefined();
  });

  it('preserva valores não concluídos, concluídos e exercício substituído', () => {
    const candidate = [
      { rowId: 'a-1', reps: 10, load_kg: '', perceived_effort: 7, done: false, exercise: { exercise_name: 'Supino máquina' } },
      { rowId: 'a-2', reps: 10, load_kg: '', perceived_effort: 7, done: false, exercise: { exercise_name: 'Supino máquina' } },
    ];
    const current = [
      { ...candidate[0], reps: 11, load_kg: 50, perceived_effort: 8, done: false, exercise_name: 'Supino com halteres', original_exercise_name: 'Supino máquina', exercise: { exercise_name: 'Supino com halteres' } },
      { ...candidate[1], reps: 10, load_kg: 50, perceived_effort: 8, done: true, completed_at: '2026-08-17T08:10:00Z' },
    ];
    expect(mergeRowsPreservingInput(candidate, current)).toEqual(current);
  });

  it('remove pointer e snapshot somente ao finalizar ou limpar', () => {
    const storage = new MemoryStorage();
    const draft = createActiveWorkoutDraft({
      sessionId: 'finish-1', startedAt: '2026-08-17T08:00:00Z', sessionLocalDate: '2026-08-17', planDayId: 'day-1', planDayWeekday: 1,
      workoutVariant: 'base', recommendation: null, rows: [], selectedCardioChoice: '', duration: '', effort: '7',
    });
    saveActiveWorkoutDraft(storage, 'user-1', draft);
    clearActiveWorkoutDraft(storage, 'user-1', draft.sessionId);
    expect(loadActiveWorkoutDraft(storage, 'user-1')).toBeNull();
  });

  it('não permite que usar base ou recomendado reinicie uma sessão existente', () => {
    expect(canStartNewWorkoutSession('stable-1', '2026-08-17T23:55:00-03:00')).toBe(false);
    expect(canStartNewWorkoutSession(null, null)).toBe(true);
  });

  it('finaliza depois da meia-noite com o performed_at original', () => {
    const startedAt = '2026-08-17T23:55:00-03:00';
    expect(resolveSessionPerformedAt(startedAt, new Date('2026-08-18T00:30:00-03:00'))).toBe(startedAt);
  });

  it('restaura pending draft do mesmo usuário, dia do plano e data local', () => {
    const storage = new MemoryStorage();
    const rows = [{ rowId: 'a-1', reps: 11, load_kg: 50, done: false }];
    savePendingWorkoutRows(storage, 'user-1', 'upper-a', '2026-08-17', rows, '2026-08-17T10:00:00Z');
    expect(loadPendingWorkoutRows(storage, 'user-1', 'upper-a', '2026-08-17')).toEqual(rows);
  });

  it('não restaura pending draft da semana anterior', () => {
    const storage = new MemoryStorage();
    savePendingWorkoutRows(storage, 'user-1', 'upper-a', '2026-08-17', [{ rowId: 'a-1', reps: 11 }]);
    expect(loadPendingWorkoutRows(storage, 'user-1', 'upper-a', '2026-08-24')).toEqual([]);
  });

  it('remove pending draft stale do storage', () => {
    const storage = new MemoryStorage();
    savePendingWorkoutRows(storage, 'user-1', 'upper-a', '2026-08-17', [{ rowId: 'a-1' }]);
    loadPendingWorkoutRows(storage, 'user-1', 'upper-a', '2026-08-24');
    expect(storage.getItem(pendingDraftKey('user-1', 'upper-a'))).toBeNull();
  });

  it('não permite que outro usuário acesse pending draft', () => {
    const storage = new MemoryStorage();
    const rows = [{ rowId: 'a-1', reps: 11 }];
    savePendingWorkoutRows(storage, 'user-1', 'upper-a', '2026-08-17', rows);
    expect(loadPendingWorkoutRows(storage, 'user-2', 'upper-a', '2026-08-17')).toEqual([]);
    expect(loadPendingWorkoutRows(storage, 'user-1', 'upper-a', '2026-08-17')).toEqual(rows);
  });

  it('limpar pending stale não altera sessionId nem startedAt da sessão ativa', () => {
    const storage = new MemoryStorage();
    const active = createActiveWorkoutDraft({
      sessionId: 'stable-midnight', startedAt: '2026-08-17T23:55:00-03:00', sessionLocalDate: '2026-08-17', planDayId: 'upper-a', planDayWeekday: 1,
      workoutVariant: 'adapted', recommendation: { progression_allowed: false }, rows: [{ rowId: 'a-1' }], selectedCardioChoice: '', duration: '', effort: '7',
    });
    saveActiveWorkoutDraft(storage, 'user-1', active);
    savePendingWorkoutRows(storage, 'user-1', 'upper-a', '2026-08-17', [{ rowId: 'old' }]);

    loadPendingWorkoutRows(storage, 'user-1', 'upper-a', '2026-08-24');
    expect(loadActiveWorkoutDraft(storage, 'user-1')?.sessionId).toBe('stable-midnight');
    expect(loadActiveWorkoutDraft(storage, 'user-1')?.startedAt).toBe('2026-08-17T23:55:00-03:00');
  });
});

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
