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

export function calculateReadiness(checkin) {
  if (!checkin) return { score: 60, label: 'sem check-in', tone: 'neutral', advice: 'Registre sono, dor e fome para liberar uma decisão melhor.', confidence: 'low' };

  let score = 100;
  let known = 0;
  const sleep = numberOrMissing(checkin.sleep_hours);
  const pain = numberOrMissing(checkin.pain_level);
  const soreness = numberOrMissing(checkin.soreness_level);
  const stress = numberOrMissing(checkin.stress_score);
  const hunger = numberOrMissing(checkin.hunger_score);
  const energy = numberOrMissing(checkin.energy_score);

  for (const value of [sleep, pain, soreness, stress, hunger, energy]) {
    if (value !== null) known += 1;
  }

  if (sleep !== null && sleep < 5.5) score -= 25;
  else if (sleep !== null && sleep < 6.5) score -= 15;
  else if (sleep === null) score -= 8;

  if (pain !== null && pain >= 7) score -= 35;
  else if (pain !== null && pain >= 4) score -= 18;
  else if (pain === null) score -= 4;

  if (soreness !== null && soreness >= 8) score -= 18;
  else if (soreness !== null && soreness >= 5) score -= 9;

  if (stress !== null && stress >= 8) score -= 12;
  else if (stress !== null && stress >= 6) score -= 6;

  if (hunger !== null && hunger >= 8) score -= 10;
  if (energy !== null && energy <= 3) score -= 14;
  else if (energy !== null && energy >= 8) score += 6;

  if (checkin.lactose_symptoms) score -= 10;

  const confidence = known >= 5 ? 'high' : known >= 3 ? 'medium' : 'low';
  if (confidence === 'low') score = Math.min(score, 72);

  const finalScore = Math.max(0, Math.min(Math.round(score), 100));
  const suffix = confidence === 'low' ? ' Como faltam dados, trate essa sugestão como conservadora.' : '';
  if (finalScore >= 80) return { score: finalScore, label: 'pronto para treinar', tone: 'good', confidence, advice: `Pode seguir o treino planejado. Só não transforme treino bom em ego.${suffix}` };
  if (finalScore >= 60) return { score: finalScore, label: 'treino controlado', tone: 'warning', confidence, advice: `Treine, mas reduza volume se dor ou cansaço subir.${suffix}` };
  return { score: finalScore, label: 'recuperação primeiro', tone: 'danger', confidence, advice: `Hoje vale trocar corrida por caminhada/bike leve e preservar articulações.${suffix}` };
}


function normalizeCheckinRow(userId, payload: any = {}): any {
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
    pain_level: integerOrNull(payload.pain_level, 0, 10),
    soreness_level: integerOrNull(payload.soreness_level, 0, 10),
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

function numberOrMissing(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
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
