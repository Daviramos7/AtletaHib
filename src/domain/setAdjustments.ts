// + série / − série durante o treino. Mexe só no REALIZADO (linhas do rascunho da sessão);
// o plano-base e o snapshot strength_plan, tirado no início da sessão, não mudam.
import { hasSetExecution, isDurationExercise } from './exerciseTracking';

export type SetRow = Record<string, any>;

/** Série "com dados": marcada como feita ou editada pelo usuário. Valores pré-preenchidos do plano não contam. */
export function setRowHasData(row: SetRow | null | undefined) {
  return Boolean(row?.done || row?.edited);
}

/** Acrescenta uma série ao fim do exercício, sugerindo carga/reps (ou duração) da última série feita. */
export function addSetToExercise(rows: SetRow[], exerciseEntryId: unknown, uniqueSuffix: string = String(Date.now())): SetRow[] {
  const key = String(exerciseEntryId);
  const group = rows.filter((row) => String(row.exercise_entry_id) === key);
  if (!group.length) return rows;

  const reference = [...group].reverse().find((row) => row.done && hasSetExecution(row)) ?? group[group.length - 1];
  const duration = isDurationExercise(reference);
  const nextNumber = group.length + 1;
  const newRow: SetRow = {
    ...reference,
    rowId: `${key}-extra-${uniqueSuffix}`,
    set_number: nextNumber,
    reps: duration ? 0 : reference.reps,
    load_kg: duration ? 0 : reference.load_kg,
    duration_seconds: duration ? reference.duration_seconds ?? null : null,
    done: false,
    edited: false,
    completed_at: null,
    notes: '',
    added_in_session: true,
    exercise: { ...reference.exercise },
  };

  const lastIndex = rows.reduce((last, row, index) => (String(row.exercise_entry_id) === key ? index : last), -1);
  return renumber([...rows.slice(0, lastIndex + 1), newRow, ...rows.slice(lastIndex + 1)], key);
}

/** Última série do exercício: é a que "− série" remove. Null quando só resta uma (o exercício não some por aqui). */
export function removableSetFor(rows: SetRow[], exerciseEntryId: unknown): SetRow | null {
  const group = rows.filter((row) => String(row.exercise_entry_id) === String(exerciseEntryId));
  return group.length > 1 ? group[group.length - 1] : null;
}

export function removeSetRow(rows: SetRow[], rowId: unknown): SetRow[] {
  const target = rows.find((row) => String(row.rowId) === String(rowId));
  if (!target) return rows;
  const key = String(target.exercise_entry_id);
  const remaining = rows.filter((row) => row !== target);
  if (!remaining.some((row) => String(row.exercise_entry_id) === key)) return rows;
  return renumber(remaining, key);
}

/** Linhas que representam o plano: as séries acrescentadas na sessão não entram no snapshot planejado. */
export function plannedRowsOnly(rows: SetRow[]) {
  return rows.filter((row) => !row.added_in_session);
}

function renumber(rows: SetRow[], key: string) {
  let counter = 0;
  return rows.map((row) => {
    if (String(row.exercise_entry_id) !== key) return row;
    counter += 1;
    return row.set_number === counter ? row : { ...row, set_number: counter };
  });
}
