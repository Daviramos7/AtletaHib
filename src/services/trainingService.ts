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


export async function updateTrainingDay(id, payload: any) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('training_days')
    .update(normalizeTrainingDayPayload(payload))
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function createExerciseEntry(userId, trainingDayId, payload: any) {
  const client = requireSupabase();
  const row = {
    user_id: userId,
    training_day_id: trainingDayId,
    ...normalizeExercisePayload(payload),
  };

  const { data, error } = await client
    .from('exercise_entries')
    .insert(row)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteExerciseEntry(id) {
  const client = requireSupabase();
  const { error } = await client.from('exercise_entries').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderExerciseEntries(exercises: any[]) {
  const client = requireSupabase();
  const updates = exercises.map((exercise, index) => (
    client
      .from('exercise_entries')
      .update({ position: index + 1 })
      .eq('id', exercise.id)
  ));

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
}

function normalizeTrainingDayPayload(payload: any) {
  const dayKind = normalizeDayKind(payload.day_kind ?? payload.dayKind);
  const cardioRequired = dayKind === 'cardio' || dayKind === 'strength_cardio';

  return {
    title: String(payload.title || 'Treino').trim(),
    type: payload.type ?? dayKindToLegacyType(dayKind),
    notes: String(payload.notes ?? '').trim() || null,
    day_kind: dayKind,
    cardio_required: cardioRequired,
    cardio_options: cardioRequired ? normalizeCardioOptions(payload.cardio_options ?? payload.cardioOptions) : [],
  };
}

export function normalizeExercisePayload(payload: any) {
  return {
    position: positiveInteger(payload.position, 1),
    exercise_name: String(payload.exercise_name ?? payload.exerciseName ?? 'Novo exercício').trim(),
    sets: String(payload.sets ?? '3').trim() || '3',
    reps: String(payload.reps ?? '10').trim() || '10',
    load_kg: numberOrNull(payload.load_kg ?? payload.loadKg),
    rest_seconds: positiveIntegerOrNull(payload.rest_seconds ?? payload.restSeconds),
    exercise_role: normalizeExerciseRole(payload.exercise_role ?? payload.exerciseRole ?? payload.role),
    notes: String(payload.notes ?? '').trim() || null,
  };
}

function normalizeExerciseRole(value: any) {
  const role = String(value ?? '').toLowerCase();
  return ['main', 'secondary', 'accessory'].includes(role) ? role : null;
}

function normalizeDayKind(value: any) {
  const raw = String(value ?? '').toLowerCase().trim();
  if (['strength', 'forca', 'força'].includes(raw)) return 'strength';
  if (['cardio', 'corrida', 'futebol'].includes(raw)) return 'cardio';
  if (['strength_cardio', 'forca_cardio', 'força_cardio', 'forca corrida', 'força cardio'].includes(raw)) return 'strength_cardio';
  if (['rest', 'descanso', 'recovery'].includes(raw)) return 'rest';
  return 'strength';
}

function dayKindToLegacyType(kind: string) {
  return ({
    strength: 'forca',
    cardio: 'cardio',
    strength_cardio: 'forca_corrida',
    rest: 'descanso',
  })[kind] ?? 'forca';
}

function normalizeCardioOptions(value: any) {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return normalizeCardioOptions(parsed);
    } catch {
      return value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [label, ...rest] = line.split('|');
          return {
            label: String(label || 'Cardio').trim(),
            description: rest.join('|').trim() || 'Cardio planejado.',
          };
        });
    }
  }

  if (!Array.isArray(value)) return [];

  return value
    .map((option) => ({
      label: String(option?.label ?? option?.name ?? 'Cardio').trim(),
      description: String(option?.description ?? option?.notes ?? 'Cardio planejado.').trim(),
    }))
    .filter((option) => option.label);
}

function positiveInteger(value: any, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}

function positiveIntegerOrNull(value: any) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function numberOrNull(value: any) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
