import { calculateEstimatedOneRepMax, calculateVolumeKg } from '../services/workoutService';

export function buildExerciseProgress(exerciseName, strengthSets = []) {
  const normalized = normalizeExerciseName(exerciseName);
  const sets = (strengthSets ?? [])
    .filter((set) => normalizeExerciseName(set.exercise_name) === normalized)
    .sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime());

  if (!sets.length) {
    return {
      hasHistory: false,
      exerciseName,
      suggestion: 'Primeiro registro: use carga confortável e deixe 2-3 reps na reserva.',
      trendLabel: 'Sem histórico',
      lastSession: null,
      bestLoad: 0,
      bestVolume: 0,
      bestOneRm: 0,
      recentSessions: [],
    };
  }

  const sessions = groupSetsBySession(sets);
  const lastSession = sessions[0];
  const previousSession = sessions[1] ?? null;
  const bestLoad = Math.max(...sets.map((set) => Number(set.load_kg || 0)));
  const bestOneRm = Math.max(...sets.map((set) => calculateEstimatedOneRepMax(set.load_kg, set.reps)));
  const bestVolume = Math.max(...sessions.map((session) => session.volume));
  const trend = previousSession ? compareVolume(lastSession.volume, previousSession.volume) : 0;

  return {
    hasHistory: true,
    exerciseName,
    suggestion: buildProgressionSuggestion(lastSession),
    trendLabel: buildTrendLabel(trend),
    lastSession,
    previousSession,
    bestLoad: round(bestLoad, 1),
    bestVolume: Math.round(bestVolume),
    bestOneRm: round(bestOneRm, 1),
    recentSessions: sessions.slice(0, 4),
  };
}

export function buildWorkoutProgressSummary(currentRows = [], strengthSets = []) {
  const doneRows = (currentRows ?? []).filter((row) => row.done && Number(row.reps) > 0);
  const currentVolume = calculateVolumeKg(doneRows);
  const completedExercises = new Set(doneRows.map((row) => row.exercise_name)).size;
  const totalExercises = new Set((currentRows ?? []).map((row) => row.exercise_name)).size;

  const latestSessions = groupSetsBySession(strengthSets ?? []);
  const lastWorkoutVolume = latestSessions[0]?.volume ?? 0;
  const diff = lastWorkoutVolume ? ((currentVolume - lastWorkoutVolume) / lastWorkoutVolume) * 100 : 0;

  return {
    currentVolume: Math.round(currentVolume),
    completedExercises,
    totalExercises,
    lastWorkoutVolume: Math.round(lastWorkoutVolume),
    diffPercent: round(diff, 1),
    diffLabel: lastWorkoutVolume ? formatDiff(diff) : 'Sem comparação',
  };
}

function groupSetsBySession(sets) {
  const map = new Map();

  sets.forEach((set) => {
    const key = set.workout_session_id ?? dateKey(set.performed_at);
    const current = map.get(key) ?? {
      key,
      performedAt: set.performed_at,
      sets: [],
      volume: 0,
      bestSet: null,
      avgRpe: 0,
      totalReps: 0,
    };

    const volume = Number(set.load_kg || 0) * Number(set.reps || 0);
    current.sets.push(set);
    current.volume += volume;
    current.totalReps += Number(set.reps || 0);
    current.performedAt = isNewer(set.performed_at, current.performedAt) ? set.performed_at : current.performedAt;

    const bestSetScore = Number(current.bestSet?.load_kg || 0) * 100 + Number(current.bestSet?.reps || 0);
    const setScore = Number(set.load_kg || 0) * 100 + Number(set.reps || 0);
    if (!current.bestSet || setScore > bestSetScore) current.bestSet = set;

    map.set(key, current);
  });

  return [...map.values()]
    .map((session) => ({
      ...session,
      volume: Math.round(session.volume),
      avgRpe: round(avg(session.sets.map((set) => set.perceived_effort).filter((value) => value != null)), 1),
      label: formatDate(session.performedAt),
    }))
    .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
}

function buildProgressionSuggestion(lastSession) {
  const best = lastSession.bestSet;
  const load = Number(best?.load_kg || 0);
  const reps = Number(best?.reps || 0);
  const rpe = Number(lastSession.avgRpe || best?.perceived_effort || 0);

  if (!load || !reps) return 'Repita o movimento com execução limpa e registre carga/reps.';

  if (rpe && rpe >= 9) {
    return `Mantenha ${formatKg(load)} e tente controlar melhor. Se ficar pesado, reduza 5%.`;
  }

  if (rpe && rpe <= 7) {
    return `Pode tentar ${formatKg(load + 2.5)} ou manter ${formatKg(load)} e fazer +1 rep.`;
  }

  if (reps >= 12) {
    return `Boa faixa de reps. Tente subir para ${formatKg(load + 2.5)} e mirar 8-10 reps.`;
  }

  return `Repita ${formatKg(load)} e tente bater ${reps + 1} reps com controle.`;
}

function compareVolume(current, previous) {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
}

function buildTrendLabel(diff) {
  if (diff >= 8) return `Subindo +${round(diff, 1)}%`;
  if (diff <= -8) return `Caiu ${round(diff, 1)}%`;
  return 'Estável';
}

function formatDiff(diff) {
  if (diff > 0) return `+${round(diff, 1)}% vs último`;
  if (diff < 0) return `${round(diff, 1)}% vs último`;
  return 'Igual ao último';
}

function normalizeExerciseName(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatKg(value) {
  return `${round(value, 1)} kg`;
}

function round(value, places = 0) {
  const factor = 10 ** places;
  return Math.round(Number(value || 0) * factor) / factor;
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function isNewer(a, b) {
  return new Date(a).getTime() > new Date(b).getTime();
}

function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'sem-data';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}
