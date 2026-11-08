// Matriz de aceite de layout: larguras de 320 a 1440 px × escala de texto 100/115/130%
// (aproxima a escala de fonte do Android). Critério: 0 colisão de texto, 0 conteúdo cortado
// ou fora da tela, 0 card sobreposto e profundidade de card ≤ 1, com todos os <details> abertos.
// Uso: UX_PHASE=after pnpm exec playwright test e2e/ux-stress.spec.ts
// UX_REPORT_ONLY=1 grava o relatório sem falhar (para medir o ANTES).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { auditLayout, type LayoutFinding } from './support/layoutAudit';
import { buildScenario, installSyntheticSupabase, navigate, settle } from './support/syntheticSupabase';

const PHASE = process.env.UX_PHASE ?? 'after';
const REPORT_ONLY = process.env.UX_REPORT_ONLY === '1';
const OUT = join('evidence', 'ux-v3', `${PHASE}-stress`);
const FIXED_NOW = new Date('2026-11-11T19:00:00-03:00');
const TODAY = '2026-11-11';
const WIDTHS = [320, 360, 390, 412, 768, 1440];
const SCALES = [1, 1.15, 1.3];
// Prints só dos casos estreitos (os do diagnóstico + o pior); os outros só medem.
const SHOT_CASES = new Set(['320-fonte115', '320-fonte130', '360-fonte115', '360-fonte130', '390-fonte130']);
const FAILING_KINDS: LayoutFinding['kind'][] = ['clipped', 'scroll_hidden', 'text_collision', 'escapes_card', 'overlap', 'offscreen', 'page_overflow'];

const rows: Array<Record<string, unknown>> = [];

/** Aproxima a escala de texto do Android: multiplica o font-size computado de cada elemento. */
async function scaleText(page: Page, factor: number) {
  if (factor === 1) return;
  await page.evaluate((f) => {
    const all = [...document.querySelectorAll<HTMLElement>('body *')];
    const sizes = all.map((el) => Number.parseFloat(getComputedStyle(el).fontSize));
    all.forEach((el, index) => { if (sizes[index]) el.style.fontSize = `${sizes[index] * f}px`; });
  }, factor);
}

async function check(page: Page, tag: string, screen: string, scale: number, failures: string[]) {
  await settle(page);
  await scaleText(page, scale);
  const shots = SHOT_CASES.has(tag);
  const dir = join(OUT, tag);
  if (shots) {
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: join(dir, `${screen}.png`), fullPage: true });
  }
  const closed = await auditLayout(page);
  await page.evaluate(() => document.querySelectorAll('details').forEach((details) => { details.open = true; }));
  const expanded = await auditLayout(page);
  // O JSON da auditoria vai para o disco nos casos com print e em qualquer caso com achado.
  if (shots || closed.findings.length || expanded.findings.length) {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${screen}.audit.json`), JSON.stringify({ closed, expanded }, null, 2));
  }
  const all = [...closed.findings, ...expanded.findings];
  const count = (kind: string) => new Set(all.filter((finding) => finding.kind === kind).map((finding) => `${finding.selector}|${finding.detail}`)).size;
  const row: Record<string, unknown> = { case: tag, screen, maxCardDepth: Math.max(closed.maxCardDepth, expanded.maxCardDepth) };
  for (const kind of [...FAILING_KINDS, 'nested_card']) row[kind] = count(kind);
  rows.push(row);
  const bad = all.filter((finding) => FAILING_KINDS.includes(finding.kind));
  for (const finding of new Map(bad.map((f) => [`${f.kind}|${f.selector}|${f.detail}`, f])).values()) {
    failures.push(`${tag} ${screen}: ${finding.kind} ${finding.selector} — ${finding.detail}`);
  }
  if ((row.maxCardDepth as number) > 1) failures.push(`${tag} ${screen}: profundidade de card ${row.maxCardDepth}`);
}

for (const width of WIDTHS) {
  for (const scale of SCALES) {
    const tag = `${width}-fonte${Math.round(scale * 100)}`;
    test(`layout ${tag}`, async ({ browser, baseURL }) => {
      const failures: string[] = [];
      const height = width >= 1000 ? 900 : 800;
      const options = { viewport: { width, height }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce' as const, serviceWorkers: 'block' as const };

      const context = await browser.newContext(options);
      const page = await context.newPage();
      await page.clock.setFixedTime(FIXED_NOW);
      const mock = await installSyntheticSupabase(context, baseURL!, buildScenario({ today: TODAY }));
      page.on('dialog', (dialog) => (dialog.message().includes('Deseja iniciar mesmo assim') ? dialog.accept() : dialog.dismiss()));
      await page.goto('/');
      await check(page, tag, 'hoje', scale, failures);
      for (const [label, screen] of [['Registrar', 'registrar'], ['Academia', 'academia'], ['Progresso', 'progresso'], ['Saúde', 'saude'], ['Perfil', 'perfil']]) {
        await page.reload(); await settle(page);
        await navigate(page, label);
        await check(page, tag, screen, scale, failures);
      }
      await page.reload(); await settle(page); await navigate(page, 'Academia');
      const start = page.getByRole('button', { name: 'Iniciar treino', exact: true });
      await expect(start).toBeVisible();
      await start.click();
      await page.getByRole('button', { name: 'Parar timer', exact: true }).waitFor();
      await check(page, tag, 'academia-sessao', scale, failures);
      expect(mock.blocked).toEqual([]);
      await context.close();

      const fresh = await browser.newContext(options);
      const onboarding = await fresh.newPage();
      await onboarding.clock.setFixedTime(FIXED_NOW);
      const freshMock = await installSyntheticSupabase(fresh, baseURL!, buildScenario({ today: TODAY, onboardingCompleted: false }));
      await onboarding.goto('/');
      await check(onboarding, tag, 'onboarding', scale, failures);
      expect(freshMock.blocked).toEqual([]);
      await fresh.close();

      if (!REPORT_ONLY) expect(failures, failures.join('\n')).toEqual([]);
    });
  }
}

test.afterAll(async () => {
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'summary.json'), JSON.stringify(rows, null, 2));
});
