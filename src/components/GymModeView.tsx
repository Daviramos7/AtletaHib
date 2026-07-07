import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, RotateCcw, Save, Square } from 'lucide-react';
import { calculateVolumeKg, completeWorkoutWithSets, listStrengthSets, listWorkoutHistory } from '../services/workoutService';
import { listCardioSessions, saveManualCardioSession } from '../services/cardioService';
import { listWearableWorkoutSessions } from '../services/strengthWearableService';
import { getCardioOptions, getDayKindLabel, getStrengthEntries, getWeekdayLabel, isCardioDay, isRestDay, isStrengthDay, normalizeTrainingDays, resolveDayKind } from '../utils/trainingPlanUtils';
import ReadinessCard from './ReadinessCard';
import CardioPlanCard from './CardioPlanCard';
import ExerciseReplacementPanel from './ExerciseReplacementPanel';
import { ExerciseProgressMini, WorkoutProgressSummary } from './StrengthProgressCards';
import PlanEditorView from './PlanEditorView';



export default function GymModeView({ userId, trainingPlan, onError, refreshBoot }) {
  const todayKeyValue = dateKey(new Date());
  const [selectedDayId, setSelectedDayId] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [setRows, setSetRows] = useState([]);
  const [duration, setDuration] = useState('');
  const [effort, setEffort] = useState('7');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [strengthSets, setStrengthSets] = useState([]);
  const [cardios, setCardios] = useState([]);
  const [wearableSessions, setWearableSessions] = useState([]);
  const [selectedCardioChoice, setSelectedCardioChoice] = useState('');
  const [replacementOpenId, setReplacementOpenId] = useState(null);
  const [replacementReason, setReplacementReason] = useState('');
  const [mode, setMode] = useState('session');

  const days = useMemo(() => normalizeTrainingDays(trainingPlan?.training_days ?? []), [trainingPlan]);
  const todayWeekday = new Date().getDay();
  const selectedDay = days.find((day) => day.id === selectedDayId) ?? days.find((day) => day.weekdayNumber === todayWeekday) ?? days[0] ?? null;
  const dayKind = resolveDayKind(selectedDay);
  const strengthEntries = useMemo(() => getStrengthEntries(selectedDay), [selectedDay]);
  const cardioOptions = useMemo(() => getCardioOptions(selectedDay), [selectedDay]);
  const readinessPlan = useMemo(() => ({
    day: selectedDay,
    dayKind,
    strength: isStrengthDay(selectedDay),
    cardio: isCardioDay(selectedDay),
    title: selectedDay?.title,
    cardioOptions,
    strengthEntries,
  }), [cardioOptions, dayKind, selectedDay, strengthEntries]);
  const storageKey = selectedDay ? `gym-v32-draft-${userId}-${selectedDay.id}-${todayKeyValue}` : null;
  const startStorageKey = selectedDay ? `gym-v32-start-${userId}-${selectedDay.id}-${todayKeyValue}` : null;

  const load = useCallback(async () => {
    try {
      const [workoutData, cardioData, watchData, strengthSetData] = await Promise.all([
        listWorkoutHistory(userId, 6),
        listCardioSessions(userId, 20),
        listWearableWorkoutSessions(userId, 12),
        listStrengthSets(userId, 180),
      ]);
      setHistory(workoutData);
      setCardios(cardioData);
      setWearableSessions(watchData);
      setStrengthSets(strengthSetData);
    } catch (err) {
      onError(err.message);
    }
  }, [onError, userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!days.length) return;
    const today = days.find((day) => day.weekdayNumber === todayWeekday) ?? days[0];
    setSelectedDayId((current) => current ?? today.id);
  }, [days, todayWeekday]);

  useEffect(() => {
    if (!selectedDay || !storageKey) {
      setSetRows([]);
      return;
    }

    const saved = readJson(storageKey, []);
    const savedStart = startStorageKey ? localStorage.getItem(startStorageKey) : null;
    setSetRows(mergePlanWithDraft(strengthEntries, saved));
    setStartedAt(savedStart);
    setTimerRunning(Boolean(savedStart));
    setSelectedCardioChoice(cardioOptions[0]?.label ?? '');
  }, [selectedDay, storageKey, startStorageKey, strengthEntries, cardioOptions]);

  useEffect(() => {
    if (storageKey && setRows.length) localStorage.setItem(storageKey, JSON.stringify(setRows));
  }, [setRows, storageKey]);

  const todayCardios = useMemo(() => cardios.filter((item) => dateKey(new Date(item.performed_at)) === todayKeyValue), [cardios, todayKeyValue]);
  const todayWearableStrength = useMemo(() => wearableSessions.filter((item) => dateKey(new Date(item.performed_at)) === todayKeyValue), [wearableSessions, todayKeyValue]);
  const completedSets = setRows.filter((row) => row.done).length;
  const totalSets = setRows.length;
  const totalVolume = calculateVolumeKg(setRows.filter((row) => row.done && Number(row.reps) > 0));
  const canFinishSession = Boolean(startedAt || duration || (isStrengthDay(selectedDay) && setRows.some((row) => row.done)));
  const finishLabel = isStrengthDay(selectedDay) ? 'Finalizar treino' : isCardioDay(selectedDay) ? 'Finalizar cardio' : 'Salvar sessão';

  function selectDay(day) {
    setSelectedDayId(day.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startSession() {
    const now = new Date().toISOString();
    setStartedAt(now);
    setTimerRunning(true);
    setDuration('');
    if (startStorageKey) localStorage.setItem(startStorageKey, now);
    onError('Sessão iniciada.');
  }

  function stopSessionTimer() {
    if (!startedAt) return;
    const elapsed = elapsedMinutes(startedAt);
    setDuration(String(elapsed));
    setTimerRunning(false);
    // Importante: não removemos startedAt/localStorage aqui.
    // Parar o timer não pode mudar a data real de início da sessão.
    onError?.(`Timer parado em ${elapsed} min. As séries marcadas continuam salvas.`);
  }

  function updateSetRow(rowId, patch) {
    setSetRows((current) => current.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)));
  }

  function toggleSet(row) {
    updateSetRow(row.rowId, { done: !row.done, completed_at: !row.done ? new Date().toISOString() : null });
  }

  function copyLoadToExercise(exerciseEntryId, loadKg) {
    setSetRows((current) => current.map((row) => row.exercise_entry_id === exerciseEntryId ? { ...row, load_kg: loadKg } : row));
  }

  function substituteExercise(exerciseEntryId, replacementName, meta: any = {}) {
    if (!replacementName) return;

    setSetRows((current) => current.map((row) => {
      if (row.exercise_entry_id !== exerciseEntryId) return row;

      const original = row.original_exercise_name ?? row.exercise_name;
      const reasonLabel = meta.reasonLabel ? `Motivo: ${meta.reasonLabel}` : null;
      const focus = meta.focus ? `Foco: ${meta.focus}` : null;
      const detail = meta.detail ?? null;

      return {
        ...row,
        original_exercise_name: original,
        exercise_name: replacementName,
        substitution_reason: meta.reasonLabel ?? null,
        substitution_detail: detail,
        notes: [
          `Substituído de ${original} por ${replacementName}`,
          reasonLabel,
          focus,
          detail,
        ].filter(Boolean).join(' · '),
        exercise: { ...row.exercise, exercise_name: replacementName },
      };
    }));

    setReplacementOpenId(null);
  }

  function undoSubstitution(exerciseEntryId) {
    setSetRows((current) => current.map((row) => {
      if (row.exercise_entry_id !== exerciseEntryId || !row.original_exercise_name) return row;

      return {
        ...row,
        exercise_name: row.original_exercise_name,
        original_exercise_name: null,
        substitution_reason: null,
        substitution_detail: null,
        notes: '',
        exercise: { ...row.exercise, exercise_name: row.original_exercise_name },
      };
    }));
    setReplacementOpenId(null);
  }

  function resetDraft() {
    if (!window.confirm('Limpar marcações deste treino?')) return;
    if (storageKey) localStorage.removeItem(storageKey);
    if (startStorageKey) localStorage.removeItem(startStorageKey);
    setSetRows(buildInitialSetRows(strengthEntries));
    setStartedAt(null);
    setTimerRunning(false);
  }

  async function finishWorkout() {
    if (!selectedDay) return;
    const validSets = setRows.filter((row) => row.done && Number(row.reps) > 0);

    if (isStrengthDay(selectedDay) && !validSets.length) {
      onError('Marque pelo menos uma série como concluída.');
      return;
    }

    if (isStrengthDay(selectedDay) && validSets.length < setRows.length) {
      const shouldContinue = window.confirm(`Você marcou ${validSets.length}/${setRows.length} séries. Finalizar mesmo assim?`);
      if (!shouldContinue) return;
    }

    try {
      setSaving(true);
      if (validSets.length) {
        await completeWorkoutWithSets(userId, {
          training_day_id: selectedDay.id,
          duration_minutes: Number(duration || 0) || elapsedMinutes(startedAt) || 30,
          perceived_effort: Number(effort || 7),
          notes: `${selectedDay.title}${isCardioDay(selectedDay) ? ' · cardio planejado' : ''}`,
          sets: validSets.map((row) => ({
            ...row,
            exercise_name: row.exercise_name,
            notes: [row.notes, row.original_exercise_name ? `Original: ${row.original_exercise_name}` : null].filter(Boolean).join(' · ') || null,
          })),
        });

        if (isCardioDay(selectedDay)) {
          const shouldSaveCardio = window.confirm('Também registrar o cardio planejado deste dia?');
          if (shouldSaveCardio) {
            const suggestedMinutes = selectedCardioChoice?.match(/(\d+)\s*min/i)?.[1] ?? '';
            const manualMinutes = window.prompt('Quantos minutos de cardio você fez? Teto recomendado: 20 min.', suggestedMinutes ? String(Math.min(Number(suggestedMinutes), 20)) : '20');
            const minutes = Math.max(Number(manualMinutes || 0), 0);

            if (minutes > 20 && !window.confirm(`Você registrou ${minutes} min. O plano recomenda no máximo 20 min. Salvar o valor real mesmo assim?`)) return;

            if (minutes > 0) {
              await saveManualCardioSession(userId, {
                performed_at: startedAt ?? new Date().toISOString(),
                activity_type: inferCardioActivityType(selectedCardioChoice || selectedDay.title),
                activity_label: selectedCardioChoice || selectedDay.title || 'Cardio pós-treino',
                duration_minutes: minutes,
                notes: `${selectedDay.title} · cardio pós-treino registrado pela Academia · kcal não informada`,
              });
            }
          }
        }
      } else if (isCardioDay(selectedDay)) {
        const minutes = Number(duration || 0) || elapsedMinutes(startedAt) || 20;
        if (minutes > 20 && !window.confirm(`Você registrou ${minutes} min. O plano recomenda no máximo 20 min. Salvar o valor real mesmo assim?`)) return;
        await saveManualCardioSession(userId, {
          performed_at: startedAt ?? new Date().toISOString(),
          activity_type: inferCardioActivityType(selectedCardioChoice || selectedDay.title),
          activity_label: selectedCardioChoice || selectedDay.title || 'Cardio',
          duration_minutes: minutes,
          notes: `${selectedDay.title} · registrado pela Academia · kcal não informada`,
        });
      }

      if (storageKey) localStorage.removeItem(storageKey);
      if (startStorageKey) localStorage.removeItem(startStorageKey);
      setSetRows(buildInitialSetRows(strengthEntries));
      setStartedAt(null);
      setTimerRunning(false);
      setDuration('');
      await load();
      onError('Sessão salva.');
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  }


  if (!trainingPlan) return <p>Plano ainda carregando.</p>;

  if (mode === 'editor') {
    return (
      <div className="simple-page gym-v32-page">
        <div className="simple-hero gym-v32-hero">
          <div>
            <p className="eyebrow">Editor de plano</p>
            <h2>{selectedDay?.title ?? 'Plano semanal'}</h2>
            <p>Altere dias, exercícios, séries, reps e cardio sem apagar histórico.</p>
          </div>
          <div className="gym-hero-actions-v37">
            <button className="ghost-btn" type="button" onClick={() => setMode('session')}>Voltar ao treino</button>
          </div>
        </div>

        <section className="simple-panel gym-day-picker">
          <p className="eyebrow">Escolha o dia</p>
          <div className="gym-day-cards">
            {days.map((day) => <button key={day.id} type="button" className={selectedDay?.id === day.id ? 'active' : ''} onClick={() => selectDay(day)}><strong>{getWeekdayLabel(day.weekdayNumber)}</strong><span>{getDayKindLabel(resolveDayKind(day))}</span></button>)}
          </div>
        </section>

        <PlanEditorView
          userId={userId}
          trainingPlan={trainingPlan}
          selectedDayId={selectedDay?.id}
          onError={onError}
          refreshBoot={refreshBoot}
        />
      </div>
    );
  }

  return (
    <div className="simple-page gym-v32-page">
      <div className="simple-hero gym-v32-hero">
        <div>
          <p className="eyebrow">{selectedDay ? getWeekdayLabel(selectedDay.weekdayNumber) : 'Treino'}</p>
          <h2>{selectedDay?.title ?? 'Sem treino'}</h2>
          <p>{getDayKindLabel(dayKind)}</p>
        </div>
        <div className="gym-hero-actions-v37">
          <button className="ghost-btn" type="button" onClick={() => setMode('editor')}>Editar plano</button>
          {startedAt ? (
            <>
              <button className="primary-btn" type="button" disabled><Clock3 size={16} /> {timerRunning ? elapsedMinutes(startedAt) : Number(duration || 0)} min</button>
              {timerRunning ? (
                <button className="ghost-btn timer-stop-v393" type="button" onClick={stopSessionTimer}><Square size={15} /> Parar</button>
              ) : (
                <span className="session-frozen-v40">timer parado</span>
              )}
            </>
          ) : (
            <button className="primary-btn" type="button" onClick={startSession}><Clock3 size={16} /> Iniciar</button>
          )}
          {canFinishSession && (
            <button className="primary-btn finish-session-v394" type="button" onClick={finishWorkout} disabled={saving}>
              <Save size={16} /> {finishLabel}
            </button>
          )}
        </div>
      </div>

      <section className="simple-panel gym-day-picker">
        <p className="eyebrow">Semana</p>
        <div className="gym-day-cards">
          {days.map((day) => <button key={day.id} type="button" className={selectedDay?.id === day.id ? 'active' : ''} onClick={() => selectDay(day)}><strong>{getWeekdayLabel(day.weekdayNumber)}</strong><span>{getDayKindLabel(resolveDayKind(day))}</span></button>)}
        </div>
      </section>

      <section className="simple-panel gym-plan-summary">
        <div className="today-binary-grid">
          <StatusMini label="Força" active={isStrengthDay(selectedDay)} />
          <StatusMini label="Cardio" active={isCardioDay(selectedDay)} />
        </div>
      </section>

      <ReadinessCard userId={userId} todayPlan={readinessPlan} onError={onError} compact />

      {isStrengthDay(selectedDay) && (
        <WorkoutProgressSummary currentRows={setRows} strengthSets={strengthSets} />
      )}

      {isRestDay(selectedDay) && <section className="simple-panel"><h3>Descanso</h3><p className="muted-text">Hoje é recuperação. Caminhada leve é opcional.</p></section>}

      {isCardioDay(selectedDay) && (
        <CardioPlanCard
          cardioSessions={cardios}
          cardioOptions={cardioOptions}
          selectedCardioChoice={selectedCardioChoice}
          onSelectCardioChoice={setSelectedCardioChoice}
        />
      )}

      {isStrengthDay(selectedDay) && (
        <section className="simple-panel gym-log-panel-v32">
          <div className="gym-log-top-v32">
            <button className="ghost-btn" type="button" onClick={resetDraft}><RotateCcw size={16} /> Limpar</button>
            <div><p className="eyebrow">Treino</p><h3>{completedSets}/{totalSets} séries</h3><span>{Math.round(totalVolume)} kg</span></div>
            <button className="primary-btn" type="button" onClick={finishWorkout} disabled={saving}><Save size={16} /> Finish</button>
          </div>

          <div className="hevy-exercise-list-v32">
            {groupRowsByExercise(setRows).map((group) => (
              <article className="hevy-card-v32" key={group.exerciseEntryId}>
                <div className="hevy-card-head-v32">
                  <div>
                    <strong>{group.exerciseName}</strong>
                    <span>{group.rows.length} sets</span>
                    {group.originalName && <small>Original: {group.originalName}</small>}
                  </div>
                  <div className="replacement-actions-v332">
                    {group.originalName && (
                      <button className="undo-replace-v332" type="button" onClick={() => undoSubstitution(group.exerciseEntryId)}>
                        Desfazer
                      </button>
                    )}
                    <button
                      className="replace-toggle-v32"
                      type="button"
                      onClick={() => {
                        setReplacementReason('');
                        setReplacementOpenId((current) => current === group.exerciseEntryId ? null : group.exerciseEntryId);
                      }}
                    >
                      Trocar
                    </button>
                  </div>
                </div>

                {replacementOpenId === group.exerciseEntryId && (
                  <ExerciseReplacementPanel
                    exerciseName={group.exerciseName}
                    selectedReason={replacementReason}
                    onReasonChange={setReplacementReason}
                    onCancel={() => setReplacementOpenId(null)}
                    onConfirm={(replacementName, meta) => substituteExercise(group.exerciseEntryId, replacementName, meta)}
                  />
                )}

                <ExerciseProgressMini exerciseName={group.exerciseName} strengthSets={strengthSets} />

                <div className="hevy-rest-v32">Descanso: {formatRest(group.rows[0]?.exercise?.rest_seconds)} · <button type="button" onClick={() => copyLoadToExercise(group.exerciseEntryId, group.rows[0]?.load_kg ?? 0)}>copiar kg</button></div>

                <div className="hevy-table-v32">
                  <div className="hevy-header-v32"><span>Set</span><span>Kg</span><span>Reps</span><span>RPE</span><span></span></div>
                  {group.rows.map((row) => (
                    <div className={`hevy-row-v32 ${row.done ? 'done' : ''}`} key={row.rowId}>
                      <strong>{row.set_number}</strong>
                      <input type="number" min="0" step="0.5" value={row.load_kg} onChange={(event) => updateSetRow(row.rowId, { load_kg: event.target.value })} />
                      <input type="number" min="0" value={row.reps} onChange={(event) => updateSetRow(row.rowId, { reps: event.target.value })} />
                      <input type="number" min="1" max="10" value={row.perceived_effort} onChange={(event) => updateSetRow(row.rowId, { perceived_effort: event.target.value })} />
                      <button className="check-v32" type="button" onClick={() => toggleSet(row)}>{row.done ? <CheckCircle2 size={19} /> : <span />}</button>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="session-fields-v32">
            <label>Duração<input type="number" min="1" value={duration || (startedAt && timerRunning ? elapsedMinutes(startedAt) : '')} onChange={(event) => setDuration(event.target.value)} /></label>
            <label>Esforço<input type="number" min="1" max="10" value={effort} onChange={(event) => setEffort(event.target.value)} /></label>
          </div>
        </section>
      )}

      <section className="simple-panel centralized-json-note-v364">
        <div>
          <p className="eyebrow">Importação por JSON</p>
          <h3>Treino do relógio agora fica em Registrar &gt; JSON</h3>
          <p>A Academia fica focada no treino, séries, carga e progressão. O JSON do Mi Fitness/relógio entra pela central única.</p>
        </div>
        <span className="pill">centralizado</span>
      </section>

      <section className="simple-panel history-simple">
        <div><p className="eyebrow">Hoje</p><h3>Resumo</h3></div>
        <div className="today-binary-grid">
          <StatusMini label="Cardios registrados" value={todayCardios.length} />
          <StatusMini label="Prints relógio" value={todayWearableStrength.length} />
          <StatusMini label="Treinos salvos" value={history.length} />
        </div>
      </section>
    </div>
  );
}

function StatusMini({ label, active = false, value = undefined }) {
  const display = value !== undefined ? value : active ? 'Sim' : 'Não';
  return <div className={`status-tile ${active || Number(value) > 0 ? 'active' : ''}`}><span>{label}</span><strong>{display}</strong></div>;
}

function buildInitialSetRows(exercises) {
  return (exercises ?? []).flatMap((exercise) => {
    const setCount = Math.max(parseFirstNumber(exercise.sets) || 3, 1);
    const defaultReps = parseFirstNumber(exercise.reps) || 10;
    return Array.from({ length: setCount }, (_, index) => ({ rowId: `${exercise.id}-${index + 1}`, exercise_entry_id: exercise.id, exercise_name: exercise.exercise_name, original_exercise_name: null, set_number: index + 1, planned_reps: exercise.reps, reps: defaultReps, load_kg: exercise.load_kg ?? '', perceived_effort: 7, done: false, completed_at: null, notes: '', exercise }));
  });
}

function mergePlanWithDraft(exercises, savedRows) {
  const savedById = new Map((savedRows ?? []).map((row) => [row.rowId, row]));
  return buildInitialSetRows(exercises).map((fresh) => {
    const saved = savedById.get(fresh.rowId);
    if (!saved || typeof saved !== 'object') return fresh;
    const savedRow = saved as Record<string, any>;
    const exerciseName = String(savedRow.exercise_name || fresh.exercise_name);
    return { ...fresh, ...savedRow, exercise_name: exerciseName, exercise: { ...fresh.exercise, exercise_name: exerciseName } };
  });
}

function groupRowsByExercise(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const existing = map.get(row.exercise_entry_id) ?? { exerciseEntryId: row.exercise_entry_id, exerciseName: row.exercise_name, originalName: row.original_exercise_name, rows: [] };
    existing.exerciseName = row.exercise_name;
    existing.originalName = row.original_exercise_name;
    existing.rows.push(row);
    map.set(row.exercise_entry_id, existing);
  });
  return [...map.values()];
}

function inferCardioActivityType(label) {
  const text = String(label ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (text.includes('futebol')) return 'other';
  if (text.includes('esteira')) return 'treadmill';
  if (text.includes('corrida') || text.includes('trote')) return 'outdoor_run';
  if (text.includes('caminhada')) return 'walk';
  if (text.includes('bike') || text.includes('bicicleta')) return 'bike';
  if (text.includes('escada')) return 'stairs';
  if (text.includes('eliptico')) return 'elliptical';
  return 'other';
}

function readJson(key, fallback) { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
function parseFirstNumber(value) { const match = String(value ?? '').match(/\d+/); return match ? Number(match[0]) : 0; }
function elapsedMinutes(startedAt) { if (!startedAt) return 0; const start = new Date(startedAt).getTime(); if (Number.isNaN(start)) return 0; return Math.max(Math.round((Date.now() - start) / 60000), 1); }
function dateKey(date) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
function formatRest(seconds) { const total = Number(seconds || 0); if (!total) return '90s'; if (total < 60) return `${total}s`; const minutes = Math.floor(total / 60); const remainder = total % 60; return remainder ? `${minutes}min ${remainder}s` : `${minutes}min`; }
