// Screenshots de UX com dados sintéticos e auditoria de layout por tela/largura.
// Uso: UX_PHASE=before pnpm exec playwright test e2e/ux-capture.spec.ts
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { auditLayout } from './support/layoutAudit';
import { buildScenario, installSyntheticSupabase, navigate, settle } from './support/syntheticSupabase';

const PHASE = process.env.UX_PHASE ?? 'before';
const OUT = join('evidence', 'ux-v3', PHASE);
const WIDTHS = [360, 390, 412, 1440];
// Quarta-feira: dia de Superior no plano de 3 treinos.
const FIXED_NOW = new Date('2026-11-11T19:00:00-03:00');
const TODAY = '2026-11-11';

const summary: Array<Record<string, unknown>> = [];

async function shoot(page: Page, width: number, screen: string) {
  await settle(page);
  const dir = join(OUT, String(width));
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${screen}.png`), fullPage: true });
  const audit = await auditLayout(page);
  await writeFile(join(dir, `${screen}.audit.json`), JSON.stringify(audit, null, 2));
  const counts = audit.findings.reduce<Record<string, number>>((acc, finding) => ({ ...acc, [finding.kind]: (acc[finding.kind] ?? 0) + 1 }), {});
  summary.push({ width, screen, cards: audit.cardCount, maxCardDepth: audit.maxCardDepth, ...counts });
}

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: width >= 1000 ? 900 : 800 } });

    test(`logado com plano de 3 treinos · ${width}`, async ({ page, context, baseURL }) => {
      await page.clock.setFixedTime(FIXED_NOW);
      const mock = await installSyntheticSupabase(context, baseURL!, buildScenario({ today: TODAY }));
      // Aceita só "iniciar fora do recomendado"; qualquer outro diálogo (ex.: gerar plano) é recusado.
      page.on('dialog', (dialog) => (dialog.message().includes('Deseja iniciar mesmo assim') ? dialog.accept() : dialog.dismiss()));
      await page.goto('/');
      await settle(page);

      await shoot(page, width, 'hoje');
      await navigate(page, 'Registrar'); await shoot(page, width, 'registrar');
      await navigate(page, 'Academia'); await shoot(page, width, 'academia');
      const start = page.getByRole('button', { name: 'Iniciar treino', exact: true });
      if (await start.isVisible().catch(() => false)) {
        await start.click();
        await page.getByRole('button', { name: 'Parar timer', exact: true }).waitFor();
        await shoot(page, width, 'academia-sessao');
      }
      await navigate(page, 'Progresso'); await shoot(page, width, 'progresso');
      await navigate(page, 'Saúde'); await shoot(page, width, 'saude');
      await navigate(page, 'Perfil'); await shoot(page, width, 'perfil');

      expect(mock.blocked, 'nenhuma requisição externa pode passar').toEqual([]);
    });

    test(`onboarding (conta nova sintética) · ${width}`, async ({ page, context, baseURL }) => {
      await page.clock.setFixedTime(FIXED_NOW);
      const mock = await installSyntheticSupabase(context, baseURL!, buildScenario({ today: TODAY, onboardingCompleted: false }));
      await page.goto('/');
      await settle(page);
      await shoot(page, width, 'onboarding');
      expect(mock.blocked).toEqual([]);
    });
  });
}

test.afterAll(async () => {
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
});
