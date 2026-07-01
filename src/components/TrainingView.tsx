import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, Save, SlidersHorizontal } from 'lucide-react';
import { resetPersonalizedTrainingPlan, updateExercise } from '../services/trainingService';
import { calculateVolumeKg, completeWorkoutWithSets, listWorkoutHistory } from '../services/workoutService';

const WEEK_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function TrainingView({ userId, profile, trainingPlan, refreshBoot, onError }) {
  const initialDay = new Date().getDay();
  const [selectedWeekday, setSelectedWeekday] = useState(initialDay);
  const [editing, setEditing] = useState(null);
  const [effort, setEffort] = useState('7');
  const [duration, setDuration] = useState('55');
  const [setRows, setSetRows] = useState([]);
  const [history, setHistory] = useState([]);
  const [savingWorkout, setSavingWorkout] = useState(false);

  const days = useMemo(() => trainingPlan?.training_days ?? [], [trainingPlan]);
  const selectedDay = days.find((day) => day.weekday === selectedWeekday) ?? days[0];

  useEffect(() => {
    if (!selectedDay?.exercise_entries) {
      setSetRows([]);
      return;
    }
    setSetRows(buildInitialSetRows(selectedDay.exercise_entries));
  }, [selectedDay]);

  useEffect(() => {
    async function loadHistory() {
      try {
        setHistory(await listWorkoutHistory(userId, 6));
      } catch (err) {
        onError(err.message);
      }
    }
    if (userId) loadHistory();
  }, [userId, onError]);

  async function saveExercise() {
    try {
      await updateExercise(editing.id, {
        exercise_name: editing.exercise_name,
        sets: editing.sets,
        reps: editing.reps,
        load_kg: editing.load_kg === '' ? null : Number(editing.load_kg),
        rest_seconds: editing.rest_seconds === '' ? null : Number(editing.rest_seconds),
        notes: editing.notes,
      });
      setEditing(null);
      await refreshBoot();
    } catch (err) {
      onError(err.message);
    }
  }

  async function handleResetPlan() {
    try {
      if (!window.confirm('Substituir o plano ativo por um plano gerado a partir do seu perfil? O plano antigo ficará arquivado.')) return;
      await resetPersonalizedTrainingPlan(userId, profile);
      await refreshBoot();
      onError('Plano personalizado regenerado a partir do seu perfil.');
    } catch (err) {
      onError(err.message);
    }
  }

  function updateSetRow(rowId, patch) {
    setSetRows((current) => current.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)));
  }

  function copyLoadToExercise(exerciseEntryId, loadKg) {
    setSetRows((current) => current.map((row) => (
      row.exercise_entry_id === exerciseEntryId ? { ...row, load_kg: loadKg } : row
    )));
  }

  async function handleCompleteWorkout() {
    try {
      if (!selectedDay) return;
      const validSets = setRows.filter((row) => Number(row.reps) > 0);
      if (!validSets.length && selectedDay.exercise_entries?.length) {
        onError('Registre pelo menos uma série feita. Sem isso, o app não consegue medir evolução de força.');
        return;
      }

      setSavingWorkout(true);
      await completeWorkoutWithSets(userId, {
        training_day_id: selectedDay.id,
        duration_minutes: Number(duration),
        perceived_effort: Number(effort),
        notes: selectedDay.title,
        sets: validSets,
      });
      setHistory(await listWorkoutHistory(userId, 6));
      setSetRows(buildInitialSetRows(selectedDay.exercise_entries ?? []));
      onError('Treino salvo com séries, cargas e volume real.');
    } catch (err) {
      onError(err.message);
    } finally {
      setSavingWorkout(false);
    }
  }

  if (!trainingPlan) return <p>Plano ainda carregando.</p>;

  const totalVolume = calculateVolumeKg(setRows.filter((row) => Number(row.reps) > 0));
  const completedSets = setRows.filter((row) => Number(row.reps) > 0).length;

  return (
    <div>
      <div className="page-title">
        <div>
          <p className="eyebrow">Treino</p>
          <h2>{trainingPlan.name}</h2>
        </div>
        <button className="ghost-btn" onClick={handleResetPlan}><RefreshCw size={16} /> Aplicar plano atualizado</button>
      </div>

      <div className="day-tabs">
        {days.map((day) => (
          <button key={day.id} className={selectedDay?.id === day.id ? 'active' : ''} onClick={() => setSelectedWeekday(day.weekday)}>
            {WEEK_LABELS[day.weekday]}
          </button>
        ))}
      </div>

      {selectedDay && (
        <section className="panel highlight-panel">
          <p className="eyebrow">{selectedDay.type}</p>
          <h3>{selectedDay.title}</h3>
          <p>{selectedDay.notes}</p>
        </section>
      )}

      <section className="panel">
        <p className="eyebrow">Exercícios editáveis</p>
        <div className="exercise-list">
          {selectedDay?.exercise_entries?.map((ex) => (
            <div className="exercise-card" key={ex.id}>
              {editing?.id === ex.id ? (
                <div className="edit-grid">
                  <input value={editing.exercise_name} onChange={(e) => setEditing({ ...editing, exercise_name: e.target.value })} />
                  <input value={editing.sets} onChange={(e) => setEditing({ ...editing, sets: e.target.value })} placeholder="séries" />
                  <input value={editing.reps} onChange={(e) => setEditing({ ...editing, reps: e.target.value })} placeholder="reps" />
                  <input value={editing.load_kg ?? ''} onChange={(e) => setEditing({ ...editing, load_kg: e.target.value })} placeholder="kg" />
                  <input value={editing.rest_seconds ?? ''} onChange={(e) => setEditing({ ...editing, rest_seconds: e.target.value })} placeholder="descanso s" />
                  <textarea value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
                  <button className="primary-btn" onClick={saveExercise}><Save size={16} /> Salvar</button>
                  <button className="ghost-btn" onClick={() => setEditing(null)}>Cancelar</button>
                </div>
              ) : (
                <>
                  <div>
                    <span className="number-badge">{ex.position}</span>
                    <strong>{ex.exercise_name}</strong>
                    <p>{ex.sets}x {ex.reps} {ex.load_kg ? `· referência ${ex.load_kg}kg` : ''}</p>
                    <small>{ex.notes}</small>
                  </div>
                  <button className="ghost-btn" onClick={() => setEditing(ex)}>Editar</button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="chart-title-row">
          <div>
            <p className="eyebrow">Execução real de hoje</p>
            <h3>Séries, repetições e carga</h3>
          </div>
          <span className="pill"><SlidersHorizontal size={16} /> {completedSets} séries · {totalVolume.toFixed(0)} kg volume</span>
        </div>
        <p className="muted">Preencha o que você realmente fez. É daqui que sai a evolução semanal de força. Não chute carga para parecer bonito: registro falso destrói a análise.</p>

        <div className="set-log-list">
          {groupRowsByExercise(setRows).map((group) => (
            <div className="set-log-card" key={group.exercise.id}>
              <div className="set-log-head">
                <div>
                  <strong>{group.exercise.exercise_name}</strong>
                  <span>{group.exercise.sets}x {group.exercise.reps}</span>
                </div>
                <button className="link-btn" onClick={() => copyLoadToExercise(group.exercise.id, group.rows[0]?.load_kg ?? 0)}>copiar carga</button>
              </div>
              <div className="set-table">
                <span>Série</span><span>Reps</span><span>Kg</span><span>RPE</span>
                {group.rows.map((row) => (
                  <div className="set-row" key={row.rowId}>
                    <strong>{row.set_number}</strong>
                    <input type="number" min="0" value={row.reps} onChange={(e) => updateSetRow(row.rowId, { reps: e.target.value })} />
                    <input type="number" min="0" step="0.5" value={row.load_kg} onChange={(e) => updateSetRow(row.rowId, { load_kg: e.target.value })} />
                    <input type="number" min="1" max="10" value={row.perceived_effort} onChange={(e) => updateSetRow(row.rowId, { perceived_effort: e.target.value })} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel form-inline">
        <p className="eyebrow full">Salvar treino completo</p>
        <label>Duração em minutos
          <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </label>
        <label>Esforço geral 1-10
          <input type="number" min="1" max="10" value={effort} onChange={(e) => setEffort(e.target.value)} />
        </label>
        <button className="primary-btn" onClick={handleCompleteWorkout} disabled={savingWorkout}>
          <CheckCircle2 size={16} /> {savingWorkout ? 'Salvando...' : 'Salvar execução'}
        </button>
      </section>

      <section className="panel">
        <p className="eyebrow">Últimos treinos salvos</p>
        <div className="timeline">
          {history.length ? history.map((item) => (
            <div className="timeline-item" key={item.id}>
              <span>{new Date(item.performed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
              <div>
                <p>{item.notes ?? 'Treino'}</p>
                <small>{item.duration_minutes ?? '--'} min · esforço {item.perceived_effort ?? '--'}/10</small>
              </div>
            </div>
          )) : <div className="chart-empty">Nenhum treino salvo ainda.</div>}
        </div>
      </section>
    </div>
  );
}

function buildInitialSetRows(exercises) {
  return (exercises ?? []).flatMap((exercise) => {
    const setCount = Math.max(parseFirstNumber(exercise.sets) || 3, 1);
    const defaultReps = parseFirstNumber(exercise.reps) || 10;
    return Array.from({ length: setCount }, (_, index) => ({
      rowId: `${exercise.id}-${index + 1}`,
      exercise_entry_id: exercise.id,
      exercise_name: exercise.exercise_name,
      set_number: index + 1,
      planned_reps: exercise.reps,
      reps: defaultReps,
      load_kg: exercise.load_kg ?? '',
      perceived_effort: 7,
      notes: '',
      exercise,
    }));
  });
}

function groupRowsByExercise(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const existing = map.get(row.exercise_entry_id) ?? { exercise: row.exercise, rows: [] };
    existing.rows.push(row);
    map.set(row.exercise_entry_id, existing);
  });
  return [...map.values()];
}

function parseFirstNumber(value) {
  const match = String(value ?? '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}
