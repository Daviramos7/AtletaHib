import { requireSupabase } from '../lib/supabaseClient';
import { DEFAULT_FOODS } from '../data/defaultPlan';
import { normalizeDateKey } from '../utils/dates';
import { slug } from '../utils/durations';

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

export async function deleteMeal(userId, id) {
  const client = requireSupabase();
  const { error } = await client
    .from('meal_entries')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
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


export async function saveMealEntriesFromJson(userId, rawPayload) {
  const client = requireSupabase();
  const payload = normalizeMealImportPayload(rawPayload);

  const rows = payload.items.map((item) => ({
    user_id: userId,
    log_date: payload.log_date,
    meal_type: item.meal_type,
    food_name: item.food_name,
    grams: item.grams,
    kcal: item.kcal,
    protein_g: item.protein_g,
    carbs_g: item.carbs_g,
    fat_g: item.fat_g,
  }));

  const { data: existing, error: existingError } = await client
    .from('meal_entries')
    .select('id, log_date, meal_type, food_name, grams, kcal, protein_g, carbs_g, fat_g')
    .eq('user_id', userId)
    .eq('log_date', payload.log_date);

  if (existingError) throw existingError;

  const existingKeys = new Set((existing ?? []).map(buildMealRowKey));
  const uniqueRows = rows.filter((row) => !existingKeys.has(buildMealRowKey(row)));

  if (!uniqueRows.length) {
    throw new Error('Importação bloqueada: estes alimentos já existem nessa data/refeição. Se comeu de novo, cadastre manualmente para evitar duplicidade silenciosa.');
  }

  const { data, error } = await client
    .from('meal_entries')
    .insert(uniqueRows)
    .select('*');

  if (error) throw error;
  return data ?? uniqueRows;
}

export function normalizeMealImportPayload(rawPayload: any) {
  if (!rawPayload || typeof rawPayload !== 'object') {
    throw new Error('JSON inválido: envie um objeto de comida/refeição.');
  }

  const logDate = normalizeDate(rawPayload.date ?? rawPayload.log_date ?? rawPayload.meal_date);
  if (!logDate) {
    throw new Error('JSON de comida sem data. Informe date no formato YYYY-MM-DD para não salvar no dia errado.');
  }
  const defaultMealType = normalizeMealType(rawPayload.meal_type ?? rawPayload.meal ?? rawPayload.refeicao ?? rawPayload.refeição ?? 'extra');
  const rawItems = collectMealItems(rawPayload, defaultMealType);

  if (!rawItems.length) {
    throw new Error('JSON de comida sem itens. Use items: [{ food_name, grams, kcal }].');
  }

  const items = rawItems.map((item, index) => normalizeMealItem(item, defaultMealType, index));
  const totalKcal = items.reduce((sum, item) => sum + Number(item.kcal || 0), 0);

  return {
    type: 'meal_import',
    log_date: logDate,
    meal_type: defaultMealType,
    items,
    total_kcal: Math.round(totalKcal),
  };
}

function collectMealItems(raw, defaultMealType) {
  const candidates = [];

  if (Array.isArray(raw.items)) {
    raw.items.forEach((item) => candidates.push({ ...item, meal_type: item.meal_type ?? defaultMealType }));
  }

  if (Array.isArray(raw.foods)) {
    raw.foods.forEach((item) => candidates.push({ ...item, meal_type: item.meal_type ?? defaultMealType }));
  }

  if (Array.isArray(raw.meals)) {
    raw.meals.forEach((meal) => {
      const mealType = normalizeMealType(meal.meal_type ?? meal.meal ?? meal.refeicao ?? meal.refeição ?? defaultMealType);
      const nested = Array.isArray(meal.items) ? meal.items : Array.isArray(meal.foods) ? meal.foods : null;

      if (nested) {
        nested.forEach((item) => candidates.push({ ...item, meal_type: item.meal_type ?? mealType }));
      } else {
        candidates.push({ ...meal, meal_type: mealType });
      }
    });
  }

  if (!candidates.length && (raw.food_name || raw.name || raw.alimento || raw.description || raw.kcal || raw.calories || raw.calorias)) {
    candidates.push({ ...raw, meal_type: defaultMealType });
  }

  return candidates;
}

function normalizeMealItem(raw, defaultMealType, index) {
  const foodName = String(raw.food_name ?? raw.name ?? raw.alimento ?? raw.description ?? `Alimento importado ${index + 1}`).trim();
  const mealType = normalizeMealType(raw.meal_type ?? raw.meal ?? raw.refeicao ?? raw.refeição ?? defaultMealType);

  const grams = positiveNumber(raw.grams ?? raw.gramas ?? raw.quantity_g ?? raw.weight_g ?? raw.portion_grams ?? raw.peso_g);
  const kcalPer100g = numberOrNull(raw.kcal_per_100g ?? raw.calories_per_100g ?? raw.calorias_por_100g);
  const proteinPer100g = numberOrNull(raw.protein_per_100g ?? raw.proteina_por_100g ?? raw.protein_100g);
  const carbsPer100g = numberOrNull(raw.carbs_per_100g ?? raw.carboidratos_por_100g ?? raw.carbs_100g);
  const fatPer100g = numberOrNull(raw.fat_per_100g ?? raw.gordura_por_100g ?? raw.fat_100g);

  const kcalRaw = numberOrNull(raw.kcal ?? raw.calories ?? raw.calorias ?? raw.energy_kcal);
  const proteinRaw = numberOrNull(raw.protein_g ?? raw.protein ?? raw.proteina_g ?? raw.proteina);
  const carbsRaw = numberOrNull(raw.carbs_g ?? raw.carbs ?? raw.carboidratos_g ?? raw.carboidratos);
  const fatRaw = numberOrNull(raw.fat_g ?? raw.fat ?? raw.gordura_g ?? raw.gordura);

  if (!foodName) throw new Error('Item de comida sem nome.');

  if (!grams) {
    throw new Error(`Item "${foodName}" sem gramas. Não vou assumir 100g sozinho; informe grams/gramas ou uma porção estimada.`);
  }

  const factor = grams / 100;
  const kcal = kcalRaw ?? (kcalPer100g !== null ? Math.round(kcalPer100g * factor) : null);

  if (!kcal && kcal !== 0) throw new Error(`Item "${foodName}" sem kcal. Informe kcal ou kcal_per_100g.`);

  return {
    meal_type: mealType,
    food_name: foodName,
    grams: Number(grams.toFixed(1)),
    kcal: Math.max(0, Math.round(kcal)),
    protein_g: roundMacroOrNull(proteinRaw ?? (proteinPer100g !== null ? proteinPer100g * factor : null)),
    carbs_g: roundMacroOrNull(carbsRaw ?? (carbsPer100g !== null ? carbsPer100g * factor : null)),
    fat_g: roundMacroOrNull(fatRaw ?? (fatPer100g !== null ? fatPer100g * factor : null)),
  };
}

function normalizeMealType(value) {
  const text = normalizeText(value);

  if (text.includes('lanche') && text.includes('manha')) return 'lanche1';
  if (text.includes('cafe') || text.includes('manha')) return 'cafe';
  if (text.includes('almoco') || text.includes('almoço')) return 'almoco';
  if (text.includes('pre') || text.includes('pos') || text.includes('treino') || text.includes('tarde')) return 'lanche2';
  if (text.includes('jantar') || text.includes('noite')) return 'jantar';
  if (['cafe', 'lanche1', 'almoco', 'lanche2', 'jantar', 'extra'].includes(text)) return text;

  return 'extra';
}

function normalizeDate(value) {
  return normalizeDateKey(value);
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function positiveNumber(value) {
  const number = parseLocaleNumber(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = parseLocaleNumber(value);
  return Number.isFinite(number) ? number : null;
}

function parseLocaleNumber(value) {
  if (typeof value === 'number') return value;
  const cleaned = String(value ?? '').replace(',', '.').replace(/[^0-9.-]/g, '');
  if (!cleaned) return Number.NaN;
  return Number(cleaned);
}

function roundMacroOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(1)) : null;
}


function buildMealRowKey(row) {
  return [
    row.log_date,
    row.meal_type,
    slug(row.food_name),
    Number(row.grams ?? 0).toFixed(1),
    Math.round(Number(row.kcal ?? 0)),
    macroKey(row.protein_g),
    macroKey(row.carbs_g),
    macroKey(row.fat_g),
  ].join('|');
}

function macroKey(value) {
  if (value === null || value === undefined || value === '') return 'na';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(1) : 'na';
}
