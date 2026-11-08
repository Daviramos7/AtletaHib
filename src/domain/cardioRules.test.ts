import { describe, expect, it } from 'vitest';
import { CARDIO_RECOMMENDED_CAP_MINUTES, CARDIO_RECOMMENDED_CAP_SECONDS, cardioPrescriptionFromDay, clampCardioMinutes } from './cardioRules';

describe('teto central de cardio', () => {
  it('é 25 min e os minutos derivam dos segundos', () => {
    expect(CARDIO_RECOMMENDED_CAP_SECONDS).toBe(25 * 60);
    expect(CARDIO_RECOMMENDED_CAP_MINUTES).toBe(25);
  });

  it.each([[-3, 0], [12.4, 12], [25, 25], [26, 25], [Number.NaN, 0]])('clampCardioMinutes(%s) = %s', (input, output) => {
    expect(clampCardioMinutes(input)).toBe(output);
  });
});

describe('prescrição de cardio do dia', () => {
  it('lê min/máx/intensidade e respeita o teto central', () => {
    expect(cardioPrescriptionFromDay({ cardio_min_minutes: 20, cardio_max_minutes: 25, cardio_intensity: 'moderado' })).toEqual({ minMinutes: 20, maxMinutes: 25, intensity: 'moderado' });
    expect(cardioPrescriptionFromDay({ cardio_min_minutes: 30, cardio_max_minutes: 60 })).toEqual({ minMinutes: 25, maxMinutes: 25, intensity: 'leve' });
    expect(cardioPrescriptionFromDay({ cardio_max_minutes: 15 })).toEqual({ minMinutes: 15, maxMinutes: 15, intensity: 'leve' });
  });

  it('plano antigo sem prescrição devolve null (ausência ≠ zero)', () => {
    expect(cardioPrescriptionFromDay({})).toBeNull();
    expect(cardioPrescriptionFromDay({ cardio_min_minutes: null, cardio_max_minutes: null })).toBeNull();
  });
});
