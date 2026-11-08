// Estresse de layout: larguras estreitas + texto ampliado (como a escala de fonte do Android).
// Só diagnóstico. Uso: UX_PHASE=before pnpm exec playwright test e2e/ux-stress.spec.ts
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { auditLayout } from './support/layoutAudit';
import { buildScenario, installSyntheticSupabase, navigate, settle } from './support/syntheticSupabase';

const PHASE = process.env.UX_PHASE ?? 'before';
const OUT = join('evidence', 'ux-v3', `${PHASE}-stress`);
const FIXED_NOW = new Date('2026-11-11T19:00:00-03:00');
const CASES = [
  { width: 320, scale: 1.15 },
  { width: 360, scale: 1.15 },
  { width: 360, scale: 1.3 },
  { width: 390, scale: 1.3 },
];
const rows: Array<Record<string, unknown>> = [];

/** Aproxima a escala de texto do Android: multiplica o font-size computado de cada elemento. */
async function scaleText(page: Page, factor: number) {
  await page.evaluate((f) => {
    const all = [...document.querySelectorAll<HTMLElement>('body *')];
    const sizes = all.map((el) => Number.parseFloat(getComputedStyle(el).fontSize));
    all.forEach((el, index) => { if (sizes[index]) el.style.fontSize = `${sizes[index] * f}px`; });
  }, factor);
}

async function check(page: Page, tag: string, screen: string, scale: number) {
  await settle(page);
  await scaleText(page, scale);
  const dir = join(OUT, tag);
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${screen}.png`), fullPage: true });
  const closed = await auditLayout(page);
  await page.evaluate(() => document.querySelectorAll('details').forEach((details) => { details.open = true; }));
  const expanded = await auditLayout(page);
  await page.screenshot({ path: join(dir, `${screen}-expandido.png`), fullPage: true });
  await writeFile(join(dir, `${screen}.audit.json`), JSON.stringify({ closed, expanded }, null, 2));
  const count = (audit: typeof closed, kind: string) => audit.findings.filter((finding) => finding.kind === kind).length;
  rows.push({
    case: tag, screen, maxCardDepth: expanded.maxCardDepth,
    clipped: count(expanded, 'clipped'), textCollision: count(expanded, 'text_collision'), textCollisionClosed: count(closed, 'text_collision'), escapes: count(expanded, 'escapes_card'), overlap: count(expanded, 'overlap'),
    offscreen: count(expanded, 'offscreen'), nested: count(expanded, 'nested_card'), pageOverflow: count(expanded, 'page_overflow'),
  });
}

for (const { width, scale } of CASES) {
  const tag = `${width}-fonte${Math.round(scale * 100)}`;
  test(`estresse ${tag}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ viewport: { width, height: 800 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.clock.setFixedTime(FIXED_NOW);
    const mock = await installSyntheticSupabase(context, baseURL!, buildScenario({ today: '2026-11-11' }));
    page.on('dialog', (dialog) => (dialog.message().includes('Deseja iniciar mesmo assim') ? dialog.accept() : dialog.dismiss()));
    await page.goto('/');
    await check(page, tag, 'hoje', scale);
    for (const [label, screen] of [['Registrar', 'registrar'], ['Academia', 'academia'], ['Progresso', 'progresso'], ['Saúde', 'saude'], ['Perfil', 'perfil']]) {
      await page.reload(); await settle(page);
      await navigate(page, label);
      await check(page, tag, screen, scale);
    }
    await page.reload(); await settle(page); await navigate(page, 'Academia');
    const start = page.getByRole('button', { name: 'Iniciar treino', exact: true });
    if (await start.isVisible().catch(() => false)) {
      await start.click();
      await page.getByRole('button', { name: 'Parar timer', exact: true }).waitFor();
      await check(page, tag, 'academia-sessao', scale);
    }
    expect(mock.blocked).toEqual([]);
    await context.close();
  });
}

test.afterAll(async () => {
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'summary.json'), JSON.stringify(rows, null, 2));
});
