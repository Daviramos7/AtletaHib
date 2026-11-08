import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // .claude/ guarda skills locais (moldes Playwright), que não são testes do app.
    exclude: [...configDefaults.exclude, '.claude/**', '.agent-grid/**', 'e2e/**'],
  },
});
