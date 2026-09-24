import { dateKeyInTimeZone } from './readiness';
import { exerciseTracking, isDurationExercise } from './exerciseTracking';

export type StrengthStatus = 'active' | 'completed';
export type CardioStatus = 'not_planned' | 'pending' | 'awaiting_import' | 'completed' | 'skipped';
export type GymSessionStatus = 'active' | 'strength_completed' | 'completed' | 'legacy';

export interface GymSessionLifecycleState {
  completed: boolean;
  sessionStatus: GymSessionStatus | string;
  strengthStatus: StrengthStatus | string;
  cardioStatus: CardioStatus | string;
}

const FINALIZABLE_CARDIO_STATUSES = new Set<CardioStatus>(['not_planned', 'awaiting_import', 'completed', 'skipped']);

export interface CardioPlanSnapshot {
  planned: boolean;
  activity_label: string | null;
  target_minutes: number | null;
  intensity: string | null;
  target_rpe: string | null;
  notes: string | null;
}

export function buildCardioPlanSnapshot({ selectedDay, selectedChoice, recommendedMinutes }: any): CardioPlanSnapshot {
  const kind = String(selectedDay?.day_kind ?? selectedDay?.type ?? '').toLowerCase();
  const planned = kind.includes('cardio') || Boolean(selectedDay?.cardio_required);
  if (!planned) return normalizeCardioPlanSnapshot({ planned: false, activity_label: null, target_minutes: null, intensity: null, target_rpe: null, notes: null });

  const text = String(selectedChoice ?? 'Cardio pós-treino');
  const parsedMinutes = parseFirstNumber(text);
  return normalizeCardioPlanSnapshot({
    planned: true,
    activity_label: text || 'Cardio pós-treino',
    target_minutes: finiteOrNull(recommendedMinutes) ?? (parsedMinutes || 10),
    intensity: 'leve',
    target_rpe: '5–6',
    notes: 'Ritmo conversável; a execução real deve vir do relógio quando disponível.',
  });
}

export function clampCardioPrescriptionMinutes(value: unknown) {
  const parsed = nullableNumber(value);
  return parsed === null ? null : Math.min(Math.max(Math.round(parsed), 0), 20);
}

export function normalizeCardioPlanSnapshot(plan: Partial<CardioPlanSnapshot> | null | undefined): CardioPlanSnapshot {
  return {
    planned: Boolean(plan?.planned),
    activity_label: plan?.activity_label ?? null,
    target_minutes: clampCardioPrescriptionMinutes(plan?.target_minutes),
    intensity: plan?.intensity ?? null,
    target_rpe: plan?.target_rpe ?? null,
    notes: plan?.notes ?? null,
  };
}

export function isGymSessionLifecycleStateValid({ completed, sessionStatus, strengthStatus, cardioStatus }: GymSessionLifecycleState) {
  if (sessionStatus === 'legacy') {
    return completed === false && strengthStatus === 'active' && cardioStatus === 'not_planned';
  }
  if (sessionStatus === 'active') {
    return completed === false && strengthStatus === 'active' && cardioStatus === 'not_planned';
  }
  if (sessionStatus === 'strength_completed') {
    return completed === false
      && strengthStatus === 'completed'
      && ['not_planned', 'pending', 'awaiting_import', 'completed', 'skipped'].includes(cardioStatus);
  }
  if (sessionStatus === 'completed') {
    return completed === true
      && strengthStatus === 'completed'
      && FINALIZABLE_CARDIO_STATUSES.has(cardioStatus as CardioStatus);
  }
  return false;
}

export function normalizeLegacyCompletedLifecycle(state: GymSessionLifecycleState): GymSessionLifecycleState {
  if (
    state.completed === true
    && state.sessionStatus === 'active'
    && state.strengthStatus === 'active'
    && state.cardioStatus === 'not_planned'
  ) {
    return { ...state, sessionStatus: 'completed', strengthStatus: 'completed' };
  }
  return state;
}

export function canFinalizeGymSessionState({ completed, sessionStatus, strengthStatus, cardioStatus }: GymSessionLifecycleState) {
  return completed === false
    && sessionStatus === 'strength_completed'
    && strengthStatus === 'completed'
    && FINALIZABLE_CARDIO_STATUSES.has(cardioStatus as CardioStatus);
}

export function deriveGymSessionLifecycle({ strengthStatus, cardioStatus, completed }: { strengthStatus?: StrengthStatus | string | null; cardioStatus?: CardioStatus | string | null; completed?: boolean | null }) {
  if (completed) return { sessionStatus: 'completed' as GymSessionStatus, canFinish: false, nextAction: 'done' as const };
  if (strengthStatus !== 'completed') return { sessionStatus: 'active' as GymSessionStatus, canFinish: false, nextAction: 'strength' as const };
  if (cardioStatus === 'pending') return { sessionStatus: 'strength_completed' as GymSessionStatus, canFinish: false, nextAction: 'cardio' as const };
  if (cardioStatus === 'not_planned' || cardioStatus === 'awaiting_import' || cardioStatus === 'completed' || cardioStatus === 'skipped') {
    return { sessionStatus: 'strength_completed' as GymSessionStatus, canFinish: true, nextAction: 'finish' as const };
  }
  return { sessionStatus: 'strength_completed' as GymSessionStatus, canFinish: false, nextAction: 'cardio' as const };
}

export function cardioStatusAfterDeletingLinkedExecution(cardioPlan: CardioPlanSnapshot | null | undefined, sessionCompleted = false): CardioStatus {
  if (!cardioPlan?.planned) return 'not_planned';
  return sessionCompleted ? 'awaiting_import' : 'pending';
}

export function buildStrengthPlanSnapshot(rows: Array<Record<string, any>>) {
  const grouped = new Map<string, any>();
  for (const row of rows ?? []) {
    const key = String(row.exercise_entry_id ?? row.exercise_name ?? 'exercise');
    const current = grouped.get(key) ?? {
      exercise_entry_id: row.exercise_entry_id ?? null,
      exercise_name: row.exercise_name ?? 'Exercício',
      planned_sets: 0,
      planned_reps: row.planned_reps ?? null,
      planned_load_kg: isDurationExercise(row) ? null : nullableNumber(row.load_kg),
      tracking_type: exerciseTracking(row),
    };
    current.planned_sets += 1;
    grouped.set(key, current);
  }
  return [...grouped.values()];
}

export function plannedVsRealized(session: any) {
  const strengthPlan = Array.isArray(session?.strength_plan) ? session.strength_plan : [];
  const realizedSets = session?.workout_exercise_sets ?? session?.sets ?? [];
  const cardioPlan = session?.cardio_plan?.planned ? session.cardio_plan : null;
  const cardio = firstRelation(session?.cardio_sessions ?? session?.cardio_session);
  const wearable = firstRelation(session?.wearable_workout_sessions ?? session?.wearable_session);
  return {
    strength: { planned: strengthPlan, realized: realizedSets },
    cardio: { planned: cardioPlan, realized: cardio ?? null, status: session?.cardio_status ?? 'not_planned' },
    wearable: wearable ?? null,
    timing: gymSessionTiming(session),
  };
}

export function gymSessionTiming(session: any) {
  return {
    startedAt: session?.performed_at ?? null,
    strengthCompletedAt: session?.strength_completed_at ?? null,
    completedAt: session?.completed_at ?? null,
    durationMinutes: nullableNumber(session?.duration_minutes),
  };
}

export function rankGymImportCandidates({
  userId,
  performedAt,
  sessions = [],
  kind,
  timeZone = resolvedTimeZone(),
}: {
  userId: string;
  performedAt: string;
  sessions?: any[];
  kind: 'cardio' | 'strength';
  timeZone?: string;
}) {
  const importDate = dateKeyInTimeZone(performedAt, timeZone);
  const importTimestamp = new Date(performedAt).getTime();
  return sessions
    .filter((session) => String(session.user_id) === String(userId))
    .filter((session) => kind === 'cardio'
      ? ['pending', 'awaiting_import'].includes(session.cardio_status) && !hasRelation(session.cardio_sessions)
      : session.strength_status === 'completed' && !hasRelation(session.wearable_workout_sessions))
    .map((session) => {
      const distanceMinutes = Math.abs(importTimestamp - new Date(session.performed_at).getTime()) / 60_000;
      const sessionDate = String(session.session_local_date ?? '').slice(0, 10) || dateKeyInTimeZone(session.performed_at, timeZone);
      const calendarDistance = calendarDayDistance(sessionDate, importDate);
      const statusBonus = kind === 'cardio' && session.cardio_status === 'awaiting_import' ? 40 : 20;
      return { ...session, matchScore: Math.max(0, 100 - distanceMinutes / 4) + statusBonus, distanceMinutes, calendarDistance };
    })
    .filter((session) => session.calendarDistance <= 1 && session.distanceMinutes <= 8 * 60)
    .sort((a, b) => a.distanceMinutes - b.distanceMinutes || b.matchScore - a.matchScore);
}

export function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function withOptionalWorkoutLink(payload: Record<string, any>, workoutSessionId?: string | null) {
  const row = { ...payload };
  delete row.workout_session_id;
  if (workoutSessionId) row.workout_session_id = workoutSessionId;
  return row;
}

function hasRelation(value: unknown) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function firstRelation(value: any) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function calendarDayDistance(first: string, second: string) {
  const firstParts = first.split('-').map(Number);
  const secondParts = second.split('-').map(Number);
  if (firstParts.length !== 3 || secondParts.length !== 3 || [...firstParts, ...secondParts].some((part) => !Number.isFinite(part))) {
    return Number.POSITIVE_INFINITY;
  }
  const firstUtc = Date.UTC(firstParts[0], firstParts[1] - 1, firstParts[2]);
  const secondUtc = Date.UTC(secondParts[0], secondParts[1] - 1, secondParts[2]);
  return Math.abs(firstUtc - secondUtc) / 86_400_000;
}

function finiteOrNull(value: unknown) {
  const parsed = nullableNumber(value);
  return parsed === null ? null : Math.max(Math.round(parsed), 0);
}

function parseFirstNumber(value: unknown) {
  const match = String(value ?? '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function resolvedTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
