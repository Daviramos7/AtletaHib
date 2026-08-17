import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, RotateCcw, Save, Square } from 'lucide-react';
import { calculateVolumeKg, completeWorkoutWithSets, deleteWorkoutSession, listStrengthSets, listWorkoutHistory } from '../services/workoutService';
import { listCardioSessions, saveManualCardioSession } from '../services/cardioService';
import { listWearableWorkoutSessions } from '../services/strengthWearableService';
import { getCheckin } from '../services/checkinService';
import { listSleepSessions } from '../services/sleepService';
import { getCardioOptions, getDayKindLabel, getStrengthEntries, getWeekdayLabel, isCardioDay, isRestDay, isStrengthDay, normalizeTrainingDays, resolveDayKind } from '../utils/trainingPlanUtils';
import CardioPlanCard from './CardioPlanCard';
import AdaptiveWorkoutCard from './AdaptiveWorkoutCard';
import ExerciseReplacementPanel from './ExerciseReplacementPanel';
import { ExerciseProgressMini, WorkoutProgressSummary } from './StrengthProgressCards';
import PlanEditorView from './PlanEditorView';
import { localDateKey } from '../utils/dates';
import { buildAdaptiveWorkoutRecommendation, selectWorkoutVariant } from '../domain/adaptiveWorkout';
import { resetPersonalizedTrainingPlan } from '../services/trainingService';
import {
  clearActiveWorkoutDraft,
  clearPendingWorkoutRows,
  canStartNewWorkoutSession,
  createActiveWorkoutDraft,
  createStableSessionId,
  loadActiveWorkoutDraft,
  loadPendingWorkoutRows,
  mergeRowsPreservingInput,
  resolveSessionPerformedAt,
  saveActiveWorkoutDraft,
  savePendingWorkoutRows,
} from '../domain/workoutDraft';



export default function GymModeView({ userId, profile, trainingPlan, onError, refreshBoot, onNavigate }) {
  const todayKeyValue = localDateKey(new Date());
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
  const [checkin, setCheckin] = useState(null);
  const [sleepSessions, setSleepSessions] = useState([]);
  const [recommendationLoading, setRecommendationLoading] = useState(true);
  const [recommendationDetailsOpen, setRecommendationDetailsOpen] = useState(false);
  const [sessionVariant, setSessionVariant] = useState('base');
  const [sessionRecommendation, setSessionRecommendation] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [sessionLocalDate, setSessionLocalDate] = useState(null);
  const [sessionPlanDayId, setSessionPlanDayId] = useState(null);
  const [rowsPlanDayId, setRowsPlanDayId] = useState(null);
  const [rowsPendingLocalDate, setRowsPendingLocalDate] = useState(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [regeneratingPlan, setRegeneratingPlan] = useState(false);

  const days = useMemo(() => normalizeTrainingDays(trainingPlan?.training_days ?? []), [trainingPlan]);
  const todayWeekday = new Date().getDay();
  const selectedDay = days.find((day) => day.id === selectedDayId) ?? days.find((day) => day.weekdayNumber === todayWeekday) ?? days[0] ?? null;
  const dayKind = resolveDayKind(selectedDay);
  const strengthEntries = useMemo(() => getStrengthEntries(selectedDay), [selectedDay]);
  const cardioOptions = useMemo(() => getCardioOptions(selectedDay), [selectedDay]);
  const selectedToday = selectedDay?.weekdayNumber === todayWeekday;
  const recommendation = useMemo(() => buildAdaptiveWorkoutRecommendation({
    checkin,
    sleepSessions,
    completedSets: strengthSets,
    baseExercises: strengthEntries,
    cardioPlanned: isCardioDay(selectedDay),
    now: new Date(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }), [checkin, selectedDay, sleepSessions, strengthEntries, strengthSets]);
  const load = useCallback(async () => {
    try {
      setRecommendationLoading(true);
      const [workoutData, cardioData, watchData, strengthSetData, checkinData, sleepData] = await Promise.all([
        listWorkoutHistory(userId, 6),
        listCardioSessions(userId, 20),
        listWearableWorkoutSessions(userId, 12),
        listStrengthSets(userId, 180),
        getCheckin(userId, todayKeyValue),
        listSleepSessions(userId, 7),
      ]);
      setHistory(workoutData);
      setCardios(cardioData);
      setWearableSessions(watchData);
      setStrengthSets(strengthSetData);
      setCheckin(checkinData);
      setSleepSessions(sleepData);
    } catch (err) {
      onError(err.message);
    } finally {
      setRecommendationLoading(false);
    }
  }, [onError, todayKeyValue, userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!days.length || draftHydrated) return;
    const defaultDay = days.find((day) => day.weekdayNumber === todayWeekday) ?? days[0];
    let activeDraft = loadActiveWorkoutDraft(localStorage, userId);

    if (!activeDraft) {
      activeDraft = migrateLegacyActiveDraft(localStorage, userId, days);
    }

    const activeDay = activeDraft ? days.find((day) => String(day.id) === activeDraft.planDayId) : null;
    if (activeDraft && activeDay) {
      setSelectedDayId(activeDay.id);
      setRowsPlanDayId(activeDraft.planDayId);
      setSetRows(activeDraft.rows);
      setStartedAt(activeDraft.startedAt);
      setTimerRunning(!activeDraft.duration);
      setDuration(activeDraft.duration);
      setEffort(activeDraft.effort || '7');
      setSelectedCardioChoice(activeDraft.selectedCardioChoice || '');
      setSessionVariant(activeDraft.workoutVariant);
      setSessionRecommendation(activeDraft.recommendation);
      setSessionId(activeDraft.sessionId);
      setSessionLocalDate(activeDraft.sessionLocalDate);
      setSessionPlanDayId(activeDraft.planDayId);
    } else {
      if (activeDraft) clearActiveWorkoutDraft(localStorage, userId, activeDraft.sessionId);
      setSelectedDayId(defaultDay?.id ?? null);
    }
    setDraftHydrated(true);
  }, [days, draftHydrated, todayKeyValue, todayWeekday, userId]);

  useEffect(() => {
    if (!draftHydrated || !selectedDay || sessionId) return;
    if (!strengthEntries.length) {
      setSetRows([]);
      setRowsPlanDayId(String(selectedDay.id));
      setRowsPendingLocalDate(todayKeyValue);
      return;
    }
    let pendingRows = loadPendingWorkoutRows(localStorage, userId, String(selectedDay.id), todayKeyValue);
    if (!pendingRows.length) pendingRows = migrateLegacyPendingRows(localStorage, userId, selectedDay, todayKeyValue);
    setSetRows(mergePlanWithDraft(strengthEntries, pendingRows));
    setRowsPlanDayId(String(selectedDay.id));
    setRowsPendingLocalDate(todayKeyValue);
    setStartedAt(null);
    setTimerRunning(false);
    setSessionVariant('base');
    setSessionRecommendation(null);
    setSelectedCardioChoice(cardioOptions[0]?.label ?? '');
  }, [cardioOptions, draftHydrated, selectedDay, sessionId, strengthEntries, todayKeyValue, userId]);

  useEffect(() => {
    if (!draftHydrated || sessionId || !selectedDay || rowsPlanDayId !== String(selectedDay.id) || rowsPendingLocalDate !== todayKeyValue || !setRows.length) return;
    savePendingWorkoutRows(localStorage, userId, String(selectedDay.id), todayKeyValue, setRows);
  }, [draftHydrated, rowsPendingLocalDate, rowsPlanDayId, selectedDay, sessionId, setRows, todayKeyValue, userId]);

  useEffect(() => {
    if (!draftHydrated || !sessionId || !startedAt || !sessionLocalDate || !sessionPlanDayId) return;
    saveActiveWorkoutDraft(localStorage, userId, createActiveWorkoutDraft({
      sessionId,
      startedAt,
      sessionLocalDate,
      planDayId: String(sessionPlanDayId),
      planDayWeekday: selectedDay?.weekdayNumber ?? null,
      workoutVariant: sessionVariant === 'adapted' ? 'adapted' : 'base',
      recommendation: sessionRecommendation,
      rows: setRows,
      selectedCardioChoice,
      duration,
      effort,
    }));
  }, [draftHydrated, duration, effort, selectedCardioChoice, selectedDay?.weekdayNumber, sessionId, sessionLocalDate, sessionPlanDayId, sessionRecommendation, sessionVariant, setRows, startedAt, userId]);

  const todayCardios = useMemo(() => cardios.filter((item) => localDateKey(new Date(item.performed_at)) === todayKeyValue), [cardios, todayKeyValue]);
  const todayWearableStrength = useMemo(() => wearableSessions.filter((item) => localDateKey(new Date(item.performed_at)) === todayKeyValue), [wearableSessions, todayKeyValue]);
  const completedSets = setRows.filter((row) => row.done).length;
  const totalSets = setRows.length;
  const totalVolume = calculateVolumeKg(setRows.filter((row) => row.done && Number(row.reps) > 0));
  const canFinishSession = Boolean(startedAt || duration || (isStrengthDay(selectedDay) && setRows.some((row) => row.done)));
  const finishLabel = isStrengthDay(selectedDay) ? 'Finalizar treino' : isCardioDay(selectedDay) ? 'Finalizar cardio' : 'Salvar sessão';

  function selectDay(day) {
    if (sessionId && startedAt && String(day.id) !== String(sessionPlanDayId)) {
      onError?.('Finalize ou limpe a sessão ativa antes de abrir outro dia do plano.');
      return;
    }
    setSelectedDayId(day.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function requestStartSession() {
    if (!selectedToday) {
      startSession('base');
      return;
    }
    if (!recommendation.checkinValid) {
      setRecommendationDetailsOpen(true);
      onError('Faça o check-in da manhã ou escolha explicitamente usar o treino-base.');
      return;
    }
    startSession('recommended');
  }

  function startSession(choice) {
    if (!canStartNewWorkoutSession(sessionId, startedAt)) {
      onError('A sessão já está em andamento. O horário original foi preservado.');
      return;
    }

    const now = new Date().toISOString();
    const useRecommendation = choice === 'recommended' && selectedToday && recommendation.checkinValid;
    const variant = useRecommendation ? recommendation.recommendedVariant : 'base';
    const candidateRows = useRecommendation
      ? buildSetRowsFromVariant(selectWorkoutVariant(strengthEntries, recommendation, 'adapted'))
      : buildInitialSetRows(strengthEntries);
    const rows = rowsPlanDayId === String(selectedDay?.id) ? mergeRowsPreservingInput(candidateRows, setRows) : candidateRows;
    const recommendationSummary = selectedToday && recommendation.checkinValid ? buildRecommendationSummary(recommendation) : null;
    const stableSessionId = createStableSessionId(new Date(now));
    const localSessionDate = localDateKey(new Date(now));
    const planDayId = String(selectedDay?.id ?? '');
    const draft = createActiveWorkoutDraft({
      sessionId: stableSessionId,
      startedAt: now,
      sessionLocalDate: localSessionDate,
      planDayId,
      planDayWeekday: selectedDay?.weekdayNumber ?? null,
      workoutVariant: variant,
      recommendation: recommendationSummary,
      rows,
      selectedCardioChoice,
      duration: '',
      effort,
    });

    setSetRows(rows);
    setRowsPlanDayId(planDayId);
    setRowsPendingLocalDate(localSessionDate);
    setStartedAt(now);
    setTimerRunning(true);
    setDuration('');
    setSessionVariant(variant);
    setSessionRecommendation(recommendationSummary);
    setSessionId(stableSessionId);
    setSessionLocalDate(localSessionDate);
    setSessionPlanDayId(planDayId);
    clearPendingWorkoutRows(localStorage, userId, planDayId);
    saveActiveWorkoutDraft(localStorage, userId, draft);
    onError(useRecommendation ? 'Treino recomendado iniciado.' : 'Treino-base iniciado.');
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
    if (sessionId) clearActiveWorkoutDraft(localStorage, userId, sessionId);
    if (selectedDay?.id) clearPendingWorkoutRows(localStorage, userId, String(selectedDay.id));
    setSetRows(buildInitialSetRows(strengthEntries));
    setRowsPlanDayId(selectedDay?.id ? String(selectedDay.id) : null);
    setRowsPendingLocalDate(todayKeyValue);
    setStartedAt(null);
    setTimerRunning(false);
    setSessionVariant('base');
    setSessionRecommendation(null);
    setSessionId(null);
    setSessionLocalDate(null);
    setSessionPlanDayId(null);
  }

  async function regeneratePlan() {
    if (sessionId && startedAt) {
      onError?.('Finalize ou limpe a sessão ativa antes de gerar um novo plano.');
      return;
    }

    if (!profile) {
      onError?.('Não foi possível carregar o perfil para gerar o novo plano.');
      return;
    }

    const confirmed = window.confirm(
      'Gerar um novo plano Upper/Lower? O plano ativo atual será arquivado. O histórico de treinos, séries, cargas e repetições será preservado.',
    );
    if (!confirmed) return;

    try {
      setRegeneratingPlan(true);
      await resetPersonalizedTrainingPlan(userId, { ...profile, weekly_strength_days: 4 });
      setSelectedDayId(null);
      await refreshBoot?.();
      onError?.('Plano atualizado: novo Upper/Lower gerado e ativado. O plano anterior foi arquivado e o histórico foi preservado.');
    } catch (err) {
      onError?.(err.message);
    } finally {
      setRegeneratingPlan(false);
    }
  }

  async function finishWorkout() {
    if (!selectedDay || saving) return;
    const validSets = setRows.filter((row) => row.done && Number(row.reps) > 0);
    const sessionStartedAt = resolveSessionPerformedAt(startedAt);

    if (isStrengthDay(selectedDay) && !validSets.length) {
      onError('Marque pelo menos uma série como concluída.');
      return;
    }

    if (isStrengthDay(selectedDay) && validSets.length < setRows.length) {
      const shouldContinue = window.confirm(`Você marcou ${validSets.length}/${setRows.length} séries. Finalizar mesmo assim?`);
      if (!shouldContinue) return;
    }

    let createdWorkoutSessionId = null;
    try {
      setSaving(true);

      const cardioPayload = await resolveCardioPayloadBeforePersisting({
        selectedDay,
        validSets,
        sessionStartedAt,
        selectedCardioChoice,
        duration,
        recommendedCardioMinutes: sessionRecommendation?.cardioMinutes,
      });

      if (validSets.length) {
        const completedWorkout = await completeWorkoutWithSets(userId, {
          training_day_id: selectedDay.id,
          performed_at: sessionStartedAt,
          duration_minutes: Number(duration || 0) || elapsedMinutes(sessionStartedAt) || 30,
          perceived_effort: Number(effort || 7),
          notes: `${selectedDay.title}${isCardioDay(selectedDay) ? ' · cardio planejado' : ''}`,
          workout_variant: sessionVariant,
          readiness_score: sessionRecommendation?.readinessScore ?? null,
          adaptation_summary: sessionRecommendation,
          sets: validSets.map((row) => ({
            ...row,
            exercise_name: row.exercise_name,
            notes: [row.notes, row.original_exercise_name ? `Original: ${row.original_exercise_name}` : null].filter(Boolean).join(' · ') || null,
          })),
        });
        createdWorkoutSessionId = completedWorkout.session.id;
      }

      if (cardioPayload) {
        await saveManualCardioSession(userId, cardioPayload);
      }

      if (sessionId) clearActiveWorkoutDraft(localStorage, userId, sessionId);
      if (selectedDay?.id) clearPendingWorkoutRows(localStorage, userId, String(selectedDay.id));
      setSetRows(buildInitialSetRows(strengthEntries));
      setRowsPlanDayId(selectedDay?.id ? String(selectedDay.id) : null);
      setRowsPendingLocalDate(todayKeyValue);
      setStartedAt(null);
      setTimerRunning(false);
      setDuration('');
      setSessionVariant('base');
      setSessionRecommendation(null);
      setSessionId(null);
      setSessionLocalDate(null);
      setSessionPlanDayId(null);
      await load();
      onError('Sessão salva.');
    } catch (err) {
      if (createdWorkoutSessionId) {
        try {
          await deleteWorkoutSession(userId, createdWorkoutSessionId);
        } catch (rollbackError) {
          onError(`Falha ao salvar a sessão e o rollback também falhou. Revise o histórico antes de tentar novamente: ${rollbackError.message}`);
          return;
        }
      }
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

        <section className="simple-panel plan-regenerate-v412">
          <div className="simple-section-head">
            <div>
              <p className="eyebrow">Plano semanal</p>
              <h3>Gerar novo plano</h3>
              <p className="muted-text">O plano atual será arquivado e todo o histórico de treinos, séries, cargas e repetições será preservado.</p>
            </div>
            <button className="primary-btn" type="button" onClick={regeneratePlan} disabled={regeneratingPlan}>
              <RotateCcw size={16} /> {regeneratingPlan ? 'Gerando...' : 'Gerar novo plano'}
            </button>
          </div>
        </section>

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
                <button className="ghost-btn timer-stop-v393" type="button" onClick={stopSessionTimer}><Square size={15} /> Parar timer</button>
              ) : (
                <span className="session-frozen-v40">timer parado</span>
              )}
            </>
          ) : (
            <button className="primary-btn" type="button" onClick={requestStartSession}><Clock3 size={16} /> Iniciar</button>
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

      <AdaptiveWorkoutCard
        recommendation={recommendation}
        loading={recommendationLoading}
        started={Boolean(startedAt)}
        activeVariant={sessionVariant}
        activeStartedAt={startedAt}
        activeSessionLocalDate={sessionLocalDate}
        selectedToday={selectedToday}
        showDetails={recommendationDetailsOpen}
        onToggleDetails={() => setRecommendationDetailsOpen((open) => !open)}
        onStartRecommended={() => startSession('recommended')}
        onUseBase={() => startSession('base')}
        onCheckin={() => onNavigate?.('register', { registerTab: 'checkin', returnTo: 'gym' })}
      />

      {isStrengthDay(selectedDay) && (
        <WorkoutProgressSummary
          currentRows={setRows}
          strengthSets={strengthSets}
          currentSession={{ workout_variant: sessionVariant, adaptation_summary: sessionRecommendation }}
        />
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
            <button className="primary-btn" type="button" onClick={finishWorkout} disabled={saving}><Save size={16} /> Finalizar</button>
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

async function resolveCardioPayloadBeforePersisting({ selectedDay, validSets, sessionStartedAt, selectedCardioChoice, duration, recommendedCardioMinutes }) {
  if (!isCardioDay(selectedDay)) return null;

  if (validSets.length) {
    const shouldSaveCardio = window.confirm('Também registrar o cardio planejado deste dia?');
    if (!shouldSaveCardio) return null;
  }

  const suggestedMinutes = selectedCardioChoice?.match(/(\d+)\s*min/i)?.[1] ?? '';
  const defaultMinutes = recommendedCardioMinutes !== null && recommendedCardioMinutes !== undefined
    ? String(Math.min(Number(recommendedCardioMinutes), 20))
    : suggestedMinutes ? String(Math.min(Number(suggestedMinutes), 20)) : '20';
  const minutes = validSets.length
    ? Math.max(Number(window.prompt('Quantos minutos de cardio você fez? Teto recomendado: 20 min.', defaultMinutes) || 0), 0)
    : Number(duration || 0) || elapsedMinutes(sessionStartedAt) || Number(recommendedCardioMinutes || 0) || 20;

  if (minutes > 20 && !window.confirm(`Você registrou ${minutes} min. O plano recomenda no máximo 20 min. Salvar o valor real mesmo assim?`)) {
    throw new Error('Sessão cancelada antes de salvar: cardio acima de 20 min não confirmado.');
  }

  if (minutes <= 0) return null;

  return {
    performed_at: sessionStartedAt,
    activity_type: inferCardioActivityType(selectedCardioChoice || selectedDay.title),
    activity_label: selectedCardioChoice || selectedDay.title || (validSets.length ? 'Cardio pós-treino' : 'Cardio'),
    duration_minutes: minutes,
    notes: `${selectedDay.title} · registrado pela Academia · kcal não informada`,
  };
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

function buildSetRowsFromVariant(items) {
  return (items ?? []).flatMap((item) => {
    if (item.targetSets <= 0) return [];
    const exercise = item.exercise;
    const defaultReps = parseFirstNumber(exercise.reps) || 10;
    return Array.from({ length: item.targetSets }, (_, index) => ({
      rowId: `${exercise.id}-${index + 1}`,
      exercise_entry_id: exercise.id,
      exercise_name: exercise.exercise_name,
      original_exercise_name: null,
      set_number: index + 1,
      planned_reps: exercise.reps,
      reps: defaultReps,
      load_kg: exercise.load_kg ?? '',
      perceived_effort: 7,
      done: false,
      completed_at: null,
      notes: item.reason ? `Ajuste diário: ${item.reason}` : '',
      exercise,
    }));
  });
}

function buildRecommendationSummary(recommendation) {
  return {
    readinessLevel: recommendation.readinessLevel,
    readinessScore: recommendation.readinessScore,
    workoutMode: recommendation.workoutMode,
    volumeAdjustment: recommendation.volumeAdjustment,
    reasons: recommendation.reasons.slice(0, 4),
    adjustments: recommendation.recommendations.slice(0, 4),
    intensityGuidance: recommendation.intensityGuidance,
    cardioMinutes: recommendation.cardioGuidance.minutes,
    estimatedMinutes: recommendation.estimatedMinutes,
    progression_allowed: recommendation.progressionAllowed,
  };
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

function parseFirstNumber(value) { const match = String(value ?? '').match(/\d+/); return match ? Number(match[0]) : 0; }
function elapsedMinutes(startedAt) { if (!startedAt) return 0; const start = new Date(startedAt).getTime(); if (Number.isNaN(start)) return 0; return Math.max(Math.round((Date.now() - start) / 60000), 1); }
function formatRest(seconds) { const total = Number(seconds || 0); if (!total) return '90s'; if (total < 60) return `${total}s`; const minutes = Math.floor(total / 60); const remainder = total % 60; return remainder ? `${minutes}min ${remainder}s` : `${minutes}min`; }

function migrateLegacyActiveDraft(storage, userId, days) {
  let selected = null;
  for (const day of days ?? []) {
    const prefix = `gym-v32-start-${userId}-${day.id}-`;
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const startedAt = storage.getItem(key);
      const timestamp = new Date(startedAt || '').getTime();
      if (!startedAt || Number.isNaN(timestamp) || (selected && timestamp <= selected.timestamp)) continue;
      selected = { day, key, startedAt, timestamp, dateSuffix: key.slice(prefix.length) };
    }
  }
  if (!selected) return null;

  const rowsKey = `gym-v32-draft-${userId}-${selected.day.id}-${selected.dateSuffix}`;
  const metaKey = `gym-v413-meta-${userId}-${selected.day.id}-${selected.dateSuffix}`;
  const rows = readJsonFromStorage(storage, rowsKey, []);
  const meta = readJsonFromStorage(storage, metaKey, null);
  const sessionId = createStableSessionId(new Date(selected.startedAt));
  const draft = createActiveWorkoutDraft({
    sessionId,
    startedAt: selected.startedAt,
    sessionLocalDate: localDateKey(new Date(selected.startedAt)),
    planDayId: String(selected.day.id),
    planDayWeekday: selected.day.weekdayNumber ?? null,
    workoutVariant: meta?.variant === 'adapted' ? 'adapted' : 'base',
    recommendation: meta?.recommendation ?? null,
    rows: Array.isArray(rows) ? rows : [],
    selectedCardioChoice: getCardioOptions(selected.day)[0]?.label ?? '',
    duration: '',
    effort: '7',
  });
  saveActiveWorkoutDraft(storage, userId, draft);
  storage.removeItem(selected.key);
  storage.removeItem(rowsKey);
  storage.removeItem(metaKey);
  return draft;
}

function readJsonFromStorage(storage, key, fallback) {
  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function migrateLegacyPendingRows(storage, userId, day, localDate) {
  const prefix = `gym-v32-draft-${userId}-${day.id}-`;
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  const key = keys.find((candidate) => candidate === `${prefix}${localDate}`);
  keys.filter((candidate) => candidate !== key).forEach((candidate) => storage.removeItem(candidate));
  if (!key) return [];
  const rows = readJsonFromStorage(storage, key, []);
  if (!Array.isArray(rows) || !rows.length) return [];
  savePendingWorkoutRows(storage, userId, String(day.id), localDate, rows);
  storage.removeItem(key);
  return rows;
}
