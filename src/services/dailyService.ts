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
