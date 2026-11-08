import { defineConfig } from '@playwright/test';
import { SYNTHETIC_SUPABASE_URL } from './e2e/support/constants';

// Só local: o app roda no dev server desta máquina e TODO acesso ao Supabase é
// interceptado com dados sintéticos (e2e/support/syntheticSupabase.ts). Nada chega ao banco.
// Porta própria: nunca reaproveita um dev server aberto com o .env.local real.
const baseURL = 'http://127.0.0.1:5199';
const host = new URL(baseURL).hostname;
if (!['127.0.0.1', 'localhost'].includes(host)) {
  throw new Error(`E2E recusado: ${baseURL} não é local.`);
}

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 120_000,
  use: {
    baseURL,
    // Chrome já instalado na máquina: nenhum browser é baixado.
    channel: 'chrome',
    headless: true,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    reducedMotion: 'reduce',
    // Service worker escaparia da interceptação de rede.
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'pnpm exec vite --host 127.0.0.1 --port 5199 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
    // Variável de ambiente vence o .env.local no Vite: o app nem conhece a URL do projeto real.
    env: { VITE_SUPABASE_URL: SYNTHETIC_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: 'synthetic-anon-key-e2e' },
    timeout: 120_000,
  },
});
