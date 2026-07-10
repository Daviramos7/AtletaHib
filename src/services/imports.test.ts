import { describe, expect, it } from 'vitest';
import { normalizeCardioImportPayload } from './cardioService';
import { buildMealRowKey, normalizeMealImportPayload } from './mealService';
import { normalizeSleepImportPayload } from './sleepService';

describe('importações JSON', () => {
  it('bloqueia comida sem data', () => {
    expect(() => normalizeMealImportPayload({ items: [{ name: 'Peixe', grams: 150, kcal: 210 }] })).toThrow(/sem data/i);
  });

  it('gera a mesma chave para a mesma comida reimportada', () => {
    const payload = normalizeMealImportPayload({ date: '2026-07-10', meal_type: 'jantar', items: [{ name: 'Peixe', grams: 150, kcal: 210 }] });
    const row = { log_date: payload.log_date, ...payload.items[0] };
    expect(buildMealRowKey(row)).toBe(buildMealRowKey({ ...row }));
  });

  it('bloqueia duration ambíguo e aceita 20:08', () => {
    expect(() => normalizeCardioImportPayload({ date: '2026-07-10', duration: 20 })).toThrow(/duração válida/i);
    expect(normalizeCardioImportPayload({ date: '2026-07-10', duration_seconds: 1208 }).duration_seconds).toBe(1208);
  });

  it('mantém cardio manual/importado sem distância como null', () => {
    expect(normalizeCardioImportPayload({ date: '2026-07-10', duration_minutes: 20 }).distance_km).toBeNull();
  });

  it('atribui sono cruzando meia-noite ao dia do despertar', () => {
    const sleep = normalizeSleepImportPayload({ date: '2026-07-10', sleep_start: '22:57', sleep_end: '06:20', duration_minutes: 443 });
    const start = new Date(sleep.sleep_start_at);
    const end = new Date(sleep.sleep_end_at);
    expect(start.getDate()).toBe(9);
    expect(end.getDate()).toBe(10);
  });
});
