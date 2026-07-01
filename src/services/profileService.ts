import { requireSupabase } from '../lib/supabaseClient';
import { PROFILE_FALLBACKS } from '../data/defaultPlan';

export async function getProfile(userId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertProfile(userId, payload = {}) {
  const client = requireSupabase();
  const row = normalizeProfilePayload({ user_id: userId, ...payload });
  const { data, error } = await client
    .from('profiles')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export function normalizeProfilePayload(payload) {
  const merged = { ...PROFILE_FALLBACKS, ...payload };
  return {
    ...merged,
    name: String(merged.name || 'Atleta').trim(),
    height_cm: Number(merged.height_cm || PROFILE_FALLBACKS.height_cm),
    starting_weight_kg: Number(merged.starting_weight_kg || merged.current_weight_kg || PROFILE_FALLBACKS.current_weight_kg),
    current_weight_kg: Number(merged.current_weight_kg || merged.starting_weight_kg || PROFILE_FALLBACKS.current_weight_kg),
    target_weight_kg: Number(merged.target_weight_kg || PROFILE_FALLBACKS.target_weight_kg),
    kcal_goal: Number(merged.kcal_goal || PROFILE_FALLBACKS.kcal_goal),
    water_goal_ml: Number(merged.water_goal_ml || PROFILE_FALLBACKS.water_goal_ml),
    weekly_strength_days: Number(merged.weekly_strength_days || PROFILE_FALLBACKS.weekly_strength_days),
    weekly_cardio_days: Number(merged.weekly_cardio_days || PROFILE_FALLBACKS.weekly_cardio_days),
    plays_football: Boolean(merged.plays_football),
    onboarding_completed: Boolean(merged.onboarding_completed),
    lunch_time: toTime(merged.lunch_time, PROFILE_FALLBACKS.lunch_time),
    training_time: toTime(merged.training_time, PROFILE_FALLBACKS.training_time),
  };
}

function toTime(value, fallback) {
  if (!value) return fallback;
  return String(value).slice(0, 5);
}
