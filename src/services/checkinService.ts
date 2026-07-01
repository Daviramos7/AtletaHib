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
  if (error) throw error;
  return data;
}

export async function upsertCheckin(userId, payload) {
  const client = requireSupabase();
  const row = {
    user_id: userId,
    log_date: payload.log_date ?? todayKey(),
    sleep_hours: numberOrNull(payload.sleep_hours),
    energy_score: numberOrNull(payload.energy_score),
    hunger_score: numberOrNull(payload.hunger_score),
    stress_score: numberOrNull(payload.stress_score),
    pain_level: numberOrNull(payload.pain_level),
    soreness_level: numberOrNull(payload.soreness_level),
    steps: numberOrNull(payload.steps),
    lactose_symptoms: Boolean(payload.lactose_symptoms),
    cravings_notes: payload.cravings_notes?.trim() || null,
    notes: payload.notes?.trim() || null,
  };

  const { data, error } = await client
    .from('daily_checkins')
    .upsert(row, { onConflict: 'user_id,log_date' })
    .select('*')
    .single();
  if (error) throw error;
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
  if (error) throw error;
  return data ?? [];
}

export function calculateReadiness(checkin) {
  if (!checkin) return { score: 60, label: 'sem check-in', tone: 'neutral', advice: 'Registre sono, dor e fome para liberar uma decisão melhor.' };

  let score = 100;
  const sleep = Number(checkin.sleep_hours || 0);
  const pain = Number(checkin.pain_level || 0);
  const soreness = Number(checkin.soreness_level || 0);
  const stress = Number(checkin.stress_score || 0);
  const hunger = Number(checkin.hunger_score || 0);
  const energy = Number(checkin.energy_score || 0);

  if (sleep && sleep < 5.5) score -= 25;
  else if (sleep && sleep < 6.5) score -= 15;
  else if (!sleep) score -= 8;

  if (pain >= 7) score -= 30;
  else if (pain >= 4) score -= 15;

  if (soreness >= 8) score -= 18;
  else if (soreness >= 5) score -= 9;

  if (stress >= 8) score -= 12;
  else if (stress >= 6) score -= 6;

  if (hunger >= 8) score -= 10;
  if (energy && energy <= 3) score -= 14;
  else if (energy >= 8) score += 6;

  if (checkin.lactose_symptoms) score -= 10;

  const finalScore = Math.max(0, Math.min(Math.round(score), 100));
  if (finalScore >= 80) return { score: finalScore, label: 'pronto para treinar', tone: 'good', advice: 'Pode seguir o treino planejado. Só não transforme treino bom em ego.' };
  if (finalScore >= 60) return { score: finalScore, label: 'treino controlado', tone: 'warning', advice: 'Treine, mas reduza volume se dor ou cansaço subir.' };
  return { score: finalScore, label: 'recuperação primeiro', tone: 'danger', advice: 'Hoje vale trocar corrida por caminhada/bike leve e preservar articulações.' };
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
