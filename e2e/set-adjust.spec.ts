// + e − série durante a sessão ativa da Academia, com dados sintéticos (nada chega ao banco).
// Regras: + acrescenta no fim e renumera; − tira a última; série com dado pede confirmação;
// o exercício nunca fica com menos de 1 série.
import { expect, test, type Page } from '@playwright/test';
import { buildScenario, installSyntheticSupabase, navigate, settle } from './support/syntheticSupabase';

const FIXED_NOW = new Date('2026-11-11T19:00:00-03:00');

test.use({ viewport: { width: 360, height: 800 } });

async function startSession(page: Page) {
  await navigate(page, 'Academia');
  await page.getByRole('button', { name: 'Iniciar treino', exact: true }).click();
  await page.getByRole('button', { name: 'Parar timer', exact: true }).waitFor();
}

test('+ e − série na sessão ativa', async ({ page, context, baseURL }) => {
  await page.clock.setFixedTime(FIXED_NOW);
  const mock = await installSyntheticSupabase(context, baseURL!, buildScenario({ today: '2026-11-11' }));
  const dialogs: string[] = [];
  let answer = true;
  page.on('dialog', (dialog) => {
    if (dialog.message().includes('Deseja iniciar mesmo assim')) return dialog.accept();
    dialogs.push(dialog.message());
    return answer ? dialog.accept() : dialog.dismiss();
  });
  await page.goto('/');
  await settle(page);
  await startSession(page);

  const card = page.locator('.hevy-card-v32').first();
  const name = (await card.locator('.hevy-card-head-v32 strong').first().innerText()).trim();
  const rows = card.getByRole('button', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, série \\d+: `) });
  const add = page.getByRole('button', { name: `Adicionar uma série em ${name}`, exact: true });
  const remove = page.getByRole('button', { name: `Remover a última série de ${name}`, exact: true });
  const initial = await rows.count();
  expect(initial).toBeGreaterThan(1);

  // + acrescenta no fim, com o número seguinte.
  await add.click();
  await expect(rows).toHaveCount(initial + 1);
  await expect(card.getByText(`${initial + 1} séries`, { exact: true })).toBeVisible();
  await expect(rows.last()).toHaveAccessibleName(`${name}, série ${initial + 1}: marcar como feita`);

  // − numa série sem dado sai direto, sem perguntar.
  await remove.click();
  await expect(rows).toHaveCount(initial);
  expect(dialogs).toEqual([]);

  // − numa série feita pergunta; recusar mantém, aceitar remove.
  await add.click();
  await rows.last().click();
  await expect(rows.last()).toHaveAttribute('aria-pressed', 'true');
  answer = false;
  await remove.click();
  await expect(rows).toHaveCount(initial + 1);
  expect(dialogs).toHaveLength(1);
  expect(dialogs[0]).toContain(`A série ${initial + 1} de ${name} já tem dados`);
  answer = true;
  await remove.click();
  await expect(rows).toHaveCount(initial);

  // Nunca abaixo de 1 série: o − desabilita.
  for (let left = initial; left > 1; left -= 1) await remove.click();
  await expect(rows).toHaveCount(1);
  await expect(remove).toBeDisabled();
  await expect(card.getByText('1 série', { exact: true })).toBeVisible();

  expect(mock.blocked).toEqual([]);
});
