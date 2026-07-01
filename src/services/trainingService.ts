import { requireSupabase } from '../lib/supabaseClient';
import { buildTrainingPlanFromProfile } from '../data/defaultPlan';

export async function getActiveTrainingPlan(userId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('training_plans')
    .select('*, training_days(*, exercise_entries(*))')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  if (!data) return null;

  return {
    ...data,
    training_days: [...(data.training_days ?? [])]
      .sort((a, b) => a.weekday - b.weekday)
      .map((day) => ({
        ...day,
        exercise_entries: [...(day.exercise_entries ?? [])].sort((a, b) => a.position - b.position),
      })),
  };
}

export async function createTrainingPlanFromProfile(userId, profile, options: { deactivatePrevious?: boolean } = {}) {
  const client = requireSupabase();
  const template = buildTrainingPlanFromProfile(profile);

  if (options.deactivatePrevious) {
    const { error: deactivateError } = await client
      .from('training_plans')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);
    if (deactivateError) throw deactivateError;
  }

  const { data: plan, error: planError } = await client
    .from('training_plans')
    .insert({
      user_id: userId,
      name: template.name,
      objective: template.objective,
      is_active: true,
    })
    .select('*')
    .single();
  if (planError) throw planError;

  for (const day of template.days) {
    const { exercises, ...dayPayload } = day;
    const { data: createdDay, error: dayError } = await client
      .from('training_days')
      .insert({ user_id: userId, plan_id: plan.id, ...dayPayload })
      .select('*')
      .single();
    if (dayError) throw dayError;

    if (exercises.length) {
      const rows = exercises.map((exercise) => ({
        user_id: userId,
        training_day_id: createdDay.id,
        ...exercise,
      }));
      const { error: exError } = await client.from('exercise_entries').insert(rows);
      if (exError) throw exError;
    }
  }

  return getActiveTrainingPlan(userId);
}

export async function resetPersonalizedTrainingPlan(userId, profile) {
  return createTrainingPlanFromProfile(userId, profile, { deactivatePrevious: true });
}

export async function updateExercise(id, payload) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('exercise_entries')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function completeWorkout(userId, payload) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('workout_sessions')
    .insert({ user_id: userId, completed: true, ...payload })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
