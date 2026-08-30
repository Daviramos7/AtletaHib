import { describe, expect, it } from 'vitest';
import { normalizeCardioImportPayload } from './cardioService';
import { buildMealRowKey, normalizeMealImportPayload } from './mealService';
import { normalizeSleepImportPayload } from './sleepService';
import { normalizeWearableWorkoutPayload } from './strengthWearableService';

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

  it('mantém o mesmo fingerprint ao importar o mesmo cardio duas vezes', () => {
    const raw = { date: '2026-07-10', start_time: '18:10', activity_type: 'treadmill', duration_seconds: 1208, distance_km: 2.01 };
    expect(normalizeCardioImportPayload(raw).dedupe_key).toBe(normalizeCardioImportPayload({ ...raw }).dedupe_key);
  });

  it('preserva execução real de 25 minutos sem aplicar o teto da prescrição', () => {
    const cardio = normalizeCardioImportPayload({ date: '2026-07-10', start_time: '18:10', activity_type: 'treadmill', duration_minutes: 25, distance_km: 2.5 });
    expect(cardio.duration_seconds).toBe(1500);
    expect(cardio.distance_km).toBe(2.5);
  });

  it('mantém as flags anti-duplicidade do Health Connect', () => {
    expect(normalizeCardioImportPayload({ date: '2026-07-10', duration_seconds: 1208 })).toMatchObject({
      counts_toward_daily_totals: false,
      metrics_may_already_exist_in_health_connect: true,
    });
  });

  it('preserva distância do wearable sem tratá-la como média', () => {
    expect(normalizeCardioImportPayload({ date: '2026-07-10', duration_seconds: 1208, distance_km: 2.01 })).toMatchObject({ distance_km: 2.01, distance_source: 'wearable' });
  });

  it('aceita distância da esteira como fonte explícita', () => {
    expect(normalizeCardioImportPayload({ date: '2026-07-10', duration_seconds: 1208, distance_km: 2.0, distance_source: 'treadmill' }).distance_source).toBe('treadmill');
  });

  it('mantém wearable de força como complemento vinculável', () => {
    expect(normalizeWearableWorkoutPayload({ date: '2026-07-10', duration_seconds: 1800, workout_session_id: 'session-1' })).toMatchObject({
      workout_session_id: 'session-1',
      counts_toward_daily_totals: false,
      metrics_may_already_exist_in_health_connect: true,
    });
  });

  it('atribui sono cruzando meia-noite ao dia do despertar', () => {
    const sleep = normalizeSleepImportPayload({ date: '2026-07-10', sleep_start: '22:57', sleep_end: '06:20', duration_minutes: 443 });
    const start = new Date(sleep.sleep_start_at);
    const end = new Date(sleep.sleep_end_at);
    expect(start.getDate()).toBe(9);
    expect(end.getDate()).toBe(10);
  });
});
