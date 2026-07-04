import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { createExerciseEntry, deleteExerciseEntry, reorderExerciseEntries, updateExercise, updateTrainingDay } from '../services/trainingService';
import { getDayKindLabel, getWeekdayLabel, normalizeTrainingDays, resolveDayKind } from '../utils/trainingPlanUtils';

const DAY_KIND_OPTIONS = [
  { id: 'strength', label: 'Força' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'strength_cardio', label: 'Força + cardio' },
  { id: 'rest', label: 'Descanso' },
];

const EMPTY_EXERCISE = {
  exercise_name: '',
  sets: '3',
  reps: '10',
  load_kg: '',
  rest_seconds: '90',
  notes: '',
};

export default function PlanEditorView(props: any) {
  const {
    userId,
    trainingPlan,
    selectedDayId,
    onError,
    refreshBoot,
  } = props;

  const days = useMemo(() => normalizeTrainingDays(trainingPlan?.training_days ?? []), [trainingPlan]);
  const selectedDay = days.find((day) => day.id === selectedDayId) ?? days[0] ?? null;
  const exercises = useMemo(() => selectedDay?.exercise_entries ?? [], [selectedDay]);

  const [dayForm, setDayForm] = useState(buildDayForm(selectedDay));
  const [exerciseDrafts, setExerciseDrafts] = useState({});
  const [newExercise, setNewExercise] = useState(EMPTY_EXERCISE);
  const [savingDay, setSavingDay] = useState(false);
  const [savingExerciseId, setSavingExerciseId] = useState(null);

  useEffect(() => {
    setDayForm(buildDayForm(selectedDay));
    setExerciseDrafts({});
    setNewExercise(EMPTY_EXERCISE);
  }, [selectedDay]);

  async function refreshPlan() {
    await refreshBoot?.();
  }

  async function saveDay() {
    if (!selectedDay) return;

    try {
      setSavingDay(true);
      await updateTrainingDay(selectedDay.id, {
        title: dayForm.title,
        notes: dayForm.notes,
        day_kind: dayForm.day_kind,
        cardio_options: parseCardioOptions(dayForm.cardio_options_text),
      });
      await refreshPlan();
      onError?.('Dia do plano atualizado.');
    } catch (err: any) {
      onError?.(err.message);
    } finally {
      setSavingDay(false);
    }
  }

  async function saveExercise(exercise) {
    const draft = getExerciseDraft(exercise);

    try {
      setSavingExerciseId(exercise.id);
      await updateExercise(exercise.id, {
        position: draft.position,
        exercise_name: draft.exercise_name,
        sets: draft.sets,
        reps: draft.reps,
        load_kg: numberOrNull(draft.load_kg),
        rest_seconds: numberOrNull(draft.rest_seconds),
        notes: draft.notes?.trim() || null,
      });
      await refreshPlan();
      onError?.('Exercício atualizado.');
    } catch (err: any) {
      onError?.(err.message);
    } finally {
      setSavingExerciseId(null);
    }
  }

  async function addExercise() {
    if (!selectedDay) return;

    if (!newExercise.exercise_name.trim()) {
      onError?.('Informe o nome do exercício.');
      return;
    }

    try {
      await createExerciseEntry(userId, selectedDay.id, {
        ...newExercise,
        position: exercises.length + 1,
      });
      setNewExercise(EMPTY_EXERCISE);
      await refreshPlan();
      onError?.('Exercício adicionado.');
    } catch (err: any) {
      onError?.(err.message);
    }
  }

  async function removeExercise(exercise) {
    const ok = window.confirm(`Remover "${exercise.exercise_name}" do plano? O histórico já salvo não será apagado.`);
    if (!ok) return;

    try {
      await deleteExerciseEntry(exercise.id);
      await refreshPlan();
      onError?.('Exercício removido do plano.');
    } catch (err: any) {
      onError?.(err.message);
    }
  }

  async function moveExercise(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= exercises.length) return;

    const nextOrder = [...exercises];
    const [current] = nextOrder.splice(index, 1);
    nextOrder.splice(nextIndex, 0, current);

    try {
      await reorderExerciseEntries(nextOrder);
      await refreshPlan();
      onError?.('Ordem atualizada.');
    } catch (err: any) {
      onError?.(err.message);
    }
  }

  function getExerciseDraft(exercise) {
    return exerciseDrafts[exercise.id] ?? buildExerciseForm(exercise);
  }

  function updateExerciseDraft(exerciseId, patch) {
    setExerciseDrafts((current) => ({
      ...current,
      [exerciseId]: {
        ...(current[exerciseId] ?? buildExerciseForm(exercises.find((item) => item.id === exerciseId))),
        ...patch,
      },
    }));
  }

  if (!selectedDay) {
    return (
      <section className="simple-panel plan-editor-empty-v37">
        <h3>Nenhum dia de treino encontrado</h3>
        <p className="muted-text">O plano ainda não foi carregado ou precisa ser recriado no perfil.</p>
      </section>
    );
  }

  const isCardioEnabled = dayForm.day_kind === 'cardio' || dayForm.day_kind === 'strength_cardio';

  return (
    <div className="plan-editor-v37">
      <section className="simple-panel plan-editor-day-v37">
        <div className="simple-section-head">
          <div>
            <p className="eyebrow">Editor de plano</p>
            <h3>{getWeekdayLabel(selectedDay.weekdayNumber)} · {getDayKindLabel(dayForm.day_kind)}</h3>
            <span>Editar aqui não apaga histórico de treinos já salvos.</span>
          </div>
          <button className="primary-btn" type="button" onClick={saveDay} disabled={savingDay}>
            <Save size={16} /> Salvar dia
          </button>
        </div>

        <div className="plan-day-form-v37">
          <label>Título
            <input value={dayForm.title} onChange={(event) => setDayForm({ ...dayForm, title: event.target.value })} />
          </label>

          <label>Tipo do dia
            <select value={dayForm.day_kind} onChange={(event) => setDayForm({ ...dayForm, day_kind: event.target.value })}>
              {DAY_KIND_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>

          <label className="full">Notas do dia
            <textarea value={dayForm.notes} onChange={(event) => setDayForm({ ...dayForm, notes: event.target.value })} placeholder="Ex.: foco em técnica, treino curto, evitar impacto..." />
          </label>

          {isCardioEnabled && (
            <label className="full">Cardio do dia
              <textarea value={dayForm.cardio_options_text} onChange={(event) => setDayForm({ ...dayForm, cardio_options_text: event.target.value })} placeholder="Uma opção por linha. Ex.: Cardio pós-treino | 10-20min leve" />
              <small>Formato: Nome | descrição. Uma opção por linha.</small>
            </label>
          )}
        </div>
      </section>

      <section className="simple-panel plan-editor-exercises-v37">
        <div className="simple-section-head">
          <div>
            <p className="eyebrow">Exercícios</p>
            <h3>{exercises.length} no plano</h3>
          </div>
        </div>

        {exercises.length === 0 ? (
          <p className="muted-text">Nenhum exercício neste dia.</p>
        ) : (
          <div className="exercise-editor-list-v37">
            {exercises.map((exercise, index) => {
              const draft = getExerciseDraft(exercise);
              return (
                <article className="exercise-editor-card-v37" key={exercise.id}>
                  <div className="exercise-editor-head-v37">
                    <strong>{index + 1}. {exercise.exercise_name}</strong>
                    <div>
                      <button className="ghost-icon-v37" type="button" onClick={() => moveExercise(index, -1)} disabled={index === 0}><ArrowUp size={16} /></button>
                      <button className="ghost-icon-v37" type="button" onClick={() => moveExercise(index, 1)} disabled={index === exercises.length - 1}><ArrowDown size={16} /></button>
                      <button className="danger-icon-v37" type="button" onClick={() => removeExercise(exercise)}><Trash2 size={16} /></button>
                    </div>
                  </div>

                  <div className="exercise-editor-grid-v37">
                    <label className="wide">Nome
                      <input value={draft.exercise_name} onChange={(event) => updateExerciseDraft(exercise.id, { exercise_name: event.target.value })} />
                    </label>
                    <label>Séries
                      <input value={draft.sets} onChange={(event) => updateExerciseDraft(exercise.id, { sets: event.target.value })} />
                    </label>
                    <label>Reps
                      <input value={draft.reps} onChange={(event) => updateExerciseDraft(exercise.id, { reps: event.target.value })} />
                    </label>
                    <label>Kg inicial
                      <input type="number" min="0" step="0.5" value={draft.load_kg} onChange={(event) => updateExerciseDraft(exercise.id, { load_kg: event.target.value })} />
                    </label>
                    <label>Descanso s
                      <input type="number" min="0" step="5" value={draft.rest_seconds} onChange={(event) => updateExerciseDraft(exercise.id, { rest_seconds: event.target.value })} />
                    </label>
                    <label className="wide">Notas
                      <input value={draft.notes} onChange={(event) => updateExerciseDraft(exercise.id, { notes: event.target.value })} placeholder="máquina, alternativa, cuidado..." />
                    </label>
                  </div>

                  <button className="ghost-btn" type="button" onClick={() => saveExercise(exercise)} disabled={savingExerciseId === exercise.id}>
                    <Save size={16} /> Salvar exercício
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="simple-panel plan-editor-add-v37">
        <div className="simple-section-head">
          <div>
            <p className="eyebrow">Adicionar</p>
            <h3>Novo exercício</h3>
          </div>
        </div>

        <div className="exercise-editor-grid-v37">
          <label className="wide">Nome
            <input value={newExercise.exercise_name} onChange={(event) => setNewExercise({ ...newExercise, exercise_name: event.target.value })} placeholder="Ex.: Leg press 45°" />
          </label>
          <label>Séries
            <input value={newExercise.sets} onChange={(event) => setNewExercise({ ...newExercise, sets: event.target.value })} />
          </label>
          <label>Reps
            <input value={newExercise.reps} onChange={(event) => setNewExercise({ ...newExercise, reps: event.target.value })} />
          </label>
          <label>Kg inicial
            <input type="number" min="0" step="0.5" value={newExercise.load_kg} onChange={(event) => setNewExercise({ ...newExercise, load_kg: event.target.value })} />
          </label>
          <label>Descanso s
            <input type="number" min="0" step="5" value={newExercise.rest_seconds} onChange={(event) => setNewExercise({ ...newExercise, rest_seconds: event.target.value })} />
          </label>
          <label className="wide">Notas
            <input value={newExercise.notes} onChange={(event) => setNewExercise({ ...newExercise, notes: event.target.value })} />
          </label>
        </div>

        <button className="primary-btn" type="button" onClick={addExercise}>
          <Plus size={16} /> Adicionar exercício
        </button>
      </section>
    </div>
  );
}

function buildDayForm(day) {
  if (!day) {
    return {
      title: '',
      day_kind: 'strength',
      notes: '',
      cardio_options_text: '',
    };
  }

  return {
    title: day.title ?? '',
    day_kind: resolveDayKind(day),
    notes: day.notes ?? '',
    cardio_options_text: cardioOptionsToText(day.cardio_options),
  };
}

function buildExerciseForm(exercise: any = {}) {
  return {
    position: exercise.position ?? 1,
    exercise_name: exercise.exercise_name ?? '',
    sets: exercise.sets ?? '3',
    reps: exercise.reps ?? '10',
    load_kg: exercise.load_kg ?? '',
    rest_seconds: exercise.rest_seconds ?? '',
    notes: exercise.notes ?? '',
  };
}

function cardioOptionsToText(value) {
  const options = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? safeJson(value, [])
      : [];

  return options
    .map((option) => `${option.label ?? option.name ?? 'Cardio'} | ${option.description ?? option.notes ?? 'Cardio planejado.'}`)
    .join('\n');
}

function parseCardioOptions(text) {
  return String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...description] = line.split('|');
      return {
        label: label.trim() || 'Cardio',
        description: description.join('|').trim() || 'Cardio planejado.',
      };
    });
}

function safeJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
