import { requireSupabase } from '../lib/supabaseClient';

export function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
