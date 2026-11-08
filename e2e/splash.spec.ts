// Tela de abertura (#app-splash no index.html): aparece no 1º quadro, igual à splash do Android,
// e sai assim que sessão e dados carregam — sem tempo mínimo.
import { expect, test, type Page } from '@playwright/test';
import { SYNTHETIC_SUPABASE_URL } from './support/constants';
import { buildScenario, installSyntheticSupabase } from './support/syntheticSupabase';

const TODAY = '2026-11-11';
const DATA_DELAY_MS = 1500;

/** Marca, no relógio da própria página, quando o conteúdo aparece e quando a splash sai. */
async function trackSplash(page: Page) {
  await page.addInitScript(() => {
    const marks: { contentAt?: number; removedAt?: number } = {};
    (window as any).__splashMarks = marks;
    new MutationObserver(() => {
      // Conteúdo que aparece e some de novo (o app pisca a tela principal antes de carregar os
      // dados do usuário) não conta: vale o instante em que ele aparece para ficar.
      const content = document.querySelector('#main-content h2, #main-content h3, .login-card h2');
      if (marks.removedAt === undefined) {
        if (!content) marks.contentAt = undefined;
        else if (marks.contentAt === undefined) marks.contentAt = performance.now();
      }
      if (marks.removedAt === undefined && document.readyState !== 'loading' && !document.getElementById('app-splash')) marks.removedAt = performance.now();
    }).observe(document, { childList: true, subtree: true });
  });
}

/** Quanto a splash ficou depois do conteúdo pronto (ms, medido na página). */
async function lingerAfterContent(page: Page) {
  await page.waitForFunction(() => { const m = (window as any).__splashMarks; return m?.contentAt !== undefined && m?.removedAt !== undefined; }, undefined, { timeout: 20_000 });
  return page.evaluate(() => { const m = (window as any).__splashMarks; return m.removedAt - m.contentAt; });
}

/** Atrasa só as consultas de dados (rest/v1) do mock: simula rede lenta no carregamento. */
async function slowData(page: Page, delay: number) {
  await page.route(`${SYNTHETIC_SUPABASE_URL}/rest/v1/**`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    await route.fallback();
  });
}

test('fica enquanto os dados carregam e sai logo depois, com o logo onde a splash do Android o deixa', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await installSyntheticSupabase(context, baseURL!, buildScenario({ today: TODAY }));
  await slowData(page, DATA_DELAY_MS);
  await trackSplash(page);
  const started = Date.now();
  await page.goto('/', { waitUntil: 'commit' });

  const splash = page.locator('#app-splash');
  await expect(splash).toBeVisible();
  // Continuidade com a splash do sistema: mesmo fundo, símbolo de 115px centrado na tela.
  expect(await splash.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(7, 10, 9)');
  const logo = await page.locator('#app-splash img').boundingBox();
  expect(logo).not.toBeNull();
  expect(Math.round(logo!.width)).toBe(115);
  expect(Math.abs(logo!.x + logo!.width / 2 - 375 / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(logo!.y + logo!.height / 2 - 812 / 2)).toBeLessThanOrEqual(1);

  // Ainda carregando dados: continua na tela.
  await page.waitForTimeout(DATA_DELAY_MS / 2);
  await expect(splash).toBeVisible();

  // Dados chegaram: o app aparece e a splash some com só o fade curto de saída (180ms).
  const lingered = await lingerAfterContent(page);
  expect(lingered, `splash ficou ${Math.round(lingered)}ms depois do conteúdo`).toBeLessThan(400);
  expect(Date.now() - started).toBeGreaterThan(DATA_DELAY_MS);
  await context.close();
});

test('carga rápida: some rápido, sem atraso artificial', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await installSyntheticSupabase(context, baseURL!, buildScenario({ today: TODAY }));
  await trackSplash(page);
  await page.goto('/');
  const lingered = await lingerAfterContent(page);
  expect(lingered, `splash ficou ${Math.round(lingered)}ms depois do conteúdo`).toBeLessThan(400);
  await context.close();
});

test('movimento reduzido: sem animação e saída imediata', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await installSyntheticSupabase(context, baseURL!, buildScenario({ today: TODAY }));
  await slowData(page, DATA_DELAY_MS);
  await trackSplash(page);
  await page.goto('/', { waitUntil: 'commit' });
  const mark = page.locator('#app-splash .app-splash-mark');
  await expect(mark).toBeVisible();
  expect(await mark.evaluate((el) => [getComputedStyle(el).animationName, getComputedStyle(el, '::before').animationName])).toEqual(['none', 'none']);
  // Sem fade: sai no mesmo instante em que o conteúdo aparece.
  expect(await lingerAfterContent(page)).toBeLessThan(50);
  await context.close();
});

test('sem sessão: sai e mostra o login', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await installSyntheticSupabase(context, baseURL!, buildScenario({ today: TODAY }), { authenticated: false });
  await page.goto('/');
  await expect(page.locator('.login-card h2')).toBeVisible();
  await expect(page.locator('#app-splash')).toHaveCount(0, { timeout: 2_000 });
  await context.close();
});
