// Tela de abertura (#app-splash, gerada por scripts/gerar-abertura.py no index.html).
// Só a abertura fria anima; sai quando a animação acabou E o app está pronto; tocar pula;
// movimento reduzido mostra o logo completo parado. O playwright.config desliga movimento em
// todo teste, então os casos animados pedem reducedMotion: 'no-preference'.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { SYNTHETIC_SUPABASE_URL } from './support/constants';
import { buildScenario, installSyntheticSupabase } from './support/syntheticSupabase';

const TODAY = '2026-11-11';
const VIEW = { width: 375, height: 812 };
const LEAVE_MS = 400; // fade de saída (200ms) + folga

async function open(browser: Browser, baseURL: string, { motion = true, dataDelay = 0, authenticated = true } = {}) {
  const context = await browser.newContext({ viewport: VIEW, reducedMotion: motion ? 'no-preference' : 'reduce' });
  const page = await context.newPage();
  await installSyntheticSupabase(context, baseURL, buildScenario({ today: TODAY }), { authenticated });
  if (dataDelay) {
    await page.route(`${SYNTHETIC_SUPABASE_URL}/rest/v1/**`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, dataDelay));
      await route.fallback();
    });
  }
  await trackSplash(page);
  return { context, page };
}

/** Marca, no relógio da página, quando o conteúdo aparece (para ficar) e quando a splash sai. */
async function trackSplash(page: Page) {
  await page.addInitScript(() => {
    const marks: { contentAt?: number; removedAt?: number } = {};
    (window as any).__splashMarks = marks;
    new MutationObserver(() => {
      const content = document.querySelector('#main-content h2, #main-content h3, .login-card h2');
      if (marks.removedAt === undefined) {
        if (!content) marks.contentAt = undefined;
        else if (marks.contentAt === undefined) marks.contentAt = performance.now();
      }
      if (marks.removedAt === undefined && document.readyState !== 'loading' && !document.getElementById('app-splash')) marks.removedAt = performance.now();
    }).observe(document, { childList: true, subtree: true });
  });
}

async function marks(page: Page) {
  await page.waitForFunction(() => { const m = (window as any).__splashMarks; return m?.contentAt !== undefined && m?.removedAt !== undefined; }, undefined, { timeout: 20_000 });
  return page.evaluate(() => (window as any).__splashMarks as { contentAt: number; removedAt: number });
}

/** Fim da animação de entrada, no relógio da página (animações finitas da splash). */
async function introEnd(page: Page) {
  await page.waitForFunction(() => document.getAnimations().length > 0 && document.getAnimations().every((a) => a.startTime !== null));
  return page.evaluate(() => Math.max(...document.getAnimations()
    .filter((a) => a.effect!.getComputedTiming().iterations !== Infinity)
    .map((a) => Number(a.startTime) + Number(a.effect!.getComputedTiming().endTime))));
}

/** Congela todas as animações no instante `ms` da linha do tempo da abertura. */
async function freezeAt(page: Page, ms: number) {
  await page.evaluate((t) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t; }), ms);
}

/** O nome está inteiro à mostra: sem recorte ou com todos os lados do inset em zero. */
const nameRevealed = (page: Page) => page.locator('#app-splash img').evaluate((el) => {
  const clip = getComputedStyle(el).clipPath;
  return clip === 'none' || /^inset\(([^)]*)\)$/.test(clip) && clip.slice(6, -1).split(' ').every((v) => parseFloat(v) === 0);
});

/** No quadro atual, a bolinha está por cima de cada canto da tela? (sup. esq., sup. dir., inf. esq., inf. dir.) */
const dotCoversScreen = (page: Page) => page.evaluate(() => {
  const w = window.innerWidth; const h = window.innerHeight;
  return [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(([x, y]) => document.elementFromPoint(x, y)?.classList.contains('s-dot') ?? false);
});

const drawn = (page: Page, part: string) => page.locator(`#app-splash .s-${part}`).evaluate((el) => Number(getComputedStyle(el).strokeDashoffset.replace('px', '')));

test('desenha peça por peça na ordem e no sentido certos, emendando com a splash do Android', async ({ browser, baseURL }) => {
  const { context, page } = await open(browser, baseURL!, { dataDelay: 60_000 });
  await page.goto('/', { waitUntil: 'commit' });
  await page.locator('#app-splash svg').waitFor();
  expect(await page.locator('#app-splash').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(7, 10, 9)');

  // Sentido de cada traço = sentido do path: esquerda de baixo pra cima, cima da esquerda pra
  // direita, S de cima pra baixo até a ponta da direita.
  const ends = await page.evaluate(() => Object.fromEntries(['arco-esquerda', 'arco-cima', 'curva-s'].map((name) => {
    const path = document.querySelector<SVGPathElement>(`#app-splash .s-${name}`)!;
    const a = path.getPointAtLength(0); const b = path.getPointAtLength(path.getTotalLength());
    return [name, { start: [a.x, a.y], end: [b.x, b.y] }];
  })));
  expect(ends['arco-esquerda'].start[1]).toBeGreaterThan(ends['arco-esquerda'].end[1]);
  expect(ends['arco-cima'].start[0]).toBeLessThan(ends['arco-cima'].end[0]);
  expect(ends['curva-s'].start[1]).toBeLessThan(ends['curva-s'].end[1]);
  expect(ends['curva-s'].end[0]).toBeGreaterThan(ends['curva-s'].start[0]);

  // Começo: bolinha cobrindo a tela inteira, traços sem desenhar; o símbolo (a caixa dele) com
  // 115px centrado, o tamanho do ícone na splash do Android.
  await freezeAt(page, 0);
  const symbol = await page.locator('#app-splash svg').boundingBox();
  expect(Math.abs(symbol!.width - 115)).toBeLessThanOrEqual(1);
  expect(Math.abs(symbol!.x + symbol!.width / 2 - VIEW.width / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(symbol!.y + symbol!.height / 2 - VIEW.height / 2)).toBeLessThanOrEqual(1);
  expect(await dotCoversScreen(page)).toEqual([true, true, true, true]);
  for (const part of ['arco-esquerda', 'arco-cima', 'curva-s']) expect(await drawn(page, part)).toBeGreaterThanOrEqual(1);

  // Bolinha assentada antes dos traços; depois um traço de cada vez, emendando.
  await freezeAt(page, 470);
  expect(await drawn(page, 'arco-esquerda')).toBeGreaterThanOrEqual(1);
  await freezeAt(page, 500);
  expect(await page.locator('#app-splash .s-dot').evaluate((el) => getComputedStyle(el).transform)).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  await freezeAt(page, 724);
  expect(await drawn(page, 'arco-esquerda')).toBe(0);
  expect(await drawn(page, 'arco-cima')).toBeGreaterThanOrEqual(1);
  await freezeAt(page, 916);
  expect(await drawn(page, 'arco-cima')).toBe(0);
  expect(await drawn(page, 'curva-s')).toBeGreaterThanOrEqual(1);
  await freezeAt(page, 1250);
  expect(await drawn(page, 'curva-s')).toBe(0);
  expect(await page.locator('#app-splash img').evaluate((el) => getComputedStyle(el).clipPath)).toMatch(/inset\(0px 100%/);

  // Fim: logo completo centrado, nome à direita do símbolo, sem encostar nele.
  await freezeAt(page, 1720);
  const final = await page.locator('#app-splash svg').boundingBox();
  const name = await page.locator('#app-splash img').boundingBox();
  expect(name!.x).toBeGreaterThan(final!.x + final!.width);
  expect(Math.abs((final!.x + name!.x + name!.width) / 2 - VIEW.width / 2)).toBeLessThanOrEqual(1);
  expect(await nameRevealed(page)).toBe(true);
  await context.close();
});

for (const viewport of [{ width: 320, height: 568 }, { width: 412, height: 915 }, { width: 1440, height: 900 }]) {
  test(`1º quadro: a bolinha cobre a tela inteira em ${viewport.width}x${viewport.height} e encolhe até o lugar dela`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    await installSyntheticSupabase(context, baseURL!, buildScenario({ today: TODAY }));
    await page.route(`${SYNTHETIC_SUPABASE_URL}/rest/v1/**`, () => new Promise(() => {}));
    await page.goto('/', { waitUntil: 'commit' });
    await page.locator('#app-splash svg').waitFor();
    await freezeAt(page, 0);
    expect(await dotCoversScreen(page)).toEqual([true, true, true, true]);
    // A meio caminho já não cobre (zoom out contínuo) e no fim tem o tamanho normal.
    await freezeAt(page, 250);
    expect(await dotCoversScreen(page)).not.toEqual([true, true, true, true]);
    await freezeAt(page, 500);
    const dot = await page.locator('#app-splash .s-dot').boundingBox();
    const symbol = await page.locator('#app-splash svg').boundingBox();
    expect(Math.abs(dot!.width / symbol!.width - (2 * 95.2) / 805)).toBeLessThan(0.005);
    await context.close();
  });
}

test('dados rápidos: toca a animação inteira uma vez e sai assim que ela termina', async ({ browser, baseURL }) => {
  const { context, page } = await open(browser, baseURL!);
  await page.goto('/', { waitUntil: 'commit' });
  const end = await introEnd(page);
  const { contentAt, removedAt } = await marks(page);
  expect(contentAt, 'o app ficou pronto antes da animação acabar').toBeLessThan(end);
  expect(removedAt).toBeGreaterThanOrEqual(end - 20);
  expect(removedAt - end, `saiu ${Math.round(removedAt - end)}ms depois da animação`).toBeLessThan(LEAVE_MS);
  await context.close();
});

test('dados lentos: segura no logo completo e sai logo que o app fica pronto', async ({ browser, baseURL }) => {
  const { context, page } = await open(browser, baseURL!, { dataDelay: 2_500 });
  await page.goto('/', { waitUntil: 'commit' });
  const end = await introEnd(page);
  await page.waitForFunction((t) => performance.now() > t + 150, end);
  await expect(page.locator('#app-splash img')).toBeVisible();
  expect(await nameRevealed(page)).toBe(true);
  const { contentAt, removedAt } = await marks(page);
  expect(contentAt).toBeGreaterThan(end);
  expect(removedAt - contentAt, `ficou ${Math.round(removedAt - contentAt)}ms depois do conteúdo`).toBeLessThan(LEAVE_MS);
  await context.close();
});

test('tocar na tela pula direto pro app', async ({ browser, baseURL }) => {
  const { context, page } = await open(browser, baseURL!, { dataDelay: 60_000 });
  await page.goto('/', { waitUntil: 'commit' });
  await page.locator('#app-splash svg').waitFor();
  await page.waitForTimeout(300);
  await page.mouse.click(VIEW.width / 2, VIEW.height / 2);
  await expect(page.locator('#app-splash')).toHaveCount(0, { timeout: LEAVE_MS });
  await context.close();
});

test('movimento reduzido: logo completo parado, sem animação, sai assim que o app fica pronto', async ({ browser, baseURL }) => {
  const { context, page } = await open(browser, baseURL!, { motion: false, dataDelay: 1_500 });
  await page.goto('/', { waitUntil: 'commit' });
  await page.locator('#app-splash svg').waitFor();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  for (const part of ['arco-esquerda', 'arco-cima', 'curva-s']) expect(await drawn(page, part)).toBe(0);
  expect(await nameRevealed(page)).toBe(true);
  const { contentAt, removedAt } = await marks(page);
  expect(removedAt - contentAt).toBeLessThan(50);
  await context.close();
});

test('reabrir na mesma sessão não anima de novo (só a abertura fria anima)', async ({ browser, baseURL }) => {
  const { context, page } = await open(browser, baseURL!);
  await page.goto('/');
  await marks(page);
  await page.reload({ waitUntil: 'commit' });
  await page.locator('#app-splash svg').waitFor();
  expect(await page.locator('#app-splash').getAttribute('class')).toContain('is-static');
  const finite = await page.evaluate(() => document.getAnimations().filter((a) => a.effect!.getComputedTiming().iterations !== Infinity).length);
  expect(finite).toBe(0);
  const { contentAt, removedAt } = await marks(page);
  expect(removedAt - contentAt).toBeLessThan(LEAVE_MS);
  await context.close();
});

test('sem sessão: termina a abertura e mostra o login', async ({ browser, baseURL }) => {
  const { context, page } = await open(browser, baseURL!, { authenticated: false });
  await page.goto('/');
  await expect(page.locator('.login-card h2')).toBeVisible();
  await expect(page.locator('#app-splash')).toHaveCount(0, { timeout: 3_000 });
  await context.close();
});
