// Supabase falso, em memória, para e2e e screenshots. Só dados sintéticos: nenhum dado real,
// nenhuma conta real. O dev server do e2e sobe com VITE_SUPABASE_URL = SYNTHETIC_SUPABASE_URL,
// então o app nem conhece o projeto real; e qualquer origem fora de localhost/mock é abortada.
import type { BrowserContext, Page, Route } from '@playwright/test';
import { buildTrainingPlanFromProfile, PROFILE_FALLBACKS } from '../../src/data/defaultPlan';

import { SYNTHETIC_SUPABASE_URL } from './constants';

export { SYNTHETIC_SUPABASE_URL };
const AUTH_KEY = `sb-${new URL(SYNTHETIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
export const USER_ID = '00000000-0000-4000-8000-000000000001';

type Row = Record<string, any>;
export type SyntheticData = Record<string, Row[]>;

export interface ScenarioOptions {
  onboardingCompleted?: boolean;
  strengthDays?: number;
  /** Data "de hoje" usada nos dados (YYYY-MM-DD). */
  today?: string;
}

export function todayKey(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function shift(key: string, days: number) {
  const date = new Date(`${key}T12:00:00-03:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export function buildScenario({ onboardingCompleted = true, strengthDays = 3, today = todayKey() }: ScenarioOptions = {}): SyntheticData {
  const iso = `${today}T09:00:00-03:00`;
  const profile = {
    ...PROFILE_FALLBACKS,
    user_id: USER_ID, name: 'Alex', onboarding_completed: onboardingCompleted,
    objective: 'Emagrecer mantendo força', height_cm: 175, current_weight_kg: 84.6, starting_weight_kg: 88, target_weight_kg: 78,
    water_goal_ml: 3000, kcal_goal: 2100, weekly_strength_days: strengthDays, weekly_cardio_days: 3,
    training_level: 'intermediario', main_goal: 'emagrecimento', wearable_provider: 'redmi_mi_fitness',
    health_platform: 'health_connect', preferred_sync_mode: 'health_connect', lunch_time: '12:00', training_time: '20:30',
  };

  const template = buildTrainingPlanFromProfile(profile);
  const days = template.days.map((day, dayIndex) => {
    const id = `day-${dayIndex}`;
    const { exercises, ...rest } = day as Row;
    return {
      ...rest, id, plan_id: 'plan-demo', user_id: USER_ID, created_at: iso,
      exercise_entries: (exercises ?? []).map((exercise: Row, index: number) => ({
        ...exercise, id: `${id}-ex-${index}`, user_id: USER_ID, training_day_id: id, load_kg: null, created_at: iso,
      })),
    };
  });
  const plan = { id: 'plan-demo', user_id: USER_ID, name: template.name, objective: template.objective, is_active: true, created_at: iso, training_days: days };

  // Histórico realista: progressão de carga ao longo de 4 semanas e uma queda na última sessão,
  // para as etiquetas do histórico do exercício (Subindo/Caiu, melhor carga, melhor volume) aparecerem.
  const strength = days.filter((day) => String(day.day_kind).includes('strength'));
  const sessions: Row[] = [];
  const sets: Row[] = [];
  const addSession = (dayIndex: number, dateKey: string, loadFactor = 1) => {
    const day = strength[dayIndex % strength.length];
    if (!day) return;
    const id = `session-${sessions.length}`;
    const performedAt = `${dateKey}T20:40:00-03:00`;
    sessions.push({
      id, user_id: USER_ID, training_day_id: day.id, performed_at: performedAt, session_local_date: dateKey,
      completed: true, session_status: 'completed', strength_status: 'completed', cardio_status: 'completed',
      selection_kind: 'manual', workout_variant: 'base', duration_minutes: 74, perceived_effort: 7,
      strength_completed_at: performedAt, completed_at: performedAt, strength_plan: [], cardio_plan: { planned: true, target_minutes: 20, intensity: 'leve' },
      notes: '', created_at: performedAt,
    });
    day.exercise_entries.slice(0, 4).forEach((exercise: Row, exerciseIndex: number) => {
      for (let setNumber = 1; setNumber <= 3; setNumber += 1) {
        sets.push({
          id: `${id}-set-${exerciseIndex}-${setNumber}`, user_id: USER_ID, workout_session_id: id, exercise_entry_id: exercise.id,
          exercise_name: exercise.exercise_name, set_number: setNumber, reps: loadFactor < 1 ? 8 : 10, load_kg: Math.round((20 + exerciseIndex * 10) * loadFactor * 2) / 2,
          duration_seconds: null, perceived_effort: 7, completed: true, performed_at: performedAt, created_at: performedAt,
        });
      }
    });
  };
  addSession(0, shift(today, -22), 1);
  addSession(1, shift(today, -21), 1);
  addSession(0, shift(today, -15), 1.1);
  addSession(1, shift(today, -14), 1.1);
  addSession(0, shift(today, -8), 1.25);
  addSession(1, shift(today, -7), 1.2);
  addSession(0, shift(today, -1), 0.7);

  return {
    profiles: [profile],
    training_plans: [plan],
    training_days: days,
    exercise_entries: days.flatMap((day) => day.exercise_entries),
    daily_logs: [{ id: 'daily-demo', user_id: USER_ID, log_date: today, water_ml: 1750 }],
    daily_checkins: [{ id: 'checkin-demo', user_id: USER_ID, log_date: today, sleep_hours: 7.2, energy_score: 7, recovery_score: 7, hunger_score: 5, stress_score: 4, pain_level: 0, soreness_level: 2, available_minutes: 90, morning_saved_at: iso, morning_notes: '', joint_pain_locations: [], muscle_soreness_locations: [] }],
    meal_entries: [
      { id: 'meal-1', user_id: USER_ID, log_date: today, meal_type: 'cafe', food_name: 'Ovos mexidos com pão integral', grams: 220, kcal: 410, protein_g: 26, carbs_g: 32, fat_g: 18, source: 'manual', created_at: iso },
      { id: 'meal-2', user_id: USER_ID, log_date: today, meal_type: 'almoco', food_name: 'Arroz, feijão, frango grelhado e salada', grams: 420, kcal: 640, protein_g: 48, carbs_g: 70, fat_g: 14, source: 'manual', created_at: iso },
      { id: 'meal-3', user_id: USER_ID, log_date: today, meal_type: 'lanche', food_name: 'Barra de proteína (rótulo sem macros)', grams: 45, kcal: 190, protein_g: null, carbs_g: null, fat_g: null, source: 'manual', created_at: iso },
    ],
    sleep_sessions: Array.from({ length: 7 }, (_, i) => ({ id: `sleep-${i}`, user_id: USER_ID, sleep_date: shift(today, -i), sleep_start_time: '23:20', sleep_end_time: '06:40', duration_minutes: i === 1 ? 356 : 440 - i * 6, sleep_score: i === 1 ? 49 : 80 - i, deep_sleep_minutes: 90, light_sleep_minutes: 250, rem_sleep_minutes: 90, awake_minutes: 10, avg_heart_rate: 57, avg_spo2: 97, source_app: 'Mi Fitness', import_method: 'health_connect', confidence: 'high', updated_at: iso })),
    weight_logs: Array.from({ length: 8 }, (_, i) => ({ id: `weight-${i}`, user_id: USER_ID, log_date: shift(today, -i * 7), weight_kg: Number((84.6 + i * 0.45).toFixed(1)), waist_cm: null })),
    wearable_daily_metrics: [{ id: 'metric-phone', user_id: USER_ID, metric_date: today, source: 'health_connect_phone', provider: 'google_fit', steps: 6900, sleep_minutes: null, avg_heart_rate: null, resting_heart_rate: null, active_kcal: 380, workout_minutes: 0, distance_km: 4.8, updated_at: iso }, ...Array.from({ length: 7 }, (_, i) => ({ id: `metric-${i}`, user_id: USER_ID, metric_date: shift(today, -i), source: 'health_connect_android_bridge', provider: 'redmi_mi_fitness', steps: 7400 - i * 350, sleep_minutes: 440 - i * 6, avg_heart_rate: 71, resting_heart_rate: 57, active_kcal: 420 - i * 15, workout_minutes: i % 2 ? 0 : 70, distance_km: 5.1, updated_at: iso }))],
    health_integrations: [{ id: 'integration-demo', user_id: USER_ID, provider: 'redmi_mi_fitness', device_name: 'Relógio de teste', source_app: 'Mi Fitness', sync_mode: 'health_connect', status: 'connected', last_sync_at: iso }],
    workout_sessions: sessions,
    workout_exercise_sets: sets,
    cardio_sessions: [{ id: 'cardio-today', user_id: USER_ID, workout_session_id: null, performed_at: `${today}T07:10:00-03:00`, activity_type: 'esteira', duration_seconds: 1680, distance_km: 3.4, avg_heart_rate: 122, active_kcal: 240, source: 'manual', counts_toward_daily_totals: false, counts_toward_progression: true, created_at: iso }, ...sessions.map((session, i) => ({ id: `cardio-${i}`, user_id: USER_ID, workout_session_id: session.id, performed_at: session.performed_at, activity_type: 'bike', duration_seconds: 1200, distance_km: 6.2, avg_heart_rate: 128, active_kcal: 190, source: 'manual', counts_toward_daily_totals: false, counts_toward_progression: true, created_at: session.performed_at }))],
    // Treinos importados do relógio (aba Relógio do Progresso), com FC e kcal.
    wearable_workout_sessions: sessions.slice(-3).map((session, i) => ({
      id: `wearable-${i}`, user_id: USER_ID, workout_session_id: session.id, performed_at: session.performed_at,
      activity_label: 'Treino de força', device_name: 'Redmi Watch', source_app: 'Mi Fitness', dedupe_key: `mi-${i}`,
      duration_seconds: 4380 - i * 120, active_kcal: 410 + i * 12, total_kcal: 520 + i * 15, avg_heart_rate: 112 + i, max_heart_rate: 158 + i,
      metrics_may_already_exist_in_health_connect: i === 0, created_at: session.performed_at,
    })),
    custom_foods: [],
  };
}

export interface MockHandle {
  data: SyntheticData;
  writes: Array<Record<string, unknown>>;
  blocked: string[];
}

/** Instala o mock no contexto e uma sessão sintética (sem tela de login). */
// Aceita contexto inteiro (desktop) ou só uma aba (Chrome real do celular: não pode interceptar as outras abas).
export async function installSyntheticSupabase(context: Pick<BrowserContext, 'route' | 'addInitScript'>, baseURL: string, data: SyntheticData, { authenticated = true } = {}): Promise<MockHandle> {
  const handle: MockHandle = { data, writes: [], blocked: [] };
  const appOrigin = new URL(baseURL).origin;
  const mockOrigin = new URL(SYNTHETIC_SUPABASE_URL).origin;
  const iso = new Date().toISOString();
  const user = { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'demo@example.test', app_metadata: {}, user_metadata: {}, created_at: iso };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const session = { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: USER_ID, exp: 4102444800, role: 'authenticated' })}.synthetic`, refresh_token: 'synthetic-only', expires_at: 4102444800, expires_in: 86400, token_type: 'bearer', user };

  await context.route('**/*', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === appOrigin || url.protocol === 'data:' || url.protocol === 'blob:') return route.continue();
    // Fontes do Google são estáticas e não carregam dado; o resto de fora é bloqueado.
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return route.continue();
    if (url.origin !== mockOrigin) { handle.blocked.push(url.origin); return route.abort(); }

    const json = (value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value), headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (request.method() === 'OPTIONS') return json({});
    if (url.pathname.endsWith('/auth/v1/logout')) return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    if (url.pathname.includes('/auth/')) return json(url.pathname.endsWith('/user') ? user : session);

    const table = url.pathname.split('/').at(-1) ?? '';
    if (table === 'increment_daily_water') {
      const payload = request.postDataJSON();
      data.daily_logs[0].water_ml += payload.p_delta;
      handle.writes.push({ table, payload });
      return json(data.daily_logs[0]);
    }
    const rows = data[table] ?? (data[table] = []);
    const matches = (row: Row) => [...url.searchParams].every(([key, filter]) => {
      if (['select', 'order', 'limit', 'on_conflict', 'or', 'and', 'offset', 'columns'].includes(key)) return true;
      const [operator, ...rest] = filter.split('.');
      const value = rest.join('.');
      const actual = String(row[key]);
      if (operator === 'eq') return actual === value;
      if (operator === 'neq') return actual !== value;
      if (operator === 'gte') return actual >= value;
      if (operator === 'gt') return actual > value;
      if (operator === 'lte') return actual <= value;
      if (operator === 'lt') return actual < value;
      if (operator === 'is') return value === 'null' ? row[key] == null : actual === value;
      if (operator === 'in') return value.slice(1, -1).split(',').includes(actual);
      return true;
    });
    let response = rows.filter(matches);
    const method = request.method();
    if (method === 'POST') {
      const payload = request.postDataJSON();
      handle.writes.push({ table, method, payload });
      const inserts = (Array.isArray(payload) ? payload : [payload]).map((row: Row, index: number) => ({ id: row.id ?? `synthetic-${table}-${rows.length + index}`, created_at: iso, ...row }));
      const conflictKeys = url.searchParams.get('on_conflict')?.split(',');
      for (const insert of inserts) {
        const existing = conflictKeys && rows.find((row) => conflictKeys.every((key) => row[key] === insert[key]));
        if (existing) Object.assign(existing, insert); else rows.push(insert);
      }
      response = inserts.map((insert: Row) => rows.find((row) => row.id === insert.id) ?? insert);
    } else if (method === 'PATCH') {
      const payload = request.postDataJSON();
      handle.writes.push({ table, method, payload });
      response.forEach((row) => Object.assign(row, payload));
    } else if (method === 'DELETE') {
      handle.writes.push({ table, method });
      data[table] = rows.filter((row) => !matches(row));
      response = [];
    }
    if (table === 'workout_sessions') {
      response = response.map((row) => ({
        ...row,
        training_day: data.training_days.find((day) => day.id === row.training_day_id),
        workout_exercise_sets: data.workout_exercise_sets.filter((set) => set.workout_session_id === row.id),
        cardio_sessions: data.cardio_sessions.filter((item) => item.workout_session_id === row.id),
        wearable_workout_sessions: data.wearable_workout_sessions.filter((item) => item.workout_session_id === row.id),
      }));
    }
    const order = url.searchParams.get('order');
    if (order) {
      const [key, direction] = order.split(',')[0].split('.');
      response = [...response].sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? '')) * (direction === 'desc' ? -1 : 1));
    }
    const limit = url.searchParams.get('limit');
    if (limit) response = response.slice(0, Number(limit));
    const single = request.headers().accept?.includes('vnd.pgrst.object');
    return json(single ? response[0] ?? null : response);
  });

  if (authenticated) {
    await context.addInitScript(({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)), { key: AUTH_KEY, value: session });
  }
  return handle;
}

/** Espera a tela estabilizar: sem loading e com título visível. */
export async function settle(page: Page) {
  await page.waitForFunction(() => !document.querySelector('.ds-loading-state') && Boolean(document.querySelector('#main-content h2, #main-content h3, .login-card h2, .onboarding-flow h1, main h2')), undefined, { timeout: 20_000 });
  await page.waitForLoadState('networkidle');
  const notice = page.getByRole('button', { name: 'Fechar mensagem', exact: true });
  if (await notice.isVisible().catch(() => false)) await notice.click();
  await page.evaluate(() => window.scrollTo(0, 0));
}

export async function navigate(page: Page, label: string) {
  const mobile = page.locator('.mobile-nav');
  const scope = (await mobile.isVisible()) ? mobile : page.locator('.sidebar nav');
  await scope.getByRole('button', { name: label, exact: true }).click();
  await settle(page);
}
