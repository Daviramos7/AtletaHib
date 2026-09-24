// Browser smoke with synthetic data only. All Supabase requests are intercepted.
// PLAYWRIGHT_MODULE_PATH may point to a preinstalled playwright/index.mjs.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const baseURL = process.env.SMOKE_URL || 'http://127.0.0.1:5173';
const output = process.env.SMOKE_OUTPUT || join(tmpdir(), 'atleta-hib-polish');
await mkdir(output, { recursive: true });
const env = await readFile(resolve('.env.local'), 'utf8');
const projectURL = env.match(/^VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)?.[1];
assert(projectURL, 'VITE_SUPABASE_URL ausente');
const authKey = `sb-${new URL(projectURL).hostname.split('.')[0]}-auth-token`;
const userId = '00000000-0000-4000-8000-000000000001';
const today = new Date().toLocaleDateString('en-CA');
const iso = `${today}T09:00:00-03:00`;
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'demo@example.test', app_metadata: {}, user_metadata: {}, created_at: iso };
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const session = { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, exp: 4102444800, role: 'authenticated' })}.synthetic`, refresh_token: 'synthetic-only', expires_at: 4102444800, expires_in: 86400, token_type: 'bearer', user };
const dateAgo = (days) => { const date = new Date(`${today}T12:00:00`); date.setDate(date.getDate() - days); return date.toLocaleDateString('en-CA'); };
const profile = { user_id: userId, name: 'Alex', onboarding_completed: true, objective: 'Força e condicionamento', height_cm: 175, current_weight_kg: 79.8, starting_weight_kg: 82, target_weight_kg: 76, water_goal_ml: 2500, kcal_goal: 2200, weekly_strength_days: 4, weekly_cardio_days: 3, training_level: 'intermediario', main_goal: 'saude', diet_style: 'flexivel', wearable_provider: 'redmi_mi_fitness', health_platform: 'health_connect', preferred_sync_mode: 'health_connect', lunch_time: '12:00', training_time: '18:00' };
const days = [1, 2, 4, 5].map((weekday, i) => ({ id: `day-${i}`, plan_id: 'plan-demo', user_id: userId, weekday, title: ['Superior A', 'Inferior A', 'Superior B', 'Inferior B'][i], day_kind: 'strength_cardio', type: 'strength', focus: i % 2 ? 'Pernas' : 'Superior', cardio: 'Esteira leve 10 min', notes: '', exercise_entries: [i % 2 ? 'Leg press' : 'Supino reto com halteres', i % 2 ? 'Mesa flexora' : 'Remada baixa'].map((name, j) => ({ id: `exercise-${i}-${j}`, user_id: userId, training_day_id: `day-${i}`, position: j + 1, exercise_name: name, sets: 2, reps: '8–12', rest_seconds: 75, exercise_role: j ? 'secondary' : 'main', notes: '' })) }));
const plan = { id: 'plan-demo', user_id: userId, name: 'Upper / Lower', objective: 'Força e condicionamento', is_active: true, created_at: iso, training_days: days };
for (const day of days) day.exercise_entries.push({ id: `duration-${day.id}`, user_id: userId, training_day_id: day.id, position: 3, exercise_name: 'Prancha', sets: 2, reps: '20–45 s', rest_seconds: 45, exercise_role: 'accessory', notes: '' });
function makeData(empty = false) {
  return {
    profiles: [structuredClone(profile)], training_plans: [structuredClone(plan)], training_days: structuredClone(days), exercise_entries: days.flatMap((day) => structuredClone(day.exercise_entries)),
    daily_logs: [{ id: 'daily-demo', user_id: userId, log_date: today, water_ml: empty ? 0 : 1200 }],
    daily_checkins: empty ? [] : [{ id: 'checkin-demo', user_id: userId, log_date: today, sleep_hours: 7.5, energy_score: 8, recovery_score: 8, pain_level: 0, soreness_level: 2, stress_score: 3, available_minutes: 50, morning_saved_at: iso, morning_notes: '', joint_pain_locations: [], muscle_soreness_locations: [] }],
    meal_entries: empty ? [] : [{ id: 'meal-demo', user_id: userId, log_date: today, meal_type: 'almoco', food_name: 'Arroz, feijão e frango', grams: 350, kcal: 620, protein_g: 42, carbs_g: 68, fat_g: 18, source: 'manual', created_at: iso }],
    sleep_sessions: empty ? [] : Array.from({ length: 6 }, (_, i) => ({ id: `sleep-${i}`, user_id: userId, sleep_date: dateAgo(i), sleep_start_time: '23:00', sleep_end_time: '06:30', duration_minutes: 450 - i * 5, sleep_score: 82 - i, deep_sleep_minutes: 95, light_sleep_minutes: 255, rem_sleep_minutes: 95, awake_minutes: 5, avg_heart_rate: 56, avg_spo2: 98, source_app: 'Mi Fitness', import_method: 'screenshot_json', confidence: 'high', updated_at: iso })),
    weight_logs: empty ? [] : Array.from({ length: 8 }, (_, i) => ({ id: `weight-${i}`, user_id: userId, log_date: dateAgo(i * 7), weight_kg: 79.8 + i * .3, waist_cm: null })),
    wearable_daily_metrics: empty ? [] : [{ id: 'metric-demo', user_id: userId, metric_date: today, source: 'health_connect', provider: 'redmi_mi_fitness', steps: 6240, sleep_minutes: 450, avg_heart_rate: 68, resting_heart_rate: 56, active_kcal: 340, workout_minutes: 35, distance_km: 4.2, updated_at: iso }],
    health_integrations: empty ? [] : [{ id: 'integration-demo', user_id: userId, provider: 'redmi_mi_fitness', device_name: 'Redmi Watch', source_app: 'Mi Fitness', sync_mode: 'health_connect', status: 'connected', last_sync_at: iso }],
    workout_sessions: [], workout_exercise_sets: [], cardio_sessions: [], wearable_workout_sessions: [], custom_foods: [],
  };
}
const browser = await chromium.launch({ headless: true, ...(process.env.SMOKE_BROWSER_PATH ? { executablePath: process.env.SMOKE_BROWSER_PATH } : {}) });
const results = [];
const allErrors = [];
async function setup(width, height, empty = false, authenticated = true) {
  const context = await browser.newContext({ viewport: { width, height }, timezoneId: 'America/Sao_Paulo', locale: 'pt-BR', reducedMotion: 'reduce' });
  const data = makeData(empty);
  const writes = [];
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(baseURL).origin) return route.continue();
    if (url.origin !== new URL(projectURL).origin) return route.abort();
    const json = (value) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value), headers: { 'access-control-allow-origin': '*' } });
    if (request.method() === 'OPTIONS') return json({});
    if (url.pathname.endsWith('/auth/v1/logout')) {
      writes.push({ table: 'auth_logout', scope: url.searchParams.get('scope') });
      return route.fulfill({ status: 204 });
    }
    if (url.pathname.includes('/auth/')) return json(url.pathname.endsWith('/user') ? user : session);
    const table = url.pathname.split('/').at(-1);
    if (table === 'increment_daily_water') {
      const payload = request.postDataJSON();
      data.daily_logs[0].water_ml += payload.p_delta;
      writes.push({ table, payload });
      return json(data.daily_logs[0]);
    }
    const rows = data[table] ?? [];
    const matches = (row) => [...url.searchParams].every(([key, filter]) => {
      if (['select', 'order', 'limit', 'on_conflict', 'or', 'and', 'offset'].includes(key)) return true;
      const [operator, ...rest] = filter.split('.'); const value = rest.join('.'); const actual = String(row[key]);
      if (operator === 'eq') return actual === value;
      if (operator === 'neq') return actual !== value;
      if (operator === 'gte') return actual >= value;
      if (operator === 'lte') return actual <= value;
      if (operator === 'lt') return actual < value;
      if (operator === 'in') return value.slice(1, -1).split(',').includes(actual);
      return true;
    });
    let response = rows.filter(matches);
    if (request.method() === 'POST') {
      const payload = request.postDataJSON(); writes.push({ table, payload });
      const inserts = (Array.isArray(payload) ? payload : [payload]).map((row, index) => ({ id: row.id ?? `synthetic-${table}-${rows.length + index}`, created_at: iso, ...row }));
      for (const insert of inserts) {
        const conflictKeys = url.searchParams.get('on_conflict')?.split(',');
        const existing = conflictKeys && rows.find((row) => conflictKeys.every((key) => row[key] === insert[key]));
        if (existing) Object.assign(existing, insert); else rows.push(insert);
      }
      data[table] = rows; response = inserts.map((insert) => rows.find((row) => row.id === insert.id) ?? insert);
    } else if (request.method() === 'PATCH') {
      const payload = request.postDataJSON(); writes.push({ table, payload }); response.forEach((row) => Object.assign(row, payload));
    } else if (request.method() === 'DELETE') {
      writes.push({ table, method: 'DELETE' }); data[table] = rows.filter((row) => !matches(row)); response = [];
    }
    response = response.map((row) => table === 'workout_sessions' ? { ...row, training_day: days.find((day) => day.id === row.training_day_id), workout_exercise_sets: data.workout_exercise_sets.filter((set) => set.workout_session_id === row.id), cardio_sessions: data.cardio_sessions.filter((item) => item.workout_session_id === row.id), wearable_workout_sessions: data.wearable_workout_sessions.filter((item) => item.workout_session_id === row.id) } : row);
    const order = url.searchParams.get('order');
    if (order) { const [key, direction] = order.split('.'); response.sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? '')) * (direction === 'desc' ? -1 : 1)); }
    const limit = url.searchParams.get('limit'); if (limit) response = response.slice(0, Number(limit));
    return json(request.headers().accept?.includes('vnd.pgrst.object') ? response[0] ?? null : response);
  });
  if (authenticated) await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: authKey, value: session });
  const page = await context.newPage();
  page.on('pageerror', (error) => allErrors.push(error.message));
  page.on('dialog', (dialog) => dialog.message().includes('novo plano Upper/Lower') ? dialog.dismiss() : dialog.accept());
  await page.goto(baseURL); await page.waitForLoadState('networkidle');
  return { page, context, data, writes };
}
async function capture(page, name) {
  await page.waitForFunction(() => !document.querySelector('.ds-loading-state') && !!document.querySelector('#main-content h2, #main-content h3, .login-card h2'));
  await page.waitForLoadState('networkidle');
  const notice = page.getByRole('button', { name: 'Fechar mensagem', exact: true });
  if (await notice.isVisible() && !await page.getByRole('alertdialog').count()) await notice.click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(output, `${name}.png`), fullPage: true });
  const layout = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, overlay: Boolean(document.querySelector('vite-error-overlay')), content: document.body.innerText.length }));
  if (layout.viewport <= 980 && await page.locator('.mobile-nav').count()) {
    const navigation = await page.locator('.mobile-nav').boundingBox();
    const viewport = page.viewportSize();
    assert(navigation.y >= 0 && navigation.y + navigation.height <= viewport.height + 1, `${name}: navegação fora da viewport`);
  }
  assert(layout.document <= layout.viewport, `${name}: overflow horizontal ${JSON.stringify(layout)}`);
  assert(!layout.overlay && layout.content > 20, `${name}: erro ou tela vazia`);
  results.push({ screen: name, ...layout });
}
async function nav(page, label) {
  const mobile = page.locator('.mobile-nav');
  await (await mobile.isVisible() ? mobile : page.locator('.sidebar nav')).getByRole('button', { name: label, exact: true }).click();
  await page.waitForLoadState('networkidle');
}
try {
  for (const [width, height] of [[390, 844], [360, 800], [412, 915], [1440, 1000]]) {
    const { page, context } = await setup(width, height);
    for (const label of ['Hoje', 'Registrar', 'Academia', 'Progresso', 'Saúde', 'Perfil']) { await nav(page, label); await capture(page, `${width}-${label}`); }
    await nav(page, 'Registrar');
    for (const label of ['Comida', 'Água', 'Check-in', 'Cardio', 'JSON']) { await page.locator('.simple-tabs').getByRole('button', { name: label, exact: true }).click(); await capture(page, `${width}-registrar-${label}`); }
    await nav(page, 'Progresso');
    for (const label of ['Sono', 'Força', 'Relógio', 'Cardio', 'Semana']) { await page.locator('.simple-tabs').getByRole('button', { name: label, exact: true }).click(); await capture(page, `${width}-progresso-${label}`); }
    await nav(page, 'Academia');
    await page.getByRole('button', { name: 'Editar plano', exact: true }).click();
    await capture(page, `${width}-editor`);
    await page.getByRole('button', { name: 'Gerar novo plano', exact: true }).click();
    await page.getByRole('button', { name: 'Voltar ao treino', exact: true }).click();
    await context.close();
  }
  for (const [width, height, cardioMode] of [[390, 844, 'manual'], [360, 800, 'awaiting'], [412, 915, 'skip']]) {
    const { page, context, data, writes } = await setup(width, height);
    await nav(page, 'Academia');
    await page.getByRole('button', { name: 'Iniciar treino', exact: true }).click();
    await page.getByRole('button', { name: 'Parar timer', exact: true }).waitFor();
    const loads = page.getByRole('spinbutton', { name: /carga em kg/ });
    for (const field of await loads.all()) await field.fill('20');
    const durations = page.getByRole('spinbutton', { name: /duração em segundos/ });
    assert.equal(await durations.count(), 2, 'Prancha deve oferecer segundos em cada série');
    for (const field of await durations.all()) await field.fill('30');
    assert.equal(await page.getByRole('spinbutton', { name: /Prancha.*carga em kg/ }).count(), 0);
    assert.match(await page.locator('.hevy-card-v32').filter({ hasText: 'Prancha' }).innerText(), /20–45 s/);
    const pendingSets = page.getByRole('button', { name: /marcar como feita/ });
    while (await pendingSets.count()) await pendingSets.first().click();
    const collisions = await page.evaluate(() => {
      const issues = [];
      for (const row of document.querySelectorAll('.hevy-row-v32, .hevy-header-v32, .hevy-rest-v32, .hevy-card-head-v32, .gym-log-top-v32')) {
        const bounds = row.getBoundingClientRect();
        const children = [...row.children].map((child) => ({ node: child, rect: child.getBoundingClientRect() }));
        for (const { node, rect } of children) {
          if (rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1) issues.push(`Corte em ${row.className}: ${node.textContent}`);
        }
        for (let i = 0; i < children.length; i++) for (let j = i + 1; j < children.length; j++) {
          const a = children[i].rect; const b = children[j].rect;
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) issues.push(`Sobreposição em ${row.className}`);
        }
      }
      return issues;
    });
    assert.deepEqual(collisions, [], 'Blocos de execução devem caber sem sobreposição');
    await capture(page, `${width}-sessao-ativa`);
    await page.locator('.hevy-card-v32').first().scrollIntoViewIfNeeded();
    const navBounds = await page.locator('.mobile-nav').boundingBox();
    assert(navBounds.y >= 0 && navBounds.y + navBounds.height <= height + 1, 'Navegação deve continuar fixa durante scroll');
    await page.screenshot({ path: join(output, `${width}-series-viewport.png`) });
    await page.getByRole('button', { name: 'Concluir força', exact: true }).click();
    await page.getByRole('button', { name: 'Fazer cardio', exact: true }).waitFor();
    assert.equal(data.workout_sessions[0].completed, false, 'Concluir força não finaliza a sessão');
    assert.equal(data.workout_sessions[0].cardio_status, 'pending');
    const timedSets = data.workout_exercise_sets.filter((set) => set.exercise_name === 'Prancha');
    assert.equal(timedSets.length, 2);
    assert(timedSets.every((set) => set.duration_seconds === 30 && set.reps === 0 && set.load_kg === 0));
    assert.equal(await page.getByRole('button', { name: 'Finalizar sessão', exact: true }).count(), 0);
    await capture(page, `${width}-transicao-cardio`);
    if (cardioMode === 'manual') {
      await page.getByRole('button', { name: 'Registrar manualmente', exact: true }).click();
      await page.getByLabel('Duração realizada (min)').fill('25');
      await page.getByRole('button', { name: 'Salvar cardio realizado', exact: true }).click();
      await page.getByText('Cardio registrado.', { exact: true }).waitFor();
      assert.equal(data.cardio_sessions[0].duration_seconds, 1500, 'Execução não pode ser limitada a 20 min');
      assert.equal(data.cardio_sessions[0].distance_km, null);
      assert.equal(data.cardio_sessions[0].counts_toward_daily_totals, false);
      assert.equal(data.cardio_sessions[0].workout_session_id, data.workout_sessions[0].id);
    } else await page.getByRole('button', { name: cardioMode === 'awaiting' ? 'Fiz — anexar relógio depois' : 'Pular hoje', exact: true }).click();
    await page.getByRole('button', { name: 'Finalizar sessão', exact: true }).click();
    await page.locator('.gym-history-v42 summary').first().waitFor();
    assert.equal(data.workout_sessions[0].completed, true);
    assert.equal(data.workout_sessions[0].cardio_status, { manual: 'completed', awaiting: 'awaiting_import', skip: 'skipped' }[cardioMode]);
    await page.locator('.gym-history-v42 summary').first().click();
    await capture(page, `${width}-historico-sessao`);
    assert.match(await page.locator('.gym-history-v42').innerText(), /30 s/);
    assert(!writes.some((write) => write.method === 'DELETE'), 'Finalizar não apaga histórico');
    await nav(page, 'Registrar');
    await page.locator('.simple-tabs').getByRole('button', { name: 'Comida', exact: true }).click();
    const remove = page.getByRole('button', { name: /Excluir/ }).first();
    await remove.click();
    await page.getByRole('alertdialog').waitFor();
    const dialogBounds = await page.getByRole('alertdialog').boundingBox();
    assert(dialogBounds.x >= 0 && dialogBounds.y >= 0 && dialogBounds.width <= width && dialogBounds.height <= height);
    for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); assert(await page.evaluate(() => document.activeElement?.closest('dialog') != null), 'Foco escapou do modal'); }
    await capture(page, `${width}-confirmacao`);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('alertdialog').count(), 0);
    assert(await remove.evaluate((button) => button === document.activeElement), 'Foco não voltou à ação');
    assert.equal(data.meal_entries.length, 1, 'Cancelar preserva alimento');
    await context.close();
  }
  const imports = await setup(390, 844);
  await nav(imports.page, 'Registrar');
  await imports.page.locator('.simple-tabs').getByRole('button', { name: 'JSON', exact: true }).click();
  for (const label of ['Comida', 'Sono', 'Cardio', 'Força relógio']) {
    await imports.page.locator('.json-type-tabs-v364').getByRole('button', { name: label, exact: true }).click();
    await imports.page.getByRole('button', { name: 'Exemplo', exact: true }).click();
    await imports.page.locator('.json-type-tabs-v364').getByRole('button', { name: 'Detectar', exact: true }).click();
    assert(await imports.page.getByRole('button', { name: 'Importar', exact: true }).isDisabled());
    await imports.page.getByRole('button', { name: 'Conferir dados', exact: true }).click();
    await imports.page.locator('.json-preview-v364').waitFor();
    assert(await imports.page.getByRole('button', { name: 'Importar', exact: true }).isEnabled());
    assert.match(await imports.page.locator('.json-preview-v364').innerText(), /Atenção: JSON/);
    await capture(imports.page, `390-preview-${label}`);
  }
  await imports.page.getByLabel('JSON para importar').fill('{');
  assert(await imports.page.getByRole('button', { name: 'Importar', exact: true }).isDisabled(), 'Editar deve invalidar preview');
  assert(!imports.writes.some((write) => ['meal_entries', 'sleep_sessions', 'cardio_sessions', 'wearable_workout_sessions'].includes(write.table)), 'Preview não pode importar');
  await imports.page.locator('.simple-tabs').getByRole('button', { name: 'Cardio', exact: true }).click();
  assert.equal(await imports.page.getByLabel('Distância km (opcional)').inputValue(), '');
  await imports.page.getByLabel('Minutos', { exact: true }).fill('25');
  await imports.page.getByRole('button', { name: 'Salvar corrida', exact: true }).click();
  await imports.page.getByRole('button', { name: 'Apagar', exact: true }).waitFor();
  assert.equal(imports.data.cardio_sessions[0].distance_km, null);
  assert.equal(imports.data.cardio_sessions[0].duration_seconds, 1500);
  await imports.context.close();
  const logout = await setup(1440, 1000);
  await logout.page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
  await logout.page.getByRole('button', { name: 'Sair agora', exact: true }).click();
  await logout.page.locator('.login-card').waitFor();
  assert.deepEqual(logout.writes.filter((write) => write.table === 'auth_logout'), [{ table: 'auth_logout', scope: 'global' }]);
  assert.equal(await logout.page.evaluate((key) => localStorage.getItem(key), authKey), null);
  await capture(logout.page, '1440-logout-global');
  await logout.context.close();
  const login = await setup(390, 844, true, false);
  await capture(login.page, '390-login'); await login.context.close();
  const empty = await setup(390, 844, true);
  await capture(empty.page, '390-hoje-sem-dados');
  await empty.page.getByRole('button', { name: 'Fazer check-in', exact: true }).click();
  await empty.page.waitForLoadState('networkidle');
  const emptyScores = await empty.page.locator('input[type="number"]').evaluateAll((inputs) => inputs.map((input) => ({ label: input.closest('label')?.innerText, value: input.value })));
  assert(emptyScores.every((input) => !input.value), `check-in ausente pré-preenchido: ${JSON.stringify(emptyScores)}`);
  await capture(empty.page, '390-checkin-sem-dados');
  await nav(empty.page, 'Progresso');
  await capture(empty.page, '390-peso-sem-dados');
  assert.equal(await empty.page.getByLabel('Peso kg', { exact: true }).inputValue(), '');
  assert(!await empty.page.locator('.metric-grid').innerText().then((text) => text.includes('0.0 kg')));
  await empty.context.close();
  assert.deepEqual(allErrors, [], 'Erros JavaScript no browser');
  await writeFile(join(output, 'results.json'), JSON.stringify({ results, errors: allErrors }, null, 2));
  console.log(JSON.stringify({ captures: results.length, errors: allErrors, output }, null, 2));
} finally { await browser.close(); }
