import { describe, expect, it } from 'vitest';
import { normalizeCardioImportPayload } from '../services/cardioService';
import { normalizeMealImportPayload } from '../services/mealService';
import { normalizeSleepImportPayload } from '../services/sleepService';
import { normalizeWearableWorkoutPayload } from '../services/strengthWearableService';
import { parseImportJson } from './importSecurity';

const date = '2025-03-15';

describe('segurança da Central JSON', () => {
  it('rejeita JSON inválido', () => {
    expect(() => parseImportJson('{"items":]')).toThrow(/JSON inválido/);
  });

  it('mantém HTML como dado inerte e ignora campos extras no contrato normalizado', () => {
    const raw = parseImportJson(JSON.stringify({
      type: 'meal_import', date, meal_type: 'extra', extra: '<script>globalThis.pwned=true</script>',
      items: [{ food_name: '<img src=x onerror=alert(1)>', grams: 50, kcal: 80 }],
    }));
    const result = normalizeMealImportPayload(raw);
    expect(result.items[0].food_name).toBe('<img src=x onerror=alert(1)>');
    expect(result).not.toHaveProperty('extra');
    expect((globalThis as Record<string, unknown>).pwned).toBeUndefined();
  });

  it('rejeita datas inválidas e futuras', () => {
    expect(() => normalizeMealImportPayload({ date: '2025-02-30', items: [{ food_name: 'Teste', grams: 10, kcal: 10 }] })).toThrow(/data/i);
    expect(() => normalizeMealImportPayload({ date: '2025-03-15<script>', items: [{ food_name: 'Teste', grams: 10, kcal: 10 }] })).toThrow(/data/i);
    expect(() => normalizeSleepImportPayload({ date: '2099-01-01', sleep_start: '22:00', sleep_end: '06:00', duration_minutes: 480 })).toThrow(/data/i);
  });

  it('rejeita números absurdos em todos os leitores', () => {
    expect(() => normalizeMealImportPayload({ date, items: [{ food_name: 'Teste', grams: 1e12, kcal: 10 }] })).toThrow(/Gramas/);
    expect(() => normalizeSleepImportPayload({ date, sleep_start: '22:00', sleep_end: '06:00', duration_minutes: 99_999 })).toThrow(/Duração/);
    expect(() => normalizeCardioImportPayload({ date, start_time: '10:00', duration_seconds: 99_999_999 })).toThrow(/Duração/);
    expect(() => normalizeWearableWorkoutPayload({ date, start_time: '10:00', duration_seconds: 99_999_999 })).toThrow(/Duração/);
  });

  it('bloqueia chaves de prototype pollution', () => {
    expect(() => parseImportJson('{"__proto__":{"polluted":true}}')).toThrow(/inseguro/);
    expect(() => parseImportJson('{"constructor":{"prototype":{"polluted":true}}}')).toThrow(/inseguro/);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('aceita uma lista grande porém razoável sem transformar macro ausente em zero', () => {
    const items = Array.from({ length: 120 }, (_, index) => ({ food_name: `Item sintético ${index}`, grams: 10, kcal: 20 }));
    const parsed = parseImportJson(JSON.stringify({ type: 'meal_import', date, items }));
    const result = normalizeMealImportPayload(parsed);
    expect(result.items).toHaveLength(120);
    expect(result.items[0].protein_g).toBeNull();
  });

  it('recusa listas grandes demais', () => {
    const items = Array.from({ length: 251 }, () => ({ food_name: 'Teste', grams: 10, kcal: 20 }));
    expect(() => parseImportJson(JSON.stringify({ date, items }))).toThrow(/mais de 250/);
  });
});
