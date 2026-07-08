import { requireSupabase } from '../lib/supabaseClient';
import { localDateKey, startOfWeekLocal } from '../utils/dates';

export async function completeWorkoutWithSets(userId, payload) {
  const client = requireSupabase();
  const performedAt = payload.performed_at ?? new Date().toISOString();

  const { data: session, error: sessionError } = await client
    .from('workout_sessions')
    .insert({
      user_id: userId,
      training_day_id: payload.training_day_id,
      performed_at: performedAt,
      duration_minutes: Number(payload.duration_minutes || 0),
      perceived_effort: Number(payload.perceived_effort || 7),
      completed: true,
      notes: payload.notes ?? null,
    })
    .select('*')
    .single();
  if (sessionError) throw sessionError;

  const validSets = (payload.sets ?? [])
    .filter((set) => Number(set.reps) > 0)
    .map((set) => ({
      user_id: userId,
      workout_session_id: session.id,
      training_day_id: payload.training_day_id,
      exercise_entry_id: set.exercise_entry_id,
      exercise_name: set.exercise_name,
      set_number: Number(set.set_number),
      planned_reps: set.planned_reps ?? null,
      reps: Number(set.reps),
      load_kg: Number(set.load_kg || 0),
      perceived_effort: set.perceived_effort === '' || set.perceived_effort == null ? null : Number(set.perceived_effort),
      performed_at: performedAt,
      notes: set.notes ?? null,
    }));

  if (validSets.length) {
    const { error: setsError } = await client.from('workout_exercise_sets').insert(validSets);
    if (setsError) {
      await client
        .from('workout_sessions')
        .delete()
        .eq('user_id', userId)
        .eq('id', session.id);
      throw setsError;
    }
  }

  return { session, sets: validSets };
}

export async function listWorkoutHistory(userId, limit = 10) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('completed', true)
    .order('performed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function deleteWorkoutSession(userId, workoutSessionId) {
  if (!workoutSessionId) throw new Error('Treino sem ID para apagar.');

  const client = requireSupabase();

  const { error: setsError } = await client
    .from('workout_exercise_sets')
    .delete()
    .eq('user_id', userId)
    .eq('workout_session_id', workoutSessionId);

  if (setsError) throw setsError;

  const { error: sessionError } = await client
    .from('workout_sessions')
    .delete()
    .eq('user_id', userId)
    .eq('id', workoutSessionId);

  if (sessionError) throw sessionError;
  return true;
}

export async function listStrengthSets(userId, days = 120) {
  const client = requireSupabase();
  const from = new Date();
  from.setDate(from.getDate() - days);
  const { data, error } = await client
    .from('workout_exercise_sets')
    .select('*')
    .eq('user_id', userId)
    .gte('performed_at', from.toISOString())
    .order('performed_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function calculateEstimatedOneRepMax(loadKg, reps) {
  const load = Number(loadKg || 0);
  const r = Number(reps || 0);
  if (!load || !r) return 0;
  return load * (1 + r / 30);
}

export function calculateVolumeKg(sets) {
  return (sets ?? []).reduce((sum, set) => sum + Number(set.load_kg || 0) * Number(set.reps || 0), 0);
}

export function buildWeeklyStrengthProgress(sets, exerciseName) {
  const filtered = (sets ?? []).filter((set) => !exerciseName || set.exercise_name === exerciseName);
  const buckets = new Map();

  filtered.forEach((set) => {
    const date = new Date(set.performed_at);
    const weekStart = startOfWeekLocal(date);
    const weekKey = localDateKey(weekStart);
    const estimatedOneRm = calculateEstimatedOneRepMax(set.load_kg, set.reps);
    const volume = Number(set.load_kg || 0) * Number(set.reps || 0);
    const current = buckets.get(weekKey) ?? {
      weekKey,
      weekStart,
      label: `${String(weekStart.getDate()).padStart(2, '0')}/${String(weekStart.getMonth() + 1).padStart(2, '0')}`,
      bestOneRm: 0,
      bestLoad: 0,
      totalVolume: 0,
      sets: 0,
    };
    current.bestOneRm = Math.max(current.bestOneRm, estimatedOneRm);
    current.bestLoad = Math.max(current.bestLoad, Number(set.load_kg || 0));
    current.totalVolume += volume;
    current.sets += 1;
    buckets.set(weekKey, current);
  });

  return [...buckets.values()]
    .sort((a, b) => a.weekStart - b.weekStart)
    .slice(-12)
    .map((item) => ({
      ...item,
      bestOneRm: Number(item.bestOneRm.toFixed(1)),
      bestLoad: Number(item.bestLoad.toFixed(1)),
      totalVolume: Number(item.totalVolume.toFixed(0)),
    }));
}

