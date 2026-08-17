import { describe, expect, it } from 'vitest';
import { buildDailyReadiness } from '../utils/readinessAdvisor';
import { buildAdaptiveWorkoutRecommendation } from './adaptiveWorkout';
import { calculateReadiness } from './readiness';

const NOW = new Date('2026-08-17T08:00:00-03:00');
const CHECKIN = {
  log_date: '2026-08-17',
  morning_saved_at: '2026-08-17T04:40:00-03:00',
  sleep_hours: 6.2,
  energy_score: 5,
  recovery_score: 5,
  hunger_score: 5,
  stress_score: 4,
  pain_level: 0,
  soreness_level: 2,
};

describe('fonte canônica de prontidão', () => {
  it('produz o mesmo score e nível no cálculo canônico, Hoje e Academia com os mesmos dados', () => {
    const canonical = calculateReadiness({ checkin: CHECKIN, now: NOW, timeZone: 'America/Sao_Paulo' });
    const today = buildDailyReadiness({ checkin: CHECKIN, now: NOW, timeZone: 'America/Sao_Paulo' });
    const gym = buildAdaptiveWorkoutRecommendation({
      checkin: CHECKIN,
      now: NOW,
      timeZone: 'America/Sao_Paulo',
      completedSets: [],
      baseExercises: [{ id: 'supino', exercise_name: 'Supino máquina', sets: '3', reps: '10', rest_seconds: 90, exercise_role: 'main' }],
    });

    expect(today.score).toBe(canonical.score);
    expect(today.level).toBe(canonical.level);
    expect(gym.readinessScore).toBe(canonical.score);
    expect(gym.readinessLevel).toBe(canonical.level);
  });

  it('mantém Hoje e Academia iguais quando ambos recebem a mesma carga recente', () => {
    const baseExercises = [{ id: 'leg', exercise_name: 'Leg press 45°', sets: '3', reps: '10', rest_seconds: 90, exercise_role: 'main' }];
    const completedSets = Array.from({ length: 5 }, (_, index) => ({
      exercise_name: 'Leg press 45°', reps: 10, load_kg: 100, perceived_effort: 9,
      performed_at: new Date(new Date('2026-08-16T07:00:00-03:00').getTime() + index * 60_000).toISOString(),
    }));
    const today = buildDailyReadiness({
      checkin: CHECKIN,
      completedSets,
      baseExercises,
      todayPlan: { strength: true, cardio: false },
      now: NOW,
      timeZone: 'America/Sao_Paulo',
    });
    const gym = buildAdaptiveWorkoutRecommendation({ checkin: CHECKIN, completedSets, baseExercises, now: NOW, timeZone: 'America/Sao_Paulo' });
    expect(today.score).toBe(gym.readinessScore);
    expect(today.level).toBe(gym.readinessLevel);
  });

  it('reconhece sinais independentes sem punir a mesma musculatura em todas as janelas', () => {
    const result = calculateReadiness({
      checkin: { ...CHECKIN, sleep_hours: 7.5, energy_score: 8, recovery_score: 8 },
      now: NOW,
      workload: {
        high48h: ['quadríceps'],
        moderate72h: ['quadríceps'],
        high7d: ['quadríceps', 'peito'],
      },
    });

    expect(result.relevantSignals.workload).toEqual({ high48h: ['quadríceps'], moderate72h: [], high7d: ['peito'] });
    expect(result.reasons.some((reason) => reason.includes('quadríceps'))).toBe(true);
    expect(result.reasons.some((reason) => reason.includes('peito'))).toBe(true);
  });

  it('mantém os thresholds canônicos 45, 65 e 82 em uma única implementação', () => {
    expect(calculateReadiness({ checkin: { energy_score: 1, recovery_score: 1, pain_level: 8 } }).level).toBe('recuperacao');
    expect(calculateReadiness({ checkin: { sleep_hours: 5.5, energy_score: 3, recovery_score: 5, pain_level: 0 } }).level).toBe('baixa');
    expect(calculateReadiness({ checkin: CHECKIN }).level).toBe('moderada');
    expect(calculateReadiness({ checkin: { ...CHECKIN, sleep_hours: 7.5, energy_score: 8, recovery_score: 8 } }).level).toBe('boa');
  });
});
