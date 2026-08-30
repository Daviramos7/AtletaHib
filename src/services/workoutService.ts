import { requireSupabase } from '../lib/supabaseClient';
import { localDateKey, startOfWeekLocal } from '../utils/dates';
import { buildCardioPlanSnapshot, buildStrengthPlanSnapshot, canFinalizeGymSessionState, normalizeCardioPlanSnapshot } from '../domain/gymSession';

export async function completeWorkoutWithSets(userId, payload) {
  const result = await completeStrengthForGymSession(userId, {
    ...payload,
    cardio_plan: payload.cardio_plan ?? { planned: false },
    selection_kind: payload.selection_kind ?? 'manual',
  });
  const session = await finalizeGymSession(userId, result.session.id, {
    duration_minutes: Number(payload.duration_minutes || 0),
  });
  return { ...result, session };
}

export async function completeStrengthForGymSession(userId, payload) {
  const client = requireSupabase();
  const performedAt = payload.performed_at ?? new Date().toISOString();
  const cardioPlan = normalizeCardioPlanSnapshot(payload.cardio_plan ?? buildCardioPlanSnapshot({
    selectedDay: payload.selected_day,
    selectedChoice: payload.selected_cardio_choice,
    recommendedMinutes: payload.recommended_cardio_minutes,
  }));
  const strengthPlan = payload.strength_plan ?? buildStrengthPlanSnapshot(payload.all_rows ?? payload.sets ?? []);
  const cardioStatus = cardioPlan?.planned ? 'pending' : 'not_planned';

  const { data: session, error: sessionError } = await client
    .from('workout_sessions')
    .insert({
      user_id: userId,
      training_day_id: payload.training_day_id,
      performed_at: performedAt,
      duration_minutes: Number(payload.duration_minutes || 0),
      perceived_effort: Number(payload.perceived_effort || 7),
      completed: false,
      session_status: 'strength_completed',
      strength_status: 'completed',
      cardio_status: cardioStatus,
      selection_kind: ['recommended', 'manual', 'extra'].includes(payload.selection_kind) ? payload.selection_kind : 'manual',
      session_local_date: payload.session_local_date ?? localDateKey(new Date(performedAt)),
      strength_completed_at: payload.strength_completed_at ?? new Date().toISOString(),
      completed_at: null,
      strength_plan: strengthPlan,
      cardio_plan: cardioPlan,
      workout_variant: payload.workout_variant === 'adapted' ? 'adapted' : 'base',
      readiness_score: payload.readiness_score ?? null,
      adaptation_summary: payload.adaptation_summary ?? null,
      notes: payload.notes ?? null,
    })
    .select('*')
    .single();
  if (sessionError) {
    const message = String(sessionError.message ?? '');
    if (isFlexibleGymSchemaError(message)) {
      throw new Error('A Academia flexível ainda não está pronta no Supabase. Revise e aplique a migration 2026_08_30_flexible_gym_sessions.sql.');
    }
    throw sessionError;
  }

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

export async function finalizeGymSession(userId, workoutSessionId, payload: any = {}) {
  if (!workoutSessionId) throw new Error('Sessão sem ID para finalizar.');
  const client = requireSupabase();
  const current = await client
    .from('workout_sessions')
    .select('completed,session_status,strength_status,cardio_status')
    .eq('user_id', userId)
    .eq('id', workoutSessionId)
    .single();
  if (current.error) throw current.error;
  if (!canFinalizeGymSessionState({
    completed: current.data.completed,
    sessionStatus: current.data.session_status,
    strengthStatus: current.data.strength_status,
    cardioStatus: current.data.cardio_status,
  })) {
    throw new Error(current.data.cardio_status === 'pending'
      ? 'Resolva o cardio pendente antes de finalizar a sessão.'
      : 'A sessão não está em um estado válido para finalização.');
  }

  const { data, error } = await client
    .from('workout_sessions')
    .update({
      completed: true,
      session_status: 'completed',
      completed_at: payload.completed_at ?? new Date().toISOString(),
      duration_minutes: payload.duration_minutes == null ? undefined : Number(payload.duration_minutes || 0),
    })
    .eq('user_id', userId)
    .eq('id', workoutSessionId)
    .eq('completed', false)
    .eq('session_status', 'strength_completed')
    .eq('strength_status', 'completed')
    .neq('cardio_status', 'pending')
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateGymSessionCardioStatus(userId, workoutSessionId, cardioStatus) {
  if (!['not_planned', 'pending', 'awaiting_import', 'completed', 'skipped'].includes(cardioStatus)) {
    throw new Error('Status de cardio inválido.');
  }
  const client = requireSupabase();
  const { data, error } = await client
    .from('workout_sessions')
    .update({ cardio_status: cardioStatus })
    .eq('user_id', userId)
    .eq('id', workoutSessionId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
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

export async function listGymSessionHistory(userId, limit = 80) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('workout_sessions')
    .select('*, training_day:training_days(id,title,weekday,day_kind,type), workout_exercise_sets(*), cardio_sessions(*), wearable_workout_sessions(*)')
    .eq('user_id', userId)
    .order('performed_at', { ascending: false })
    .limit(limit);
  if (error) {
    const message = String(error.message ?? '');
    if (isFlexibleGymSchemaError(message) || message.includes('relationship')) {
      throw new Error('A Academia flexível ainda não está pronta no Supabase. Revise e aplique a migration 2026_08_30_flexible_gym_sessions.sql.');
    }
    throw error;
  }
  return data ?? [];
}

export async function deleteWorkoutSession(userId, workoutSessionId) {
  if (!workoutSessionId) throw new Error('Treino sem ID para apagar.');

  const client = requireSupabase();

  const relations = ['cardio_sessions', 'wearable_workout_sessions'];
  for (const table of relations) {
    const { error: unlinkError } = await client
      .from(table)
      .update({ workout_session_id: null })
      .eq('user_id', userId)
      .eq('workout_session_id', workoutSessionId);
    if (unlinkError) throw unlinkError;
  }

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

function isFlexibleGymSchemaError(message) {
  return [
    'session_status',
    'strength_status',
    'cardio_status',
    'selection_kind',
    'session_local_date',
    'strength_plan',
    'cardio_plan',
    'workout_variant',
    'readiness_score',
    'adaptation_summary',
  ].some((column) => message.includes(column));
}

export async function listStrengthSets(userId, days = 120) {
  const client = requireSupabase();
  const from = new Date();
  from.setDate(from.getDate() - days);
  const enriched = await client
    .from('workout_exercise_sets')
    .select('*, workout_session:workout_sessions(workout_variant, readiness_score, adaptation_summary)')
    .eq('user_id', userId)
    .gte('performed_at', from.toISOString())
    .order('performed_at', { ascending: false });
  if (!enriched.error) return (enriched.data ?? []).map(flattenWorkoutMetadata);

  const message = String(enriched.error.message ?? '');
  const canUseLegacyShape = message.includes('workout_variant')
    || message.includes('readiness_score')
    || message.includes('adaptation_summary')
    || message.includes('relationship');
  if (!canUseLegacyShape) throw enriched.error;

  const legacy = await client
    .from('workout_exercise_sets')
    .select('*')
    .eq('user_id', userId)
    .gte('performed_at', from.toISOString())
    .order('performed_at', { ascending: false });
  if (legacy.error) throw legacy.error;
  return legacy.data ?? [];
}

function flattenWorkoutMetadata(set) {
  const session = Array.isArray(set.workout_session) ? set.workout_session[0] : set.workout_session;
  return {
    ...set,
    workout_variant: session?.workout_variant ?? 'base',
    readiness_score: session?.readiness_score ?? null,
    adaptation_summary: session?.adaptation_summary ?? null,
  };
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
