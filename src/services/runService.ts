import { requireSupabase } from '../lib/supabaseClient';

export async function listRuns(userId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('run_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('performed_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function saveRun(userId, payload) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('run_sessions')
    .insert({ user_id: userId, ...payload })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
