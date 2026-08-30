import { calculateReadiness, dateKeyInTimeZone } from './readiness';
import { getExerciseMetadata } from './exerciseCatalog';

export type WeeklyGymStatus = 'pending' | 'recommended' | 'completed' | 'not_ideal';

export interface WeeklyGymPlanDay {
  id: string;
  title: string;
  weekday?: number;
  weekdayNumber?: number;
  day_kind?: string;
  type?: string;
  exercise_entries?: Array<Record<string, any>>;
}

export interface WeeklyGymSession {
  id?: string;
  training_day_id?: string | null;
  performed_at?: string | null;
  session_local_date?: string | null;
  completed?: boolean | null;
  strength_status?: string | null;
  selection_kind?: string | null;
}

export interface WeeklyGymQueueItem {
  day: WeeklyGymPlanDay;
  sequenceOrder: number;
  preferredWeekday: number;
  status: WeeklyGymStatus;
  completedAt: string | null;
  completionCount: number;
  isExtraAvailable: boolean;
  score: number;
  reasons: string[];
  estimatedMinutes: number;
  recentMuscles: string[];
}

export interface WeeklyGymQueue {
  week: ReturnType<typeof getLocalWeek>;
  items: WeeklyGymQueueItem[];
  recommended: WeeklyGymQueueItem | null;
  completedBaseCount: number;
  targetCount: number;
  extraCount: number;
  checkinMissing: boolean;
  readiness: ReturnType<typeof calculateReadiness>;
}

export function getLocalWeek(now: Date | string | number = new Date(), timeZone = resolvedTimeZone()) {
  const currentKey = dateKeyInTimeZone(now, timeZone);
  const weekday = calendarWeekday(currentKey);
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const startKey = shiftCalendarKey(currentKey, mondayOffset);
  const days = Array.from({ length: 7 }, (_, index) => shiftCalendarKey(startKey, index));
  return { startKey, endKey: days[6], days, timeZone };
}

export function buildWeeklyGymQueue({
  planDays = [],
  workoutSessions = [],
  completedSets = [],
  checkin = null,
  sleepSessions = [],
  now = new Date(),
  timeZone = resolvedTimeZone(),
}: {
  planDays?: WeeklyGymPlanDay[];
  workoutSessions?: WeeklyGymSession[];
  completedSets?: Array<Record<string, any>>;
  checkin?: Record<string, any> | null;
  sleepSessions?: Array<Record<string, any>>;
  now?: Date | string | number;
  timeZone?: string;
} = {}): WeeklyGymQueue {
  const currentDate = toDate(now);
  const week = getLocalWeek(currentDate, timeZone);
  const strengthDays = planDays.filter(isStrengthPlanDay).sort(compareLogicalPlanDays);
  const currentWeekSessions = workoutSessions
    .filter(isStrengthCompleted)
    .filter((session) => {
      const key = sessionLocalDate(session, timeZone);
      return key >= week.startKey && key <= week.endKey;
    })
    .sort((a, b) => dateValue(a.performed_at) - dateValue(b.performed_at));
  const sessionsByDay = groupBy(currentWeekSessions, (session) => String(session.training_day_id ?? ''));
  const readiness = calculateReadiness({ checkin, sleepSessions, now: currentDate, timeZone });
  const currentWeekday = calendarWeekday(dateKeyInTimeZone(currentDate, timeZone));

  const items: WeeklyGymQueueItem[] = strengthDays.map((day, index) => {
    const daySessions = sessionsByDay.get(String(day.id)) ?? [];
    const completionCount = daySessions.length;
    const completedAt = daySessions[0]?.performed_at ?? null;
    const muscles = musclesForDay(day);
    const recovery = recoveryForDay(day, muscles, strengthDays, workoutSessions, completedSets, currentDate);
    const estimatedMinutes = estimateSessionMinutes(day);
    const reasons: string[] = [];
    let score = 100 - index * 4;

    if (completionCount > 0) {
      reasons.push('Sessão-base concluída nesta semana.');
      return {
        day,
        sequenceOrder: index + 1,
        preferredWeekday: preferredWeekday(day),
        status: 'completed',
        completedAt,
        completionCount,
        isExtraAvailable: true,
        score: score - 80,
        reasons,
        estimatedMinutes,
        recentMuscles: recovery.recentMuscles,
      };
    }

    const priorPending = strengthDays.slice(0, index).some((prior) => !(sessionsByDay.get(String(prior.id))?.length));
    if (priorPending) {
      score -= 8;
      reasons.push('Há uma sessão anterior ainda pendente na sequência do plano.');
    } else {
      score += 8;
      reasons.push(index === 0 ? 'Primeira sessão pendente da semana.' : 'Mantém a sequência lógica do plano.');
    }

    if (preferredWeekday(day) === currentWeekday) {
      score += 5;
      reasons.push('Hoje é o dia preferencial desta sessão, mas ela pode ser feita em outro dia.');
    }

    if (recovery.last48h.length) {
      score -= 42;
      reasons.push(`${recovery.label} foram treinados nas últimas 48h.`);
    } else if (recovery.last72h.length) {
      score -= 18;
      reasons.push(`${recovery.label} ainda acumulam trabalho das últimas 72h.`);
    } else {
      score += 10;
      reasons.push(`${recovery.label} estão sem estímulo recente relevante.`);
    }

    if (recovery.sets7d >= 16) {
      score -= 12;
      reasons.push(`Volume recente alto: ${recovery.sets7d} séries relacionadas em 7 dias.`);
    }

    const availableMinutes = optionalNumber(checkin?.available_minutes);
    if (availableMinutes !== null && availableMinutes < estimatedMinutes) {
      score -= 10;
      reasons.push(`Tempo disponível (${availableMinutes} min) abaixo da estimativa de ${estimatedMinutes} min.`);
    }

    if (readiness.level === 'recuperacao') {
      score -= 14;
      reasons.push('Prontidão pede uma dose conservadora; o motor adaptativo ajustará a execução.');
    }

    return {
      day,
      sequenceOrder: index + 1,
      preferredWeekday: preferredWeekday(day),
      status: recovery.last48h.length ? 'not_ideal' : 'pending',
      completedAt: null,
      completionCount: 0,
      isExtraAvailable: false,
      score,
      reasons,
      estimatedMinutes,
      recentMuscles: recovery.recentMuscles,
    };
  });

  const pending = items.filter((item) => item.status !== 'completed').sort(compareRecommendation);
  const extraCandidates = items.filter((item) => item.status === 'completed').sort(compareRecommendation);
  const recommended = pending[0] ?? extraCandidates[0] ?? null;
  if (recommended) {
    recommended.status = recommended.status === 'not_ideal' ? 'not_ideal' : recommended.status === 'completed' ? 'completed' : 'recommended';
    if (!recommended.reasons.includes('Melhor equilíbrio entre sequência, recuperação e agenda neste momento.')) {
      recommended.reasons.unshift('Melhor equilíbrio entre sequência, recuperação e agenda neste momento.');
    }
  }

  const completedBaseCount = items.filter((item) => item.completionCount > 0).length;
  const extraCount = currentWeekSessions.reduce((total, session) => {
    const siblings = sessionsByDay.get(String(session.training_day_id ?? '')) ?? [];
    const index = siblings.findIndex((candidate) => candidate === session);
    return total + (session.selection_kind === 'extra' || index > 0 ? 1 : 0);
  }, 0);

  return {
    week,
    items,
    recommended,
    completedBaseCount,
    targetCount: strengthDays.length,
    extraCount,
    checkinMissing: !checkin,
    readiness,
  };
}

export function selectionKindFor(queue: WeeklyGymQueue, planDayId: string, requested: 'recommended' | 'manual' = 'manual') {
  const item = queue.items.find((candidate) => String(candidate.day.id) === String(planDayId));
  if (item?.completionCount) return 'extra';
  if (requested === 'recommended' && String(queue.recommended?.day.id) === String(planDayId)) return 'recommended';
  return 'manual';
}

export function countUniqueBaseSessionsByWeek(sessions: WeeklyGymSession[], timeZone = resolvedTimeZone()) {
  const keys = new Set<string>();
  for (const session of sessions.filter(isStrengthCompleted)) {
    if (session.selection_kind === 'extra') continue;
    const localDate = sessionLocalDate(session, timeZone);
    const week = getLocalWeek(`${localDate}T12:00:00`, timeZone);
    const planKey = session.training_day_id ? String(session.training_day_id) : String(session.id ?? session.performed_at ?? '');
    keys.add(`${week.startKey}:${planKey}`);
  }
  return keys.size;
}

function recoveryForDay(day: WeeklyGymPlanDay, muscles: string[], planDays: WeeklyGymPlanDay[], sessions: WeeklyGymSession[], sets: Array<Record<string, any>>, now: Date) {
  const dayById = new Map<string, WeeklyGymPlanDay>(planDays.map((item) => [String(item.id), item]));
  const muscleSet = new Set(muscles);
  const split = splitForTitle(day.title);
  const recent: Array<{ muscle: string; ageHours: number }> = [];
  let sets7d = 0;

  for (const set of sets ?? []) {
    const ageHours = hoursBetween(set.performed_at, now);
    if (ageHours < 0 || ageHours > 168) continue;
    const setMuscles = getExerciseMetadata(set.exercise_name).primaryMuscles;
    const overlap = setMuscles.filter((muscle) => muscleSet.has(muscle) || muscleBelongsToSplit(muscle, split));
    if (!overlap.length) continue;
    sets7d += 1;
    overlap.forEach((muscle) => recent.push({ muscle, ageHours }));
  }

  for (const session of sessions ?? []) {
    const ageHours = hoursBetween(session.performed_at, now);
    if (ageHours < 0 || ageHours > 72) continue;
    const sessionDay = dayById.get(String(session.training_day_id ?? ''));
    if (!sessionDay) continue;
    const overlap = musclesForDay(sessionDay).filter((muscle) => muscleSet.has(muscle) || splitForTitle(sessionDay.title) === split);
    overlap.forEach((muscle) => recent.push({ muscle, ageHours }));
  }

  const last48h = unique(recent.filter((entry) => entry.ageHours <= 48).map((entry) => entry.muscle));
  const last72h = unique(recent.filter((entry) => entry.ageHours > 48 && entry.ageHours <= 72).map((entry) => entry.muscle));
  return {
    last48h,
    last72h,
    sets7d,
    recentMuscles: unique([...last48h, ...last72h]),
    label: split === 'upper' ? 'Músculos superiores' : split === 'lower' ? 'Músculos inferiores' : 'Músculos desta sessão',
  };
}

function muscleBelongsToSplit(muscle: string, split: string) {
  const upper = new Set(['peito', 'dorsais', 'costas_superiores', 'ombros', 'biceps', 'triceps']);
  const lower = new Set(['quadriceps', 'posterior_de_coxa', 'gluteos', 'panturrilhas', 'adutores', 'abdutores']);
  return split === 'upper' ? upper.has(muscle) : split === 'lower' ? lower.has(muscle) : false;
}

function musclesForDay(day: WeeklyGymPlanDay) {
  return unique((day.exercise_entries ?? []).flatMap((exercise) => getExerciseMetadata(exercise.exercise_name).primaryMuscles));
}

function estimateSessionMinutes(day: WeeklyGymPlanDay) {
  const sets = (day.exercise_entries ?? []).reduce((total, exercise) => total + Math.max(parseFirstNumber(exercise.sets), 1), 0);
  return Math.max(Math.round(sets * 2.2 + 8), 20);
}

function isStrengthPlanDay(day: WeeklyGymPlanDay) {
  const kind = normalize(`${day.day_kind ?? ''} ${day.type ?? ''}`);
  return kind.includes('strength') || kind.includes('forca');
}

function isStrengthCompleted(session: WeeklyGymSession) {
  return session.strength_status === 'completed' || session.completed === true;
}

function compareLogicalPlanDays(a: WeeklyGymPlanDay, b: WeeklyGymPlanDay) {
  const aOrder = titleOrder(a.title);
  const bOrder = titleOrder(b.title);
  return aOrder - bOrder || mondayIndex(preferredWeekday(a)) - mondayIndex(preferredWeekday(b));
}

function compareRecommendation(a: WeeklyGymQueueItem, b: WeeklyGymQueueItem) {
  return b.score - a.score || a.sequenceOrder - b.sequenceOrder;
}

function titleOrder(title: string) {
  const value = normalize(title);
  if (value.includes('superior a')) return 1;
  if (value.includes('inferior a')) return 2;
  if (value.includes('superior b')) return 3;
  if (value.includes('inferior b')) return 4;
  return 50;
}

function splitForTitle(title: string) {
  const value = normalize(title);
  if (value.includes('superior')) return 'upper';
  if (value.includes('inferior')) return 'lower';
  return 'mixed';
}

function preferredWeekday(day: WeeklyGymPlanDay) {
  return Number(day.weekdayNumber ?? day.weekday ?? 1);
}

function mondayIndex(weekday: number) {
  return weekday === 0 ? 6 : weekday - 1;
}

function sessionLocalDate(session: WeeklyGymSession, timeZone: string) {
  return String(session.session_local_date ?? '').slice(0, 10) || dateKeyInTimeZone(session.performed_at ?? new Date(), timeZone);
}

function calendarWeekday(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

function shiftCalendarKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function hoursBetween(value: unknown, now: Date) {
  const timestamp = dateValue(value);
  return Number.isFinite(timestamp) ? (now.getTime() - timestamp) / 3_600_000 : Number.POSITIVE_INFINITY;
}

function dateValue(value: unknown) {
  const parsed = new Date(String(value ?? '')).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseFirstNumber(value: unknown) {
  const match = String(value ?? '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function groupBy<T>(rows: T[], keyFor: (row: T) => string) {
  const result = new Map<string, T[]>();
  rows.forEach((row) => {
    const key = keyFor(row);
    result.set(key, [...(result.get(key) ?? []), row]);
  });
  return result;
}

function normalize(value: unknown) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function toDate(value: Date | string | number) {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

function resolvedTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
