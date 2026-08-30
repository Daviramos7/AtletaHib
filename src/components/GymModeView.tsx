import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, RotateCcw, Save, Square } from 'lucide-react';
import { calculateVolumeKg, completeStrengthForGymSession, finalizeGymSession, listGymSessionHistory, listStrengthSets, updateGymSessionCardioStatus } from '../services/workoutService';
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
import { buildWeeklyGymQueue, selectionKindFor } from '../domain/weeklyGym';
import { buildCardioPlanSnapshot, buildStrengthPlanSnapshot, deriveGymSessionLifecycle, plannedVsRealized } from '../domain/gymSession';
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
  const [persistedWorkoutSessionId, setPersistedWorkoutSessionId] = useState(null);
  const [strengthStatus, setStrengthStatus] = useState<'active' | 'completed'>('active');
  const [cardioStatus, setCardioStatus] = useState<'not_planned' | 'pending' | 'awaiting_import' | 'completed' | 'skipped'>('not_planned');
  const [selectionKind, setSelectionKind] = useState<'recommended' | 'manual' | 'extra'>('manual');
  const [cardioPlan, setCardioPlan] = useState(null);
  const [sessionStrengthPlan, setSessionStrengthPlan] = useState([]);
  const [manualCardioMinutes, setManualCardioMinutes] = useState('');
  const [manualCardioDistance, setManualCardioDistance] = useState('');

  const days = useMemo(() => normalizeTrainingDays(trainingPlan?.training_days ?? []), [trainingPlan]);
  const todayWeekday = new Date().getDay();
  const selectedDay = days.find((day) => day.id === selectedDayId) ?? days.find((day) => day.weekdayNumber === todayWeekday) ?? days[0] ?? null;
  const dayKind = resolveDayKind(selectedDay);
  const strengthEntries = useMemo(() => getStrengthEntries(selectedDay), [selectedDay]);
  const cardioOptions = useMemo(() => getCardioOptions(selectedDay), [selectedDay]);
  const selectedToday = Boolean(selectedDay);
  const recommendation = useMemo(() => buildAdaptiveWorkoutRecommendation({
    checkin,
    sleepSessions,
    completedSets: strengthSets,
    baseExercises: strengthEntries,
    cardioPlanned: isCardioDay(selectedDay),
    now: new Date(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }), [checkin, selectedDay, sleepSessions, strengthEntries, strengthSets]);
  const weeklyQueue = useMemo(() => buildWeeklyGymQueue({
    planDays: days,
    workoutSessions: history,
    completedSets: strengthSets,
    checkin,
    sleepSessions,
    now: new Date(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }), [checkin, days, history, sleepSessions, strengthSets]);
  const lifecycle = deriveGymSessionLifecycle({ strengthStatus, cardioStatus, completed: false });
  const load = useCallback(async () => {
    try {
      setRecommendationLoading(true);
      const [workoutData, cardioData, watchData, strengthSetData, checkinData, sleepData] = await Promise.all([
        listGymSessionHistory(userId, 80),
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
      return { workoutData, strengthSetData, checkinData, sleepData };
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
      setPersistedWorkoutSessionId(activeDraft.persistedWorkoutSessionId ?? null);
      setStrengthStatus(activeDraft.strengthStatus ?? 'active');
      setCardioStatus(activeDraft.cardioStatus ?? 'not_planned');
      setSelectionKind(activeDraft.selectionKind ?? 'manual');
      setCardioPlan(activeDraft.cardioPlan ?? null);
      setSessionStrengthPlan(activeDraft.strengthPlan ?? []);
    } else {
      if (activeDraft) clearActiveWorkoutDraft(localStorage, userId, activeDraft.sessionId);
      setSelectedDayId(weeklyQueue.recommended?.day.id ?? defaultDay?.id ?? null);
    }
    setDraftHydrated(true);
  }, [days, draftHydrated, todayKeyValue, todayWeekday, userId, weeklyQueue.recommended?.day.id]);

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
    setPersistedWorkoutSessionId(null);
    setStrengthStatus('active');
    setCardioStatus('not_planned');
    setSelectionKind('manual');
    setCardioPlan(null);
    setSessionStrengthPlan([]);
    setSelectedCardioChoice(cardioOptions[0]?.label ?? '');
  }, [cardioOptions, draftHydrated, selectedDay, sessionId, strengthEntries, todayKeyValue, userId]);

  useEffect(() => {
    if (!draftHydrated || sessionId) return;
    const openSession = history.find((item) => !item.completed && item.strength_status === 'completed' && item.session_status === 'strength_completed');
    if (!openSession) return;
    const day = days.find((item) => String(item.id) === String(openSession.training_day_id));
    if (!day) return;
    setSelectedDayId(day.id);
    setStartedAt(openSession.performed_at);
    setTimerRunning(false);
    setDuration(String(openSession.duration_minutes ?? ''));
    setSessionVariant(openSession.workout_variant === 'adapted' ? 'adapted' : 'base');
    setSessionRecommendation(openSession.adaptation_summary ?? null);
    setSessionId(`recovered-${openSession.id}`);
    setSessionLocalDate(openSession.session_local_date ?? localDateKey(new Date(openSession.performed_at)));
    setSessionPlanDayId(String(openSession.training_day_id));
    setPersistedWorkoutSessionId(openSession.id);
    setStrengthStatus('completed');
    setCardioStatus(openSession.cardio_status ?? 'not_planned');
    setSelectionKind(openSession.selection_kind ?? 'manual');
    setCardioPlan(openSession.cardio_plan ?? null);
    setSessionStrengthPlan(openSession.strength_plan ?? []);
    setSelectedCardioChoice(openSession.cardio_plan?.activity_label ?? '');
    onError?.('Sessão pós-força recuperada. Resolva o cardio e finalize quando estiver pronto.');
  }, [days, draftHydrated, history, onError, sessionId]);

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
      persistedWorkoutSessionId,
      strengthStatus,
      cardioStatus,
      selectionKind,
      cardioPlan,
      strengthPlan: sessionStrengthPlan,
    }));
  }, [cardioPlan, cardioStatus, draftHydrated, duration, effort, persistedWorkoutSessionId, selectedCardioChoice, selectedDay?.weekdayNumber, selectionKind, sessionId, sessionLocalDate, sessionPlanDayId, sessionRecommendation, sessionStrengthPlan, sessionVariant, setRows, startedAt, strengthStatus, userId]);

  const todayCardios = useMemo(() => cardios.filter((item) => localDateKey(new Date(item.performed_at)) === todayKeyValue), [cardios, todayKeyValue]);
  const todayWearableStrength = useMemo(() => wearableSessions.filter((item) => localDateKey(new Date(item.performed_at)) === todayKeyValue), [wearableSessions, todayKeyValue]);
  const completedSets = setRows.filter((row) => row.done).length;
  const totalSets = setRows.length;
  const totalVolume = calculateVolumeKg(setRows.filter((row) => row.done && Number(row.reps) > 0));
  const canConcludeStrength = strengthStatus === 'active' && Boolean(startedAt || duration || (isStrengthDay(selectedDay) && setRows.some((row) => row.done)));

  function selectDay(day) {
    if (sessionId && startedAt && String(day.id) !== String(sessionPlanDayId)) {
      onError?.('Finalize ou limpe a sessão ativa antes de abrir outro dia do plano.');
      return;
    }
    setSelectedDayId(day.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function requestStartSession() {
    if (!confirmQueueChoice()) return;
    const isRecommended = String(weeklyQueue.recommended?.day.id) === String(selectedDay?.id)
      && !weeklyQueue.items.find((item) => String(item.day.id) === String(selectedDay?.id))?.completionCount;
    if (!recommendation.checkinValid) {
      setRecommendationDetailsOpen(true);
      onError('Faça o check-in da manhã ou escolha explicitamente usar o treino-base.');
      return;
    }
    startSession(isRecommended ? 'recommended' : 'manual');
  }

  function requestBaseSession() {
    if (!confirmQueueChoice()) return;
    startSession('base');
  }

  function confirmQueueChoice() {
    const queueItem = weeklyQueue.items.find((item) => String(item.day.id) === String(selectedDay?.id));
    const isRecommended = String(weeklyQueue.recommended?.day.id) === String(selectedDay?.id) && !queueItem?.completionCount;
    if (!isRecommended) {
      const reason = queueItem?.completionCount
        ? 'Esta sessão-base já foi concluída na semana. A repetição será salva como treino extra e não aumentará a aderência-base.'
        : queueItem?.status === 'not_ideal'
          ? 'Esta não é a melhor sessão para a recuperação atual.'
          : 'Há outra sessão recomendada para preservar sequência e recuperação.';
      if (!window.confirm(`${reason}\n\nDeseja iniciar mesmo assim?`)) return false;
    }
    return true;
  }

  function startSession(choice) {
    if (!canStartNewWorkoutSession(sessionId, startedAt)) {
      onError('A sessão já está em andamento. O horário original foi preservado.');
      return;
    }

    const now = new Date().toISOString();
    const useRecommendation = recommendation.checkinValid && choice !== 'base';
    const variant = useRecommendation ? recommendation.recommendedVariant : 'base';
    const candidateRows = useRecommendation
      ? buildSetRowsFromVariant(selectWorkoutVariant(strengthEntries, recommendation, 'adapted'))
      : buildInitialSetRows(strengthEntries);
    const rows = rowsPlanDayId === String(selectedDay?.id) ? mergeRowsPreservingInput(candidateRows, setRows) : candidateRows;
    const recommendationSummary = recommendation.checkinValid ? buildRecommendationSummary(recommendation) : null;
    const stableSessionId = createStableSessionId(new Date(now));
    const localSessionDate = localDateKey(new Date(now));
    const planDayId = String(selectedDay?.id ?? '');
    const queueRequestedKind = String(weeklyQueue.recommended?.day.id) === planDayId ? 'recommended' : 'manual';
    const nextSelectionKind = selectionKindFor(weeklyQueue, planDayId, queueRequestedKind);
    const nextCardioPlan = buildCardioPlanSnapshot({ selectedDay, selectedChoice: selectedCardioChoice, recommendedMinutes: recommendationSummary?.cardioMinutes });
    const nextStrengthPlan = buildStrengthPlanSnapshot(rows);
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
      persistedWorkoutSessionId: null,
      strengthStatus: 'active',
      cardioStatus: nextCardioPlan.planned ? 'pending' : 'not_planned',
      selectionKind: nextSelectionKind,
      cardioPlan: nextCardioPlan,
      strengthPlan: nextStrengthPlan,
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
    setPersistedWorkoutSessionId(null);
    setStrengthStatus('active');
    setCardioStatus(nextCardioPlan.planned ? 'pending' : 'not_planned');
    setSelectionKind(nextSelectionKind);
    setCardioPlan(nextCardioPlan);
    setSessionStrengthPlan(nextStrengthPlan);
    clearPendingWorkoutRows(localStorage, userId, planDayId);
    saveActiveWorkoutDraft(localStorage, userId, draft);
    onError(nextSelectionKind === 'extra' ? 'Treino extra iniciado.' : useRecommendation ? 'Treino recomendado iniciado.' : 'Treino-base iniciado.');
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
    if (persistedWorkoutSessionId) {
      onError?.('A força já foi salva. Escolha o destino do cardio e finalize a sessão; os dados registrados não serão apagados.');
      return;
    }
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
    setPersistedWorkoutSessionId(null);
    setStrengthStatus('active');
    setCardioStatus('not_planned');
    setSelectionKind('manual');
    setCardioPlan(null);
    setSessionStrengthPlan([]);
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

  async function concludeStrength() {
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

    try {
      setSaving(true);
      const snapshot = cardioPlan ?? buildCardioPlanSnapshot({ selectedDay, selectedChoice: selectedCardioChoice, recommendedMinutes: sessionRecommendation?.cardioMinutes });
      const completedWorkout = await completeStrengthForGymSession(userId, {
        training_day_id: selectedDay.id,
        performed_at: sessionStartedAt,
        session_local_date: sessionLocalDate ?? localDateKey(new Date(sessionStartedAt)),
        duration_minutes: Number(duration || 0) || elapsedMinutes(sessionStartedAt) || 30,
        perceived_effort: Number(effort || 7),
        notes: `${selectedDay.title} · força concluída`,
        workout_variant: sessionVariant,
        readiness_score: sessionRecommendation?.readinessScore ?? null,
        adaptation_summary: sessionRecommendation,
        selection_kind: selectionKind,
        strength_plan: sessionStrengthPlan.length ? sessionStrengthPlan : buildStrengthPlanSnapshot(setRows),
        cardio_plan: snapshot,
        all_rows: setRows,
        sets: validSets.map((row) => ({
          ...row,
          exercise_name: row.exercise_name,
          notes: [row.notes, row.original_exercise_name ? `Original: ${row.original_exercise_name}` : null].filter(Boolean).join(' · ') || null,
        })),
      });

      setPersistedWorkoutSessionId(completedWorkout.session.id);
      setStrengthStatus('completed');
      setCardioStatus(completedWorkout.session.cardio_status);
      setCardioPlan(snapshot);
      if (sessionId) {
        saveActiveWorkoutDraft(localStorage, userId, createActiveWorkoutDraft({
          sessionId,
          startedAt: sessionStartedAt,
          sessionLocalDate: sessionLocalDate ?? localDateKey(new Date(sessionStartedAt)),
          planDayId: String(selectedDay.id),
          planDayWeekday: selectedDay.weekdayNumber ?? null,
          workoutVariant: sessionVariant === 'adapted' ? 'adapted' : 'base',
          recommendation: sessionRecommendation,
          rows: setRows,
          selectedCardioChoice,
          duration,
          effort,
          persistedWorkoutSessionId: completedWorkout.session.id,
          strengthStatus: 'completed',
          cardioStatus: completedWorkout.session.cardio_status,
          selectionKind,
          cardioPlan: snapshot,
          strengthPlan: sessionStrengthPlan.length ? sessionStrengthPlan : buildStrengthPlanSnapshot(setRows),
        }));
      }
      setTimerRunning(false);
      await load();
      onError(snapshot.planned ? 'Força concluída. Agora registre, importe ou pule o cardio antes de finalizar a sessão.' : 'Força concluída. A sessão já pode ser finalizada.');
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function chooseCardioStatus(nextStatus) {
    if (!persistedWorkoutSessionId || saving) return;
    try {
      setSaving(true);
      await updateGymSessionCardioStatus(userId, persistedWorkoutSessionId, nextStatus);
      setCardioStatus(nextStatus);
      await load();
      onError(nextStatus === 'awaiting_import'
        ? 'Sessão marcada para aguardar o JSON do relógio. Ela pode ser finalizada agora.'
        : 'Cardio pulado sem criar execução fictícia. A sessão pode ser finalizada.');
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveManualCardio() {
    if (!persistedWorkoutSessionId || saving) return;
    const minutes = Number(manualCardioMinutes || 0);
    if (minutes <= 0) {
      onError('Informe os minutos realmente realizados.');
      return;
    }
    if (minutes > 20 && !window.confirm(`Você registrou ${minutes} min. O plano recomenda no máximo 20 min. Salvar o valor real mesmo assim?`)) return;
    try {
      setSaving(true);
      const manualActivityType = inferCardioActivityType(cardioPlan?.activity_label || selectedCardioChoice);
      await saveManualCardioSession(userId, {
        workout_session_id: persistedWorkoutSessionId,
        performed_at: resolveSessionPerformedAt(startedAt),
        activity_type: manualActivityType,
        activity_label: cardioPlan?.activity_label || selectedCardioChoice || 'Cardio pós-treino',
        duration_minutes: minutes,
        distance_km: manualCardioDistance || null,
        distance_source: manualCardioDistance ? (manualActivityType === 'treadmill' ? 'treadmill' : 'manual') : null,
        notes: `${selectedDay?.title ?? 'Treino'} · execução informada manualmente`,
      });
      setCardioStatus('completed');
      await load();
      onError('Cardio real vinculado à sessão.');
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function finishGymSession() {
    if (!persistedWorkoutSessionId || !lifecycle.canFinish || saving) return;
    try {
      setSaving(true);
      await finalizeGymSession(userId, persistedWorkoutSessionId, {
        duration_minutes: Number(duration || 0) || elapsedMinutes(resolveSessionPerformedAt(startedAt)) || 30,
      });
      if (sessionId) clearActiveWorkoutDraft(localStorage, userId, sessionId);
      if (selectedDay?.id) clearPendingWorkoutRows(localStorage, userId, String(selectedDay.id));
      const refreshed = await load();
      resetSessionState(selectedDay, strengthEntries, todayKeyValue, {
        setSetRows, setRowsPlanDayId, setRowsPendingLocalDate, setStartedAt, setTimerRunning, setDuration,
        setSessionVariant, setSessionRecommendation, setSessionId, setSessionLocalDate, setSessionPlanDayId,
        setPersistedWorkoutSessionId, setStrengthStatus, setCardioStatus, setSelectionKind, setCardioPlan,
        setSessionStrengthPlan,
        setManualCardioMinutes, setManualCardioDistance,
      });
      if (refreshed) {
        const nextQueue = buildWeeklyGymQueue({
          planDays: days,
          workoutSessions: refreshed.workoutData,
          completedSets: refreshed.strengthSetData,
          checkin: refreshed.checkinData,
          sleepSessions: refreshed.sleepData,
          now: new Date(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        setSelectedDayId(nextQueue.recommended?.day.id ?? selectedDay?.id ?? null);
      }
      onError('Sessão finalizada. Força, cardio e dados do relógio permanecem separados no histórico.');
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
          <p className="eyebrow">{persistedWorkoutSessionId ? 'Sessão em andamento' : selectedDay ? `Preferência: ${getWeekdayLabel(selectedDay.weekdayNumber)}` : 'Treino'}</p>
          <h2>{selectedDay?.title ?? 'Sem treino'}</h2>
          <p>{strengthStatus === 'completed' ? 'Força concluída · escolha o destino do cardio' : `${getDayKindLabel(dayKind)} · o dia da semana é apenas uma preferência`}</p>
        </div>
        <div className="gym-hero-actions-v37">
          <button className="ghost-btn" type="button" onClick={() => setMode('editor')}>Editar plano</button>
          {startedAt && strengthStatus === 'active' ? (
            <>
              <button className="ghost-btn" type="button" onClick={() => document.querySelector('.gym-log-panel-v32')?.scrollIntoView({ behavior: 'smooth' })}>Continuar treino</button>
              <button className="primary-btn" type="button" disabled><Clock3 size={16} /> {timerRunning ? elapsedMinutes(startedAt) : Number(duration || 0)} min</button>
              {timerRunning ? (
                <button className="ghost-btn timer-stop-v393" type="button" onClick={stopSessionTimer}><Square size={15} /> Parar timer</button>
              ) : (
                <span className="session-frozen-v40">timer parado</span>
              )}
            </>
          ) : !persistedWorkoutSessionId ? (
            <button className="primary-btn" type="button" onClick={requestStartSession}><Clock3 size={16} /> Iniciar</button>
          ) : null}
          {canConcludeStrength && (
            <button className="primary-btn finish-session-v394" type="button" onClick={concludeStrength} disabled={saving}>
              <Save size={16} /> Concluir força
            </button>
          )}
          {persistedWorkoutSessionId && lifecycle.canFinish && (
            <button className="primary-btn finish-session-v394" type="button" onClick={finishGymSession} disabled={saving}>
              <CheckCircle2 size={16} /> Finalizar sessão
            </button>
          )}
        </div>
      </div>

      <WeeklyGymQueueCard queue={weeklyQueue} selectedDayId={selectedDay?.id} activePlanDayId={sessionPlanDayId} onSelect={selectDay} />

      <section className="simple-panel gym-plan-summary">
        <div className="today-binary-grid">
          <StatusMini label="Força" active={isStrengthDay(selectedDay)} />
          <StatusMini label="Cardio" active={isCardioDay(selectedDay)} />
        </div>
      </section>

      {strengthStatus === 'active' && <AdaptiveWorkoutCard
        recommendation={recommendation}
        loading={recommendationLoading}
        started={Boolean(startedAt)}
        activeVariant={sessionVariant}
        activeStartedAt={startedAt}
        activeSessionLocalDate={sessionLocalDate}
        selectedToday={selectedToday}
        showDetails={recommendationDetailsOpen}
        onToggleDetails={() => setRecommendationDetailsOpen((open) => !open)}
        onStartRecommended={requestStartSession}
        onUseBase={requestBaseSession}
        onCheckin={() => onNavigate?.('register', { registerTab: 'checkin', returnTo: 'gym' })}
      />}

      {isStrengthDay(selectedDay) && strengthStatus === 'active' && (
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

      {isStrengthDay(selectedDay) && strengthStatus === 'active' && (
        <section className="simple-panel gym-log-panel-v32">
          <div className="gym-log-top-v32">
            <button className="ghost-btn" type="button" onClick={resetDraft}><RotateCcw size={16} /> Limpar</button>
            <div><p className="eyebrow">Treino</p><h3>{completedSets}/{totalSets} séries</h3><span>{Math.round(totalVolume)} kg</span></div>
            <button className="primary-btn" type="button" onClick={concludeStrength} disabled={!canConcludeStrength || saving}><Save size={16} /> Concluir força</button>
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

      {persistedWorkoutSessionId && strengthStatus === 'completed' && (
        <GymCardioTransition
          cardioPlan={cardioPlan}
          cardioStatus={cardioStatus}
          manualMinutes={manualCardioMinutes}
          manualDistance={manualCardioDistance}
          saving={saving}
          onMinutes={setManualCardioMinutes}
          onDistance={setManualCardioDistance}
          onSaveManual={saveManualCardio}
          onBegin={() => {
            if (!manualCardioMinutes) setManualCardioMinutes(String(cardioPlan?.target_minutes ?? 10));
            onError?.('Cardio iniciado. Ao terminar, registre o valor real ou escolha anexar o relógio depois.');
          }}
          onAwaitImport={() => chooseCardioStatus('awaiting_import')}
          onSkip={() => chooseCardioStatus('skipped')}
          onFinish={finishGymSession}
          canFinish={lifecycle.canFinish}
          onOpenImport={() => onNavigate?.('register', { registerTab: 'json', returnTo: 'gym' })}
        />
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

      <GymSessionHistory sessions={history.filter((item) => item.completed).slice(0, 8)} />
    </div>
  );
}

function WeeklyGymQueueCard({ queue, selectedDayId, activePlanDayId, onSelect }) {
  return (
    <section className="simple-panel weekly-gym-queue-v42">
      <div className="simple-section-head">
        <div>
          <p className="eyebrow">Fila semanal flexível</p>
          <h3>{queue.completedBaseCount}/{queue.targetCount} sessões-base concluídas</h3>
          <p className="muted-text">Segunda a domingo. O dia do plano é preferência; sequência, recuperação e disponibilidade definem a recomendação.</p>
        </div>
        {queue.extraCount > 0 && <span className="pill">{queue.extraCount} extra(s)</span>}
      </div>
      <div className="weekly-days-strip-v42">
        {queue.week.days.map((dateKey, index) => <span key={dateKey}><strong>{['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'][index]}</strong><small>{dateKey.slice(8, 10)}</small></span>)}
      </div>
      <div className="weekly-gym-grid-v42">
        {queue.items.map((item) => {
          const active = String(activePlanDayId ?? selectedDayId) === String(item.day.id);
          const label = item.status === 'completed' ? 'Concluído' : item.status === 'recommended' ? 'Recomendado' : item.status === 'not_ideal' ? 'Não ideal hoje' : 'Pendente';
          return (
            <button key={item.day.id} type="button" className={`${active ? 'active' : ''} status-${item.status}`} onClick={() => onSelect(item.day)}>
              <span>{item.sequenceOrder} · preferência {getWeekdayLabel(item.preferredWeekday)}</span>
              <strong>{item.day.title}</strong>
              <small>{label} · ~{item.estimatedMinutes} min</small>
            </button>
          );
        })}
      </div>
      {queue.recommended && (
        <div className="weekly-reason-v42">
          <strong>Por que {queue.recommended.day.title}?</strong>
          <span>{queue.recommended.reasons.slice(0, 3).join(' ')}</span>
        </div>
      )}
    </section>
  );
}

function GymCardioTransition({ cardioPlan, cardioStatus, manualMinutes, manualDistance, saving, onMinutes, onDistance, onSaveManual, onBegin, onAwaitImport, onSkip, onFinish, canFinish, onOpenImport }) {
  const planned = Boolean(cardioPlan?.planned);
  return (
    <section className="simple-panel gym-cardio-transition-v42">
      <div>
        <p className="eyebrow">Força concluída</p>
        <h3>{planned ? cardioPlan.activity_label || 'Cardio pós-treino' : 'Sem cardio planejado'}</h3>
        <p className="muted-text">{planned ? `${cardioPlan.target_minutes ?? '--'} min · ${cardioPlan.intensity ?? 'leve'} · RPE ${cardioPlan.target_rpe ?? '5–6'}` : 'Você pode finalizar a sessão sem criar um cardio fictício.'}</p>
      </div>
      {planned && cardioStatus === 'pending' && (
        <>
          <div className="cardio-manual-fields-v42">
            <label>Minutos reais<input type="number" min="1" value={manualMinutes} onChange={(event) => onMinutes(event.target.value)} /></label>
            <label>Distância real (km, opcional)<input type="number" min="0" step="0.01" value={manualDistance} onChange={(event) => onDistance(event.target.value)} /></label>
          </div>
          <div className="form-actions gym-cardio-actions-v42">
            <button className="primary-btn" type="button" onClick={onBegin} disabled={saving}>Fazer cardio</button>
            <button className="primary-btn" type="button" onClick={onSaveManual} disabled={saving}>Salvar cardio feito</button>
            <button className="ghost-btn" type="button" onClick={onAwaitImport} disabled={saving}>Fiz cardio — anexar relógio depois</button>
            <button className="ghost-btn" type="button" onClick={onSkip} disabled={saving}>Pular cardio</button>
          </div>
        </>
      )}
      {cardioStatus === 'awaiting_import' && (
        <div className="weekly-reason-v42"><strong>Aguardando importação</strong><span>O relógio será a verdade fisiológica. Vincule explicitamente o JSON ou mantenha a sessão finalizada enquanto aguarda.</span><button className="ghost-btn" type="button" onClick={onOpenImport}>Abrir importação JSON</button></div>
      )}
      {cardioStatus === 'completed' && <p className="success-text-v42">Cardio real vinculado. Distância e métricas vieram da execução registrada.</p>}
      {cardioStatus === 'skipped' && <p className="muted-text">Cardio pulado. Nenhuma linha com duração ou distância zero foi criada.</p>}
      {canFinish && <button className="primary-btn gym-finalize-v42" type="button" onClick={onFinish} disabled={saving}><CheckCircle2 size={16} /> Finalizar sessão</button>}
    </section>
  );
}

function GymSessionHistory({ sessions }) {
  if (!sessions.length) return null;
  return (
    <section className="simple-panel gym-history-v42">
      <div><p className="eyebrow">Histórico</p><h3>Planejado x realizado</h3></div>
      <div className="gym-history-list-v42">
        {sessions.map((session) => {
          const detail = plannedVsRealized(session);
          return (
            <details key={session.id}>
              <summary><span><strong>{session.training_day?.title ?? session.notes ?? 'Treino'}</strong><small>{new Date(session.performed_at).toLocaleDateString('pt-BR')} · {session.selection_kind === 'extra' ? 'extra' : 'sessão-base'} · {session.workout_variant ?? 'base'}</small></span><span>Ver detalhes</span></summary>
              <div className="gym-history-facts-v42">
                <span>Força planejada: {detail.strength.planned.length} exercícios</span>
                <span>Força realizada: {detail.strength.realized.length} séries</span>
                <span>Cardio planejado: {detail.cardio.planned ? `${detail.cardio.planned.target_minutes ?? '--'} min · RPE ${detail.cardio.planned.target_rpe ?? '--'}` : 'não'}</span>
                <span>Cardio realizado: {detail.cardio.realized ? `${Math.round(Number(detail.cardio.realized.duration_seconds || 0) / 60)} min · ${detail.cardio.realized.distance_km ?? '--'} km · FC ${detail.cardio.realized.avg_heart_rate ?? '--'}` : detail.cardio.status}</span>
                <span>Relógio força: {detail.wearable ? `${detail.wearable.duration_seconds ? Math.round(detail.wearable.duration_seconds / 60) : '--'} min · FC ${detail.wearable.avg_heart_rate ?? '--'}` : 'não vinculado'}</span>
                <span>Prontidão: {session.readiness_score ?? '--'} · duração total {detail.timing.durationMinutes ?? '--'} min</span>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function resetSessionState(selectedDay, strengthEntries, todayKeyValue, setters) {
  setters.setSetRows(buildInitialSetRows(strengthEntries));
  setters.setRowsPlanDayId(selectedDay?.id ? String(selectedDay.id) : null);
  setters.setRowsPendingLocalDate(todayKeyValue);
  setters.setStartedAt(null);
  setters.setTimerRunning(false);
  setters.setDuration('');
  setters.setSessionVariant('base');
  setters.setSessionRecommendation(null);
  setters.setSessionId(null);
  setters.setSessionLocalDate(null);
  setters.setSessionPlanDayId(null);
  setters.setPersistedWorkoutSessionId(null);
  setters.setStrengthStatus('active');
  setters.setCardioStatus('not_planned');
  setters.setSelectionKind('manual');
  setters.setCardioPlan(null);
  setters.setSessionStrengthPlan([]);
  setters.setManualCardioMinutes('');
  setters.setManualCardioDistance('');
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
