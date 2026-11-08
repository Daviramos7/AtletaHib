import { describe, expect, it } from 'vitest';
import { addSetToExercise, plannedRowsOnly, removableSetFor, removeSetRow, setRowHasData } from './setAdjustments';
import { buildStrengthPlanSnapshot } from './gymSession';
import { createActiveWorkoutDraft, loadActiveWorkoutDraft, saveActiveWorkoutDraft, type StorageLike } from './workoutDraft';

function repsRow(entry: string, setNumber: number, overrides: Record<string, unknown> = {}) {
  return {
    rowId: `${entry}-${setNumber}`, exercise_entry_id: entry, exercise_name: entry === 'supino' ? 'Supino máquina' : 'Remada baixa',
    set_number: setNumber, planned_reps: '8-12', tracking_type: 'reps', reps: 10, load_kg: '', duration_seconds: null,
    perceived_effort: 7, done: false, completed_at: null, notes: '', exercise: { id: entry, reps: '8-12' }, ...overrides,
  };
}

function plankRow(setNumber: number, overrides: Record<string, unknown> = {}) {
  return {
    rowId: `prancha-${setNumber}`, exercise_entry_id: 'prancha', exercise_name: 'Prancha', set_number: setNumber,
    planned_reps: '20-45s', tracking_type: 'duration', reps: 0, load_kg: 0, duration_seconds: 20,
    done: false, completed_at: null, notes: '', exercise: { id: 'prancha', reps: '20-45s' }, ...overrides,
  };
}

const ROWS = [
  repsRow('supino', 1, { load_kg: 40, reps: 10, done: true }),
  repsRow('supino', 2, { load_kg: 42.5, reps: 8, done: true }),
  repsRow('supino', 3),
  repsRow('remada', 1),
];

describe('+ série', () => {
  it('acrescenta no fim do exercício, sugerindo carga e reps da última série FEITA', () => {
    const result = addSetToExercise(ROWS, 'supino', 'x');
    const supino = result.filter((row) => row.exercise_entry_id === 'supino');
    expect(supino).toHaveLength(4);
    expect(supino[3]).toMatchObject({ rowId: 'supino-extra-x', set_number: 4, load_kg: 42.5, reps: 8, done: false, edited: false, added_in_session: true });
    // A remada continua depois do supino, intacta.
    expect(result[4]).toBe(ROWS[3]);
  });

  it('sem série feita, sugere a partir da última série do exercício', () => {
    const result = addSetToExercise([repsRow('remada', 1, { load_kg: 30, reps: 12 })], 'remada', 'y');
    expect(result[1]).toMatchObject({ set_number: 2, load_kg: 30, reps: 12 });
  });

  it('vale para exercício por tempo: copia a duração em segundos, sem kg nem reps', () => {
    const result = addSetToExercise([plankRow(1, { duration_seconds: 45, done: true })], 'prancha', 'z');
    expect(result[1]).toMatchObject({ set_number: 2, duration_seconds: 45, reps: 0, load_kg: 0, done: false });
  });

  it('não muda nada para exercício inexistente', () => {
    expect(addSetToExercise(ROWS, 'nao-existe')).toBe(ROWS);
  });

  it('não altera o plano: o snapshot planejado ignora séries acrescentadas', () => {
    const result = addSetToExercise(ROWS, 'supino', 'x');
    expect(buildStrengthPlanSnapshot(plannedRowsOnly(result))).toEqual(buildStrengthPlanSnapshot(ROWS));
  });
});

describe('− série', () => {
  it('remove a última série do exercício e renumera', () => {
    const target = removableSetFor(ROWS, 'supino');
    expect(target?.rowId).toBe('supino-3');
    const result = removeSetRow(ROWS, target?.rowId);
    expect(result.filter((row) => row.exercise_entry_id === 'supino').map((row) => row.set_number)).toEqual([1, 2]);
  });

  it('série vazia (pré-preenchida pelo plano) não tem dados; feita ou editada tem', () => {
    expect(setRowHasData(repsRow('supino', 3))).toBe(false);
    expect(setRowHasData(repsRow('supino', 3, { done: true }))).toBe(true);
    expect(setRowHasData(repsRow('supino', 3, { edited: true }))).toBe(true);
  });

  it('nunca remove a última série restante (o exercício não some por aqui)', () => {
    expect(removableSetFor(ROWS, 'remada')).toBeNull();
    expect(removeSetRow(ROWS, 'remada-1')).toBe(ROWS);
  });

  it('remover uma série acrescentada volta ao estado anterior', () => {
    const added = addSetToExercise(ROWS, 'supino', 'x');
    const back = removeSetRow(added, removableSetFor(added, 'supino')?.rowId);
    expect(back.map((row) => [row.rowId, row.set_number])).toEqual(ROWS.map((row) => [row.rowId, row.set_number]));
  });
});

describe('persistência no rascunho da sessão', () => {
  it('série acrescentada e série removida sobrevivem a recarregar a página', () => {
    const storage = memoryStorage();
    let rows = addSetToExercise(ROWS, 'supino', 'x');
    rows = removeSetRow(rows, 'remada-1');
    rows = addSetToExercise(rows, 'remada', 'y');
    rows = removeSetRow(rows, 'remada-1');

    const draft = createActiveWorkoutDraft({
      sessionId: 's-1', startedAt: '2026-11-11T20:30:00-03:00', sessionLocalDate: '2026-11-11', planDayId: 'upper',
      planDayWeekday: 3, workoutVariant: 'base', recommendation: null, rows, selectedCardioChoice: '', duration: '',
      effort: '', persistedWorkoutSessionId: null, strengthStatus: 'active', cardioStatus: 'pending',
      selectionKind: 'manual', cardioPlan: null, strengthPlan: buildStrengthPlanSnapshot(ROWS),
    } as any);
    saveActiveWorkoutDraft(storage, 'user-1', draft);

    const restored = loadActiveWorkoutDraft(storage, 'user-1');
    expect(restored?.rows.map((row) => [row.rowId, row.set_number])).toEqual([
      ['supino-1', 1], ['supino-2', 2], ['supino-3', 3], ['supino-extra-x', 4], ['remada-extra-y', 1],
    ]);
    expect(restored?.strengthPlan).toEqual(buildStrengthPlanSnapshot(ROWS));
  });
});

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
    removeItem: (key) => { map.delete(key); },
    get length() { return map.size; },
    key: (index) => [...map.keys()][index] ?? null,
  } as StorageLike;
}
