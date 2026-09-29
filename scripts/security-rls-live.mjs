import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const observeOnly = process.argv.includes('--observe');
const rootEnv = readOptional('.env.local');
const androidEnv = readOptional('android_bridge/gradle.properties');
const baseUrl = envValue(rootEnv, 'VITE_SUPABASE_URL') ?? envValue(androidEnv, 'SUPABASE_URL');
const apiKey = envValue(rootEnv, 'VITE_SUPABASE_ANON_KEY')
  ?? envValue(androidEnv, 'SUPABASE_PUBLISHABLE_KEY')
  ?? envValue(androidEnv, 'SUPABASE_ANON_KEY');

if (!baseUrl || !apiKey) throw new Error('Supabase público não configurado para o teste de segurança.');

const runId = randomUUID();
const password = `${randomBytes(24).toString('base64url')}!aA7`;
const accounts = [];
const results = [];
let a;
let b;

try {
  const provisionedPassword = process.env.SECURITY_TEST_PASSWORD;
  if (process.env.SECURITY_TEST_EMAIL_A && process.env.SECURITY_TEST_EMAIL_B && provisionedPassword) {
    a = await signIn(process.env.SECURITY_TEST_EMAIL_A, provisionedPassword);
    b = await signIn(process.env.SECURITY_TEST_EMAIL_B, provisionedPassword);
  } else {
    a = await signUp(`security-a-${runId}@example.com`, password);
    b = await signUp(`security-b-${runId}@example.com`, password);
  }
  accounts.push(a.userId, b.userId);

  const marker = `security-test-${runId}`;
  const date = '2025-03-15';
  const otherDate = '2025-03-16';
  const performedAt = `${date}T13:00:00Z`;

  const plan = await insertOne(a.token, 'training_plans', { user_id: a.userId, name: marker, objective: 'synthetic-security-test', is_active: false });
  const day = await insertOne(a.token, 'training_days', { user_id: a.userId, plan_id: plan.id, weekday: 6, title: marker, type: 'forca' });
  const exercise = await insertOne(a.token, 'exercise_entries', { user_id: a.userId, training_day_id: day.id, position: 1, exercise_name: marker, sets: '1', reps: '1' });
  const workout = await insertOne(a.token, 'workout_sessions', { user_id: a.userId, training_day_id: day.id, performed_at: performedAt, session_local_date: date, notes: marker });

  const cases = [
    ['daily_logs', { user_id: a.userId, log_date: date, water_ml: 111, notes: marker }, { user_id: a.userId, log_date: otherDate, water_ml: 222, notes: `${marker}-forged` }],
    ['meal_entries', { user_id: a.userId, log_date: date, meal_type: 'extra', food_name: marker, grams: 10, kcal: 20, notes: undefined }, { user_id: a.userId, log_date: otherDate, meal_type: 'extra', food_name: `${marker}-forged`, grams: 10, kcal: 20 }],
    ['daily_checkins', { user_id: a.userId, log_date: date, energy_score: 5, notes: marker }, { user_id: a.userId, log_date: otherDate, energy_score: 5, notes: `${marker}-forged` }],
    ['workout_sessions', { ...workout, id: undefined }, { user_id: a.userId, performed_at: `${otherDate}T13:00:00Z`, session_local_date: otherDate, notes: `${marker}-forged` }],
    ['workout_exercise_sets', { user_id: a.userId, workout_session_id: workout.id, training_day_id: day.id, exercise_entry_id: exercise.id, exercise_name: marker, set_number: 1, reps: 1, load_kg: 1, notes: marker }, { user_id: a.userId, workout_session_id: workout.id, exercise_name: `${marker}-forged`, set_number: 2, reps: 1, load_kg: 1, notes: `${marker}-forged` }],
    ['cardio_sessions', cardioRow(a.userId, workout.id, performedAt, `${marker}-a`), cardioRow(a.userId, null, `${otherDate}T13:00:00Z`, `${marker}-forged`)],
    ['sleep_sessions', sleepRow(a.userId, date, `${marker}-a`), sleepRow(a.userId, otherDate, `${marker}-forged`)],
    ['wearable_daily_metrics', { user_id: a.userId, metric_date: date, provider: 'synthetic', source: marker, steps: 123, notes: marker }, { user_id: a.userId, metric_date: otherDate, provider: 'synthetic', source: `${marker}-forged`, steps: 123, notes: `${marker}-forged` }],
    ['wearable_workout_sessions', wearableRow(a.userId, workout.id, performedAt, `${marker}-a`), wearableRow(a.userId, null, `${otherDate}T13:00:00Z`, `${marker}-forged`)],
  ];

  const records = new Map([['workout_sessions', workout]]);
  for (const [table, ownPayload] of cases) {
    if (table === 'workout_sessions') continue;
    records.set(table, await insertOne(a.token, table, clean(ownPayload)));
  }

  for (const [table, , forgedPayload] of cases) {
    const record = records.get(table);
    await assertInvisibleToB(table, record.id, a.userId, marker, b.token, a.token);
    await assertForgedInsertBlocked(table, clean(forgedPayload), b.token);
    await assertAnonHasNoUsefulAccess(table, clean(forgedPayload));
  }

  await assertCrossUserInsertBlocked('training_days', b.token, { user_id: b.userId, plan_id: plan.id, weekday: 6, title: `${marker}-cross`, type: 'forca' });
  await assertCrossUserInsertBlocked('exercise_entries', b.token, { user_id: b.userId, training_day_id: day.id, position: 1, exercise_name: `${marker}-cross`, sets: '1', reps: '1' });
  await assertCrossUserInsertBlocked('workout_sessions', b.token, { user_id: b.userId, training_day_id: day.id, performed_at: performedAt, session_local_date: date, notes: `${marker}-cross` });
  await assertCrossUserInsertBlocked('workout_exercise_sets', b.token, { user_id: b.userId, workout_session_id: workout.id, training_day_id: day.id, exercise_entry_id: exercise.id, exercise_name: `${marker}-cross`, set_number: 1, reps: 1, load_kg: 1 });
  await assertCrossUserInsertBlocked('cardio_sessions', b.token, cardioRow(b.userId, workout.id, performedAt, `${marker}-cross`));
  await assertCrossUserInsertBlocked('wearable_workout_sessions', b.token, wearableRow(b.userId, workout.id, performedAt, `${marker}-cross`));

  const rpcAsB = await request('/rest/v1/rpc/increment_daily_water', { token: b.token, method: 'POST', body: { p_user_id: a.userId, p_log_date: otherDate, p_delta: 10 } });
  record('rpc rejects B using A user_id', !rpcAsB.ok);
  const rpcAnon = await request('/rest/v1/rpc/increment_daily_water', { method: 'POST', body: { p_user_id: a.userId, p_log_date: otherDate, p_delta: 10 } });
  record('rpc rejects anon', !rpcAnon.ok);
} finally {
  if (a?.token) await cleanup(a.token, a.userId);
  if (b?.token) await cleanup(b.token, b.userId);
  console.log(`SECURITY_TEST_ACCOUNT_IDS=${JSON.stringify(accounts)}`);
}

const failed = results.filter((item) => !item.ok);
console.log(`SECURITY_RLS_RESULTS=${JSON.stringify({ passed: results.length - failed.length, total: results.length, failed: failed.map((item) => item.name) })}`);
if (failed.length && !observeOnly) process.exitCode = 1;

async function signUp(email, pass) {
  const response = await request('/auth/v1/signup', { method: 'POST', body: { email, password: pass } });
  if (!response.ok || !response.data?.user?.id) {
    const code = typeof response.data?.code === 'string' ? `, ${response.data.code}` : '';
    const detail = String(response.data?.msg ?? response.data?.message ?? '').replace(/[\w.+-]+@[\w.-]+/g, '[email]').slice(0, 160);
    throw new Error(`Não foi possível criar conta sintética (${response.status}${code})${detail ? `: ${detail}` : '.'}`);
  }
  if (!response.data.access_token) throw new Error('O projeto exige confirmação de e-mail; a conta sintética não recebeu sessão.');
  return { userId: response.data.user.id, token: response.data.access_token };
}

async function signIn(email, pass) {
  const response = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password: pass } });
  if (!response.ok || !response.data?.user?.id || !response.data?.access_token) {
    throw new Error(`Não foi possível autenticar conta sintética (${response.status}).`);
  }
  return { userId: response.data.user.id, token: response.data.access_token };
}

async function insertOne(token, table, body) {
  const response = await request(`/rest/v1/${table}?select=*`, { token, method: 'POST', body, prefer: 'return=representation' });
  if (!response.ok || !Array.isArray(response.data) || response.data.length !== 1) throw new Error(`Falha ao criar fixture sintética em ${table} (${response.status}).`);
  return response.data[0];
}

async function assertInvisibleToB(table, id, ownerId, marker, tokenB, tokenA) {
  const read = await request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*`, { token: tokenB });
  record(`${table}: B cannot SELECT A`, read.ok && Array.isArray(read.data) && read.data.length === 0);

  const update = await request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=id`, { token: tokenB, method: 'PATCH', body: updateBody(table, marker), prefer: 'return=representation' });
  record(`${table}: B cannot UPDATE A`, update.ok && Array.isArray(update.data) && update.data.length === 0);

  const remove = await request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=id`, { token: tokenB, method: 'DELETE', prefer: 'return=representation' });
  record(`${table}: B cannot DELETE A`, remove.ok && Array.isArray(remove.data) && remove.data.length === 0);

  const verify = await request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&user_id=eq.${ownerId}&select=id`, { token: tokenA });
  record(`${table}: A record survives B attempts`, verify.ok && Array.isArray(verify.data) && verify.data.length === 1);
}

async function assertForgedInsertBlocked(table, payload, tokenB) {
  const response = await request(`/rest/v1/${table}?select=id`, { token: tokenB, method: 'POST', body: payload, prefer: 'return=representation' });
  record(`${table}: B cannot INSERT as A`, !response.ok);
}

async function assertAnonHasNoUsefulAccess(table, payload) {
  const read = await request(`/rest/v1/${table}?select=id&limit=1`);
  record(`${table}: anon cannot read useful data`, !read.ok || (Array.isArray(read.data) && read.data.length === 0));
  const write = await request(`/rest/v1/${table}?select=id`, { method: 'POST', body: payload, prefer: 'return=representation' });
  record(`${table}: anon cannot write`, !write.ok);
}

async function assertCrossUserInsertBlocked(table, token, payload) {
  const response = await request(`/rest/v1/${table}?select=id`, { token, method: 'POST', body: payload, prefer: 'return=representation' });
  record(`${table}: cross-user FK rejected`, !response.ok);
  if (response.ok && Array.isArray(response.data)) {
    for (const row of response.data) await request(`/rest/v1/${table}?id=eq.${encodeURIComponent(row.id)}`, { token, method: 'DELETE' });
  }
}

async function cleanup(token, userId) {
  for (const table of ['workout_exercise_sets', 'cardio_sessions', 'wearable_workout_sessions', 'workout_sessions', 'exercise_entries', 'training_days', 'training_plans', 'sleep_sessions', 'wearable_daily_metrics', 'daily_checkins', 'meal_entries', 'daily_logs']) {
    try { await request(`/rest/v1/${table}?user_id=eq.${userId}`, { token, method: 'DELETE' }); } catch { /* auth-user cascade is the final cleanup */ }
  }
}

async function request(path, { token, method = 'GET', body, prefer } = {}) {
  const headers = { apikey: apiKey, Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
  const text = await response.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = null; } }
  return { ok: response.ok, status: response.status, data };
}

function cardioRow(userId, workoutSessionId, performedAt, key) {
  return { user_id: userId, workout_session_id: workoutSessionId, performed_at: performedAt, activity_type: 'treadmill', activity_label: 'Synthetic', source: 'security_test', import_method: 'other', duration_seconds: 60, dedupe_key: key, notes: key };
}

function wearableRow(userId, workoutSessionId, performedAt, key) {
  return { user_id: userId, workout_session_id: workoutSessionId, performed_at: performedAt, activity_type: 'strength_training', activity_label: 'Synthetic', source: 'security_test', import_method: 'other', duration_seconds: 60, dedupe_key: key, notes: key };
}

function sleepRow(userId, date, key) {
  return { user_id: userId, sleep_date: date, sleep_start_time: '23:00', sleep_end_time: '06:00', duration_minutes: 420, source: 'security_test', import_method: 'other', dedupe_key: key, notes: key };
}

function updateBody(table, marker) {
  if (table === 'meal_entries') return { food_name: `${marker}-updated` };
  if (table === 'workout_exercise_sets') return { exercise_name: `${marker}-updated` };
  return { notes: `${marker}-updated` };
}

function clean(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function record(name, ok) {
  results.push({ name, ok: Boolean(ok) });
}

function readOptional(path) {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}

function envValue(text, name) {
  const match = text.match(new RegExp(`^${name}\\s*=\\s*["']?([^\\s"']+)`, 'm'));
  return match?.[1];
}
