// Focused synthetic browser QA for auth recovery and onboarding.
// Every Supabase request is intercepted; this script never reaches the real backend.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const baseURL = process.env.SMOKE_URL || 'http://127.0.0.1:63139';
const output = process.env.SMOKE_OUTPUT || resolve('evidence/ux-reformulation/after/web');
const browserPath = process.env.SMOKE_BROWSER_PATH;
await mkdir(output, { recursive: true });

const env = await readFile(resolve('.env.local'), 'utf8');
const projectURL = env.match(/^VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)?.[1];
assert(projectURL, 'VITE_SUPABASE_URL ausente');
const projectOrigin = new URL(projectURL).origin;
const authKey = `sb-${new URL(projectURL).hostname.split('.')[0]}-auth-token`;
const userId = '00000000-0000-4000-8000-000000000041';
const otherUserId = '00000000-0000-4000-8000-000000000099';
const today = new Date().toLocaleDateString('en-CA');
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'qa@example.test', app_metadata: {}, user_metadata: {}, created_at: `${today}T09:00:00-03:00` };
const session = { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, exp: 4102444800, role: 'authenticated' })}.synthetic`, refresh_token: 'synthetic-only', expires_at: 4102444800, expires_in: 86400, token_type: 'bearer', user };

function profile(onboardingCompleted) {
  return {
    user_id: userId,
    name: onboardingCompleted ? 'Alex' : '',
    onboarding_completed: onboardingCompleted,
    objective: onboardingCompleted ? 'Força e condicionamento' : '',
    height_cm: onboardingCompleted ? 175 : null,
    current_weight_kg: onboardingCompleted ? 79.8 : null,
    starting_weight_kg: onboardingCompleted ? 82 : null,
    target_weight_kg: onboardingCompleted ? 76 : null,
    water_goal_ml: 2500,
    kcal_goal: 2200,
    weekly_strength_days: 3,
    weekly_cardio_days: 2,
    training_level: 'beginner',
    main_goal: 'health',
    diet_style: 'flexible',
    wearable_provider: 'none',
    health_platform: 'none',
    preferred_sync_mode: 'manual',
    lunch_time: '12:30',
    training_time: '18:00',
  };
}

const trainingDays = [
  ['day-upper-a', 1, 'Superior A', 'Peito e costas'],
  ['day-lower-a', 2, 'Inferior A', 'Pernas'],
  ['day-upper-b', 4, 'Superior B', 'Ombros e costas'],
  ['day-lower-b', 5, 'Inferior B', 'Pernas'],
].map(([id, weekday, title, focus], index) => ({
  id, plan_id: 'plan-qa', user_id: userId, weekday, title, focus,
  day_kind: 'strength_cardio', type: 'strength', cardio: 'Caminhada leve 10 min', notes: '',
  exercise_entries: [{ id: `exercise-${index}`, user_id: userId, training_day_id: id, position: 1, exercise_name: index % 2 ? 'Leg press' : 'Supino com halteres', sets: 3, reps: '8–12', rest_seconds: 75, exercise_role: 'main', notes: '' }],
}));

function seedData(onboardingCompleted) {
  return {
    profiles: [profile(onboardingCompleted)],
    training_plans: onboardingCompleted ? [{ id: 'plan-qa', user_id: userId, name: 'Plano QA', objective: 'Força e condicionamento', is_active: true, created_at: `${today}T09:00:00-03:00`, training_days: structuredClone(trainingDays) }] : [],
    training_days: onboardingCompleted ? structuredClone(trainingDays) : [],
    exercise_entries: onboardingCompleted ? trainingDays.flatMap((day) => structuredClone(day.exercise_entries)) : [],
    weight_logs: [], daily_logs: [{ id: 'daily-qa', user_id: userId, log_date: today, water_ml: 1200 }],
    daily_checkins: [{ id: 'checkin-qa', user_id: userId, log_date: today, sleep_hours: 7.5, energy_score: 8, recovery_score: 8, pain_level: 0, soreness_level: 2, stress_score: 3, available_minutes: 50 }],
    meal_entries: [], sleep_sessions: [], wearable_daily_metrics: [], health_integrations: [], workout_sessions: [], workout_exercise_sets: [], cardio_sessions: [], wearable_workout_sessions: [], custom_foods: [],
  };
}

async function createScenario({ onboardingCompleted = true, authenticated = true, failCompletionOnce = false, malformedDraft = false, width = 390, height = 844 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, timezoneId: 'America/Sao_Paulo', locale: 'pt-BR', reducedMotion: 'reduce' });
  const data = seedData(onboardingCompleted);
  const writes = [];
  let shouldFailCompletion = failCompletionOnce;

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(baseURL).origin) return route.continue();
    if (url.origin !== projectOrigin) return route.abort();
    const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' };
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value), headers: cors });
    if (request.method() === 'OPTIONS') return json({});

    if (url.pathname.endsWith('/auth/v1/signup')) {
      writes.push({ table: 'auth_signup', payload: request.postDataJSON() });
      return json({ user, session: null });
    }
    if (url.pathname.endsWith('/auth/v1/token')) {
      writes.push({ table: 'auth_login', grant: url.searchParams.get('grant_type') });
      return json(session);
    }
    if (url.pathname.endsWith('/auth/v1/recover')) {
      writes.push({ table: 'auth_recover', payload: request.postDataJSON() });
      return json({});
    }
    if (url.pathname.endsWith('/auth/v1/user')) {
      if (request.method() === 'PUT') writes.push({ table: 'auth_update_user', payload: request.postDataJSON() });
      return json(user);
    }
    if (url.pathname.endsWith('/auth/v1/logout')) {
      writes.push({ table: 'auth_logout' });
      return route.fulfill({ status: 204, headers: cors });
    }
    if (url.pathname.includes('/auth/')) return json(session);

    const table = url.pathname.split('/').at(-1);
    const rows = data[table] ?? [];
    const matches = (row) => [...url.searchParams].every(([key, filter]) => {
      if (['select', 'order', 'limit', 'on_conflict', 'or', 'and', 'offset'].includes(key)) return true;
      const [operator, ...parts] = filter.split('.');
      const expected = parts.join('.');
      if (operator === 'eq') return String(row[key]) === expected;
      if (operator === 'neq') return String(row[key]) !== expected;
      return true;
    });
    let response = rows.filter(matches);
    const payload = ['POST', 'PATCH'].includes(request.method()) ? request.postDataJSON() : null;
    const completionPayload = Array.isArray(payload) ? payload.find((item) => item?.onboarding_completed) : payload;
    if (table === 'profiles' && completionPayload?.onboarding_completed && shouldFailCompletion) {
      shouldFailCompletion = false;
      writes.push({ table, failed: true, payload });
      return json({ message: 'Falha sintética ao salvar onboarding.' }, 500);
    }
    if (request.method() === 'POST') {
      const inserts = (Array.isArray(payload) ? payload : [payload]).map((row, index) => ({ id: row.id ?? `qa-${table}-${rows.length + index}`, created_at: `${today}T09:00:00-03:00`, ...row }));
      writes.push({ table, payload });
      for (const insert of inserts) {
        const conflict = url.searchParams.get('on_conflict')?.split(',');
        const existing = conflict && rows.find((row) => conflict.every((key) => row[key] === insert[key]));
        if (existing) Object.assign(existing, insert); else rows.push(insert);
      }
      data[table] = rows;
      response = inserts;
    } else if (request.method() === 'PATCH') {
      writes.push({ table, payload });
      response.forEach((row) => Object.assign(row, payload));
    } else if (request.method() === 'DELETE') {
      writes.push({ table, method: 'DELETE' });
      data[table] = rows.filter((row) => !matches(row));
      response = [];
    }
    const order = url.searchParams.get('order');
    if (order) {
      const [key, direction] = order.split('.');
      response.sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? '')) * (direction === 'desc' ? -1 : 1));
    }
    const limit = Number(url.searchParams.get('limit'));
    if (limit) response = response.slice(0, limit);
    const single = request.headers().accept?.includes('vnd.pgrst.object');
    return json(single ? response[0] ?? null : response);
  });

  if (authenticated) {
    await context.addInitScript(({ key, value, draft, otherKey }) => {
      localStorage.setItem(key, JSON.stringify(value));
      if (draft) localStorage.setItem(`atletahib:onboarding:v1:${value.user.id}`, draft);
      localStorage.setItem(`atletahib:onboarding:v1:${otherKey}`, JSON.stringify({ version: 1, step: 6, form: { name: 'Outro usuário' } }));
    }, { key: authKey, value: session, draft: malformedDraft ? '{malformed' : null, otherKey: otherUserId });
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return { context, page, data, writes, errors };
}

async function open(page, path = '/') {
  await page.goto(new URL(path, baseURL).href);
  await page.waitForLoadState('networkidle');
}

async function testAuth() {
  const signup = await createScenario({ authenticated: false });
  await open(signup.page);
  await signup.page.getByRole('button', { name: 'Criar uma conta' }).click();
  await signup.page.getByLabel('E-mail').fill('novo@example.test');
  await signup.page.locator('input[name="password"]').fill('segredo123');
  await signup.page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await assert.doesNotReject(() => signup.page.getByRole('alert').waitFor());
  assert(signup.writes.some((item) => item.table === 'auth_signup'));
  await signup.context.close();

  const login = await createScenario({ authenticated: false, onboardingCompleted: true });
  await open(login.page);
  await login.page.getByLabel('E-mail').fill('qa@example.test');
  await login.page.locator('input[name="password"]').fill('segredo123');
  await login.page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await login.page.getByRole('heading', { name: 'Hoje', exact: true }).waitFor();
  assert(login.writes.some((item) => item.table === 'auth_login'));
  await login.context.close();

  const request = await createScenario({ authenticated: false });
  await open(request.page);
  await request.page.getByLabel('E-mail').fill('qa@example.test');
  await request.page.getByRole('button', { name: 'Esqueci minha senha' }).click();
  await request.page.getByRole('alert').filter({ hasText: 'link de recuperação' }).waitFor();
  assert(request.writes.some((item) => item.table === 'auth_recover'));
  await request.page.screenshot({ path: join(output, '390-recovery-request.png'), fullPage: true });
  await request.context.close();

  const recovery = await createScenario({ authenticated: true, onboardingCompleted: true });
  await open(recovery.page, '/#type=recovery');
  const password = recovery.page.locator('input[name="new-password"]');
  const confirmation = recovery.page.locator('input[name="confirm-password"]');
  await password.waitFor();
  await recovery.page.screenshot({ path: join(output, '390-recovery-landing.png'), fullPage: true });
  await password.fill('123');
  await confirmation.fill('123');
  assert.equal(await password.evaluate((node) => node.validity.tooShort), true, 'senha curta deve ser inválida');
  await password.fill('segredo123');
  await confirmation.fill('segredo456');
  await recovery.page.getByRole('button', { name: 'Atualizar senha' }).click();
  await recovery.page.getByRole('alert').filter({ hasText: 'iguais' }).waitFor();
  await confirmation.fill('segredo123');
  await recovery.page.getByRole('button', { name: 'Atualizar senha' }).click();
  await recovery.page.getByRole('status').filter({ hasText: 'Senha atualizada' }).waitFor();
  assert(recovery.writes.some((item) => item.table === 'auth_update_user'));
  await recovery.page.getByRole('button', { name: 'Voltar ao Atleta Hib' }).click();
  await recovery.page.getByRole('heading', { name: 'Hoje', exact: true }).waitFor();
  assert.deepEqual(recovery.errors, []);
  await recovery.context.close();
  return { signup: 'PASS', login: 'PASS', recoveryRequest: 'PASS', recoveryLanding: 'PASS', shortPassword: 'PASS (native validity)', mismatch: 'PASS', updateUser: 'PASS', recoveryExit: 'PASS' };
}

async function continueToReview(page) {
  const expectedHeadings = [
    'Como sua semana consegue se mover?',
    'Em que ritmo seu dia acontece?',
    'Como vamos sustentar esse esforço?',
    'Você quer conectar alguma fonte de saúde?',
    'Revise sua base antes de criar o plano',
  ];
  for (const heading of expectedHeadings) {
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByRole('heading', { name: heading }).waitFor();
  }
  const submit = page.locator('.onboarding-actions button[type="submit"]');
  await submit.waitFor();
  assert.equal((await submit.textContent())?.trim(), 'Criar meu plano');
}

async function testOnboarding() {
  const malformed = await createScenario({ onboardingCompleted: false, malformedDraft: true });
  await open(malformed.page);
  await malformed.page.getByRole('heading', { name: 'Vamos começar pelo seu ponto de partida' }).waitFor();
  assert.notEqual(await malformed.page.locator('#name').inputValue(), 'Outro usuário');
  assert.deepEqual(malformed.errors, []);
  await malformed.context.close();

  const flow = await createScenario({ onboardingCompleted: false, failCompletionOnce: true });
  await open(flow.page);
  const next = flow.page.getByRole('button', { name: 'Continuar', exact: true });
  await next.click();
  await flow.page.getByRole('alert').filter({ hasText: 'prefere ser chamado' }).waitFor();
  assert.equal(await flow.page.evaluate(() => document.activeElement?.id), 'name');
  await flow.page.locator('#name').fill('Alexia');
  await flow.page.locator('#height_cm').fill('175');
  await flow.page.locator('#current_weight_kg').fill('80');
  await flow.page.locator('#target_weight_kg').fill('75');
  await next.click();
  await flow.page.getByRole('heading', { name: 'Qual resultado você quer construir?' }).waitFor();

  await flow.page.reload();
  await flow.page.getByRole('heading', { name: 'Qual resultado você quer construir?' }).waitFor();
  const draftKey = `atletahib:onboarding:v1:${userId}`;
  assert.equal(await flow.page.evaluate((key) => JSON.parse(localStorage.getItem(key)).form.name, draftKey), 'Alexia');
  await flow.page.getByRole('button', { name: 'Voltar', exact: true }).click();
  assert.equal(await flow.page.locator('#name').inputValue(), 'Alexia');
  await flow.page.locator('#target_weight_kg').fill('74');
  await next.click();
  await next.click();
  await flow.page.getByRole('heading', { name: 'Como sua semana consegue se mover?' }).waitFor();
  await next.click();
  await flow.page.getByRole('heading', { name: 'Em que ritmo seu dia acontece?' }).waitFor();
  await flow.page.locator('#routine_notes').fill('Não treino às quartas.');
  await next.click();
  await flow.page.getByRole('heading', { name: 'Como vamos sustentar esse esforço?' }).waitFor();
  await next.click();
  await flow.page.getByRole('heading', { name: 'Você quer conectar alguma fonte de saúde?' }).waitFor();
  await next.click();
  await flow.page.getByRole('heading', { name: 'Revise sua base antes de criar o plano' }).waitFor();

  await flow.page.getByRole('button', { name: 'Corrigir direção' }).click();
  await flow.page.locator('#main_goal').selectOption({ index: 1 });
  await continueToReview(flow.page);
  await flow.page.screenshot({ path: join(output, '390-onboarding-review.png'), fullPage: true });
  const createPlan = flow.page.locator('.onboarding-actions button[type="submit"]');
  await createPlan.click();
  await flow.page.waitForTimeout(1200);
  const failureAlert = flow.page.locator('.onboarding-error');
  assert.equal(await failureAlert.count(), 1, `falha sintética ausente; writes=${JSON.stringify(flow.writes.map((item) => ({ table: item.table, failed: item.failed })))}`);
  assert.match(await failureAlert.textContent(), /Não foi possível criar seu plano agora/i);
  assert(flow.writes.some((item) => item.table === 'profiles' && item.failed));
  assert.equal(await createPlan.count(), 1);
  assert.equal(await flow.page.evaluate((key) => JSON.parse(localStorage.getItem(key)).form.target_weight_kg, draftKey), '74');

  await createPlan.click();
  await flow.page.getByRole('heading', { name: 'Hoje', exact: true }).waitFor();
  assert(flow.writes.some((item) => item.table === 'profiles' && item.payload?.onboarding_completed));
  assert(flow.writes.some((item) => item.table === 'training_plans'));
  assert(flow.writes.some((item) => item.table === 'weight_logs'));
  assert.equal(await flow.page.evaluate((key) => localStorage.getItem(key), draftKey), null);
  assert(await flow.page.evaluate((id) => localStorage.getItem(`atletahib:onboarding:v1:${id}`) !== null, otherUserId));
  assert.deepEqual(flow.errors, []);
  await flow.context.close();
  return { malformedDraft: 'PASS', validationFocus: 'PASS', sevenSteps: 'PASS', back: 'PASS', correction: 'PASS', resumePerUser: 'PASS', serviceErrorRetention: 'PASS', planCallback: 'PASS', weightCallback: 'PASS', draftCleanup: 'PASS' };
}

async function testAcademia() {
  const result = {};
  for (const [width, height] of [[360, 800], [390, 844], [412, 915], [1440, 1000]]) {
    const scenario = await createScenario({ onboardingCompleted: true, authenticated: true, width, height });
    await open(scenario.page);
    const navigation = await scenario.page.locator('.mobile-nav').isVisible() ? scenario.page.locator('.mobile-nav') : scenario.page.locator('.sidebar nav');
    await navigation.getByRole('button', { name: 'Academia', exact: true }).click();
    const rows = scenario.page.locator('.weekly-gym-grid-v42 > button');
    await rows.first().waitFor();
    assert.equal(await rows.count(), 4, `${width}: quatro treinos esperados`);
    const geometry = await rows.evaluateAll((buttons) => buttons.map((button) => {
      const selectors = ['.weekly-queue-status', '.weekly-queue-title', '.weekly-queue-meta', '.weekly-queue-selection'];
      const boxes = selectors.map((selector) => button.querySelector(selector)?.getBoundingClientRect()).filter(Boolean).map((box) => ({ left: box.left, right: box.right, top: box.top, bottom: box.bottom }));
      const overlaps = [];
      for (let left = 0; left < boxes.length; left += 1) for (let right = left + 1; right < boxes.length; right += 1) {
        const a = boxes[left]; const b = boxes[right];
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) overlaps.push([left, right]);
      }
      return overlaps;
    }));
    assert(geometry.every((overlaps) => overlaps.length === 0), `${width}: conteúdo sobreposto ${JSON.stringify(geometry)}`);
    await scenario.page.screenshot({ path: join(output, `${width}-Academia.png`), fullPage: true });
    assert.deepEqual(scenario.errors, []);
    result[width] = { status: 'PASS', rows: 4, overlaps: 0 };
    await scenario.context.close();
  }
  return result;
}

const browser = await chromium.launch({ headless: true, ...(browserPath ? { executablePath: browserPath } : {}) });
try {
  const result = { auth: await testAuth(), onboarding: await testOnboarding(), academia: await testAcademia() };
  await writeFile(join(output, 'critical-flows.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
