import { requireSupabase } from '../lib/supabaseClient';
import { todayKey } from './dailyService';

export async function getCheckin(userId, logDate = todayKey()) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('daily_checkins')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .maybeSingle();

  if (error) throw normalizeCheckinError(error);
  return data;
}

export async function upsertCheckin(userId, payload) {
  const client = requireSupabase();
  const row = normalizeCheckinRow(userId, payload);

  const upsertResult = await client
    .from('daily_checkins')
    .upsert(row, { onConflict: 'user_id,log_date' })
    .select('*')
    .single();

  if (!upsertResult.error) return upsertResult.data;

  if (!canFallbackToManualSave(upsertResult.error)) {
    throw normalizeCheckinError(upsertResult.error);
  }

  const existing = await client
    .from('daily_checkins')
    .select('id')
    .eq('user_id', userId)
    .eq('log_date', row.log_date)
    .maybeSingle();

  if (existing.error) throw normalizeCheckinError(existing.error);

  if (existing.data?.id) {
    const { data, error } = await client
      .from('daily_checkins')
      .update(row)
      .eq('id', existing.data.id)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw normalizeCheckinError(error);
    return data;
  }

  const { data, error } = await client
    .from('daily_checkins')
    .insert(row)
    .select('*')
    .single();

  if (error) throw normalizeCheckinError(error);
  return data;
}

export async function listCheckins(userId, fromDate) {
  const client = requireSupabase();
  let query = client
    .from('daily_checkins')
    .select('*')
    .eq('user_id', userId)
    .order('log_date', { ascending: false });

  if (fromDate) query = query.gte('log_date', fromDate);

  const { data, error } = await query;
  if (error) throw normalizeCheckinError(error);
  return data ?? [];
}

export function normalizeCheckinRow(userId, payload: any = {}): any {
  const mode = payload.checkin_mode === 'evening' ? 'evening' : 'morning';
  const modeFields: any = mode === 'evening'
    ? { evening_notes: cleanText(payload.notes), evening_saved_at: new Date().toISOString() }
    : { morning_notes: cleanText(payload.notes), morning_saved_at: new Date().toISOString(), notes: cleanText(payload.notes) };
  return {
    user_id: userId,
    log_date: normalizeDate(payload.log_date),
    sleep_hours: decimalOrNull(payload.sleep_hours, 0, 14),
    energy_score: integerOrNull(payload.energy_score, 1, 10),
    hunger_score: integerOrNull(payload.hunger_score, 1, 10),
    stress_score: integerOrNull(payload.stress_score, 1, 10),
    recovery_score: integerOrNull(payload.recovery_score, 1, 10),
    pain_level: integerOrNull(payload.pain_level, 0, 10),
    soreness_level: integerOrNull(payload.soreness_level, 0, 10),
    available_minutes: integerOrNull(payload.available_minutes, 20, 120),
    joint_pain_locations: normalizeLocations(payload.joint_pain_locations, JOINT_LOCATIONS),
    muscle_soreness_locations: normalizeLocations(payload.muscle_soreness_locations, MUSCLE_LOCATIONS),
    steps: integerOrNull(payload.steps, 0, 200000),
    lactose_symptoms: Boolean(payload.lactose_symptoms),
    cravings_notes: cleanText(payload.cravings_notes),
    ...modeFields,
  };
}

function normalizeDate(value) {
  const raw = String(value || todayKey()).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayKey();
}

function decimalOrNull(value, min, max) {
  const parsed = parseNumber(value);
  if (parsed === null) return null;
  return clamp(Number(parsed.toFixed(2)), min, max);
}

function integerOrNull(value, min, max) {
  const parsed = parseNumber(value);
  if (parsed === null) return null;
  return Math.round(clamp(parsed, min, max));
}

function parseNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function cleanText(value) {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

const JOINT_LOCATIONS = ['ombro', 'cotovelo', 'punho', 'lombar', 'quadril', 'joelho', 'tornozelo', 'outro'];
const MUSCLE_LOCATIONS = ['quadriceps', 'posterior_de_coxa', 'gluteos', 'peito', 'costas', 'ombros', 'biceps', 'triceps', 'panturrilhas', 'core', 'outro'];

function normalizeLocations(value, allowed) {
  if (!Array.isArray(value)) return null;
  const locations = [...new Set(value.map((item) => String(item)).filter((item) => allowed.includes(item)))];
  return locations.length ? locations : null;
}

function canFallbackToManualSave(error) {
  const message = String(error?.message ?? '').toLowerCase();
  const code = String(error?.code ?? '');

  return (
    code === '42P10' ||
    message.includes('on conflict') ||
    message.includes('unique') ||
    message.includes('constraint')
  );
}

function normalizeCheckinError(error) {
  const message = String(error?.message ?? error ?? 'Erro desconhecido ao salvar check-in.');

  if (message.includes('recovery_score') || message.includes('available_minutes') || message.includes('joint_pain_locations')) {
    return new Error('O treino adaptativo ainda não está pronto no Supabase. Rode a migration 2026_08_16_adaptive_workout.sql.');
  }

  if (message.includes('daily_checkins') && (message.includes('does not exist') || message.includes('schema cache'))) {
    return new Error('A tabela daily_checkins não está pronta no Supabase. Rode a migration v3.9.5.');
  }

  if (message.includes('ON CONFLICT') || message.includes('unique') || message.includes('constraint')) {
    return new Error('Falta a chave única user_id/log_date em daily_checkins. Rode a migration v3.9.5.');
  }

  if (message.includes('row-level security') || message.includes('violates row-level security')) {
    return new Error('O Supabase bloqueou por RLS. Faça login novamente; se continuar, rode a migration v3.9.5.');
  }

  return error instanceof Error ? error : new Error(message);
}
