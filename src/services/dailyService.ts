import { requireSupabase } from '../lib/supabaseClient';
import { todayLocalKey } from '../utils/dates';

export function todayKey() {
  return todayLocalKey();
}

export async function getOrCreateDailyLog(userId, logDate = todayKey()) {
  const client = requireSupabase();

  // Idempotente por design: em desenvolvimento, React StrictMode pode disparar
  // duas leituras simultâneas. Upsert evita erro de chave duplicada em daily_logs.
  const { data, error } = await client
    .from('daily_logs')
    .upsert({ user_id: userId, log_date: logDate }, { onConflict: 'user_id,log_date' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function setWater(userId, logDate, waterMl) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('daily_logs')
    .upsert({ user_id: userId, log_date: logDate, water_ml: waterMl }, { onConflict: 'user_id,log_date' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function incrementWater(userId, logDate, deltaMl) {
  const client = requireSupabase();
  const delta = Math.round(Number(deltaMl));
  if (!Number.isFinite(delta) || delta === 0) throw new Error('Incremento de água inválido.');
  const { data, error } = await client.rpc('increment_daily_water', {
    p_user_id: userId,
    p_log_date: logDate,
    p_delta: delta,
  });
  if (error) throw error;
  return data;
}
