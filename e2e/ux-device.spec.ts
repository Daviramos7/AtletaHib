// Auditoria de layout no CELULAR REAL (Chrome do aparelho via USB), com o mock sintético.
// Só roda com UX_DEVICE=1 e um aparelho com depuração USB:
//   UX_DEVICE=1 pnpm exec playwright test e2e/ux-device.spec.ts
// Segurança: o Chrome do aparelho é o perfil real do dono. Por isso a interceptação é só na aba
// de teste (page.route, nunca no contexto), a aba abre em 127.0.0.1 (origem isolada do app publicado)
// e no fim limpa o localStorage dessa origem e fecha a aba. Nenhuma conta real é usada.
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, expect, test, type Page } from '@playwright/test';
import { auditLayout, type LayoutFinding } from './support/layoutAudit';
import { buildScenario, installSyntheticSupabase, navigate, settle } from './support/syntheticSupabase';

const ADB = process.env.ADB ?? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const CDP_PORT = 9333;
const APP_PORT = 5199;
const OUT = join('evidence', 'ux-v3', `${process.env.UX_PHASE ?? 'after'}-device`);
const FAILING_KINDS: LayoutFinding['kind'][] = [
  'clipped', 'scroll_hidden', 'text_collision', 'text_covered', 'escapes_card', 'overlap', 'offscreen', 'page_overflow',
  'tight_padding', 'chip_wrap', 'double_divider', 'cramped',
];
const adb = (...args: string[]) => execFileSync(ADB, args, { encoding: 'utf8' }).trim();

test.skip(process.env.UX_DEVICE !== '1', 'precisa de UX_DEVICE=1 e celular com depuração USB');

test('layout no celular real', async ({ baseURL }) => {
  test.setTimeout(900_000);
  const fontScale = adb('shell', 'settings', 'get', 'system', 'font_scale');
  const model = adb('shell', 'getprop', 'ro.product.model');
  adb('reverse', `tcp:${APP_PORT}`, `tcp:${APP_PORT}`);
  // O socket de devtools só existe com o Chrome aberto.
  adb('shell', 'am', 'start', '-n', 'com.android.chrome/com.google.android.apps.chrome.Main', '-a', 'android.intent.action.VIEW', '-d', 'about:blank');
  adb('forward', `tcp:${CDP_PORT}`, 'localabstract:chrome_devtools_remote');
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  const context = browser.contexts()[0];
  const page = await context.newPage();
  const failures: string[] = [];
  const rows: Array<Record<string, unknown>> = [];
  await mkdir(OUT, { recursive: true });
  try {
    await page.clock.setFixedTime(new Date('2026-11-11T19:00:00-03:00'));
    const mock = await installSyntheticSupabase(page, baseURL!, buildScenario({ today: '2026-11-11' }));
    page.on('dialog', (dialog) => (dialog.message().includes('Deseja iniciar mesmo assim') ? dialog.accept() : dialog.dismiss()));

    const check = async (screen: string) => {
      await settle(page);
      await page.screenshot({ path: join(OUT, `${screen}.png`), fullPage: true });
      const closed = await auditLayout(page);
      await page.evaluate(() => document.querySelectorAll('details').forEach((details) => { details.open = true; }));
      const expanded = await auditLayout(page);
      await writeFile(join(OUT, `${screen}.audit.json`), JSON.stringify({ closed, expanded }, null, 2));
      const all = [...closed.findings, ...expanded.findings];
      const depth = Math.max(closed.maxCardDepth, expanded.maxCardDepth);
      rows.push({ screen, maxCardDepth: depth, findings: all.filter((f) => FAILING_KINDS.includes(f.kind)).length });
      for (const f of new Map(all.filter((x) => FAILING_KINDS.includes(x.kind)).map((x) => [`${x.kind}|${x.selector}|${x.detail}`, x])).values()) failures.push(`${screen}: ${f.kind} ${f.selector} — ${f.detail}`);
      if (depth > 1) failures.push(`${screen}: profundidade de card ${depth}`);
    };
    const open = async (label: string, tabs?: string, tab?: string) => {
      await page.goto(baseURL!); await settle(page);
      if (label !== 'Hoje') await navigate(page, label);
      if (tabs && tab) await page.locator(tabs).getByRole('button', { name: tab, exact: true }).click();
    };

    await open('Hoje'); await check('hoje');
    for (const [label, screen] of [['Academia', 'academia'], ['Saúde', 'saude'], ['Perfil', 'perfil']]) { await open(label); await check(screen); }
    for (const [tab, screen] of [['Água', 'registrar'], ['Comida', 'registrar-comida'], ['Check-in', 'registrar-checkin'], ['Cardio', 'registrar-cardio'], ['JSON', 'registrar-json']]) { await open('Registrar', '.logbook-choices', tab); await check(screen); }
    for (const [tab, screen] of [['Peso', 'progresso'], ['Sono', 'progresso-sono'], ['Força', 'progresso-forca'], ['Relógio', 'progresso-relogio'], ['Cardio', 'progresso-cardio'], ['Semana', 'progresso-semana']]) { await open('Progresso', '.progress-domains', tab); await check(screen); }
    await open('Academia');
    await page.getByRole('button', { name: 'Iniciar treino', exact: true }).click();
    await page.getByRole('button', { name: 'Parar timer', exact: true }).waitFor();
    await check('academia-sessao');
    const env = await page.evaluate(() => ({ width: window.innerWidth, dpr: window.devicePixelRatio, rootFont: getComputedStyle(document.documentElement).fontSize, bodyFont: getComputedStyle(document.body).fontSize, ua: navigator.userAgent }));
    await writeFile(join(OUT, 'summary.json'), JSON.stringify({ model, fontScale, ...env, rows }, null, 2));
    expect(mock.blocked).toEqual([]);
  } finally {
    await page.evaluate(() => window.localStorage.clear()).catch(() => undefined);
    await page.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    try { adb('forward', '--remove', `tcp:${CDP_PORT}`); adb('reverse', '--remove', `tcp:${APP_PORT}`); } catch { /* aparelho desconectado */ }
  }
  expect(failures, failures.join('\n')).toEqual([]);
});
