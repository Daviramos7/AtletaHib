import { requireSupabase } from '../lib/supabaseClient';

export async function listWeightLogs(userId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('weight_logs')
    .select('*')
    .eq('user_id', userId)
    .order('log_date', { ascending: false })
    .limit(104);
  if (error) throw error;
  return data ?? [];
}

export async function saveWeightLog(userId, payload) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('weight_logs')
    .upsert({ user_id: userId, ...payload }, { onConflict: 'user_id,log_date' })
    .select('*')
    .single();
  if (error) throw error;

  await syncProfileCurrentWeight(userId);
  return data;
}

export async function syncProfileCurrentWeight(userId) {
  const client = requireSupabase();
  const { data: latest, error: latestError } = await client
    .from('weight_logs')
    .select('weight_kg')
    .eq('user_id', userId)
    .order('log_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw latestError;

  if (latest?.weight_kg) {
    const { error: updateError } = await client
      .from('profiles')
      .update({ current_weight_kg: latest.weight_kg })
      .eq('user_id', userId);
    if (updateError) throw updateError;
  }
}
