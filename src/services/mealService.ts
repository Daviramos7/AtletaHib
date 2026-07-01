import { requireSupabase } from '../lib/supabaseClient';
import { DEFAULT_FOODS } from '../data/defaultPlan';

export async function listMeals(userId, logDate) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('meal_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addMeal(userId, item) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('meal_entries')
    .insert({ user_id: userId, ...item })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMeal(id) {
  const client = requireSupabase();
  const { error } = await client.from('meal_entries').delete().eq('id', id);
  if (error) throw error;
}

export async function listCustomFoods(userId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('custom_foods')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function saveCustomFood(userId, food) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('custom_foods')
    .upsert({ user_id: userId, ...food }, { onConflict: 'user_id,normalized_name' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export function searchFoodLocally(query, customFoods = []) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return [...customFoods, ...DEFAULT_FOODS]
    .filter((food) => food.name.toLowerCase().includes(q))
    .slice(0, 8);
}
