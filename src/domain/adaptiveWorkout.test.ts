import { describe, expect, it } from 'vitest';
import {
  buildAdaptiveWorkoutRecommendation,
  calculateRecentMuscleLoad,
  dateKeyInTimeZone,
  estimateWorkoutSession,
  isValidMorningCheckin,
  selectWorkoutVariant,
  type AdaptiveCheckin,
  type AdaptiveWorkoutInput,
  type CompletedStrengthSet,
} from './adaptiveWorkout';

const NOW = new Date('2026-08-17T08:00:00-03:00');
const TODAY = '2026-08-17';
const BASE = [
  { id: 'leg', position: 1, exercise_name: 'Leg press 45°', sets: '3', reps: '10-12', rest_seconds: 90 },
  { id: 'chest', position: 2, exercise_name: 'Supino máquina', sets: '3', reps: '10', rest_seconds: 90 },
  { id: 'row', position: 3, exercise_name: 'Remada baixa', sets: '3', reps: '10', rest_seconds: 90 },
  { id: 'curl', position: 4, exercise_name: 'Rosca direta', sets: '3', reps: '10', rest_seconds: 60 },
  { id: 'core', position: 5, exercise_name: 'Prancha', sets: '3', reps: '30s', rest_seconds: 60 },
];

function morning(overrides: Partial<AdaptiveCheckin> = {}): AdaptiveCheckin {
  return {
    log_date: TODAY,
    morning_saved_at: '2026-08-17T04:42:00-03:00',
    sleep_hours: 7.5,
    energy_score: 8,
    recovery_score: 8,
    hunger_score: 5,
    stress_score: 4,
    pain_level: 0,
    soreness_level: 2,
    available_minutes: 45,
    ...overrides,
  };
}

function recommend(overrides: Partial<AdaptiveWorkoutInput> = {}) {
  return buildAdaptiveWorkoutRecommendation({
    checkin: morning(),
    sleepSessions: [],
    completedSets: [],
    baseExercises: BASE,
    cardioPlanned: true,
    now: NOW,
    timeZone: 'America/Sao_Paulo',
    ...overrides,
  });
}

function sets(count: number, performedAt = '2026-08-16T07:00:00-03:00', rpe = 8): CompletedStrengthSet[] {
  return Array.from({ length: count }, (_, index) => ({
    exercise_name: 'Leg press 45°',
    reps: 10,
    load_kg: 100,
    perceived_effort: rpe,
    performed_at: new Date(new Date(performedAt).getTime() + index * 60_000).toISOString(),
  }));
}

describe('motor de treino adaptativo', () => {
  it('1. exige check-in da manhã para gerar recomendação', () => {
    const result = recommend({ checkin: null });
    expect(result.checkinValid).toBe(false);
    expect(result.readinessScore).toBeNull();
    expect(result.readinessLevel).toBe('aguardando_checkin');
  });

  it('2. mantém treino completo com sono e recuperação bons', () => {
    const result = recommend();
    expect(result.readinessLevel).toBe('boa');
    expect(result.adaptedExercises.every((item) => item.targetSets === item.baseSets)).toBe(true);
  });

  it('3. não cancela treino por sono curto isolado', () => {
    const result = recommend({ checkin: morning({ sleep_hours: 5.7, energy_score: 8, recovery_score: 8 }) });
    expect(result.readinessLevel).not.toBe('recuperacao');
    expect(result.readinessScore).toBeGreaterThanOrEqual(65);
  });

  it('4. reduz prontidão quando sono curto combina com energia e recuperação baixas', () => {
    const result = recommend({ checkin: morning({ sleep_hours: 5.2, energy_score: 3, recovery_score: 3 }) });
    expect(['baixa', 'recuperacao']).toContain(result.readinessLevel);
    expect(result.recommendedVariant).toBe('adapted');
  });

  it('5. trata dor articular alta e localizada de forma conservadora', () => {
    const result = recommend({ checkin: morning({ pain_level: 8, joint_pain_locations: ['joelho'] }) });
    expect(result.readinessLevel).toBe('recuperacao');
    expect(result.adaptedExercises.find((item) => item.exercise.id === 'leg')?.targetSets).toBe(0);
    expect(result.warnings.join(' ')).toContain('joelho');
  });

  it('6. não penaliza métrica opcional ausente', () => {
    const result = recommend({ checkin: morning({ sleep_hours: null, recovery_score: null, hunger_score: null }) });
    expect(result.readinessLevel).toBe('boa');
    expect(result.sleep.hours).toBeNull();
  });

  it('7. considera treino pesado realmente executado no dia anterior', () => {
    const result = recommend({ completedSets: sets(5, '2026-08-16T07:00:00-03:00', 9) });
    expect(result.reasons.some((reason) => reason.includes('Carga recente alta'))).toBe(true);
    expect(result.adaptedExercises.find((item) => item.exercise.id === 'leg')?.targetSets).toBeLessThan(3);
  });

  it('8. um treino parcial pesa menos que o treino completo planejado', () => {
    const partial = recommend({ completedSets: sets(2) });
    const heavy = recommend({ completedSets: sets(6, '2026-08-16T07:00:00-03:00', 9) });
    expect(partial.readinessScore).toBeGreaterThan(heavy.readinessScore ?? 0);
    expect(partial.adaptedExercises.find((item) => item.exercise.id === 'leg')?.targetSets).toBe(3);
  });

  it('9. não inventa carga recente quando não há treino', () => {
    const result = recommend({ completedSets: [] });
    expect(Object.keys(result.recentMuscleLoad)).toHaveLength(0);
    expect(result.reasons.some((reason) => reason.includes('Carga recente'))).toBe(false);
  });

  it('10. ativa modo de retorno após pausa relevante', () => {
    const result = recommend({ completedSets: sets(1, '2026-08-08T07:00:00-03:00') });
    expect(result.workoutMode).toBe('retorno');
    expect(result.recommendedVariant).toBe('adapted');
    expect(result.intensityGuidance).toContain('RPE 6–7');
  });

  it('11. suporta sessões consecutivas usando sobreposição muscular real', () => {
    const result = recommend({ completedSets: sets(4, '2026-08-16T08:00:00-03:00', 9) });
    expect(result.recentMuscleLoad.quadriceps?.last48h).toBeGreaterThanOrEqual(5);
    expect(result.adaptedExercises.find((item) => item.exercise.id === 'leg')?.action).toBe('reduce');
    expect(result.adaptedExercises.find((item) => item.exercise.id === 'chest')?.targetSets).toBe(3);
  });

  it('12. respeita o limite total de tempo informado e o teto de 50 min', () => {
    const short = recommend({ checkin: morning({ available_minutes: 30 }) });
    const long = recommend({ checkin: morning({ available_minutes: 90 }) });
    expect(short.estimatedMinutes.total).toBeLessThanOrEqual(30);
    expect(long.estimatedMinutes.total).toBeLessThanOrEqual(50);
  });

  it('13. nunca recomenda cardio acima de 20 minutos', () => {
    const result = recommend({ checkin: morning({ available_minutes: 120 }) });
    expect(result.cardioGuidance.minutes).toBeLessThanOrEqual(20);
  });

  it('14. dado ausente permanece ausente e não vira zero', () => {
    const result = recommend({ checkin: morning({ sleep_hours: undefined }), sleepSessions: [] });
    expect(result.sleep.hours).toBeNull();
    expect(result.sleep.source).toBe('missing');
  });

  it('15. resolve corretamente instantes próximos da meia-noite', () => {
    expect(dateKeyInTimeZone('2026-08-17T02:30:00Z', 'America/Sao_Paulo')).toBe('2026-08-16');
    expect(dateKeyInTimeZone('2026-08-17T03:30:00Z', 'America/Sao_Paulo')).toBe('2026-08-17');
  });

  it('16. valida o check-in pela data local do usuário', () => {
    const localToday = dateKeyInTimeZone(NOW, 'America/Sao_Paulo');
    expect(isValidMorningCheckin(morning(), localToday)).toBe(true);
    expect(isValidMorningCheckin({ ...morning(), log_date: '2026-08-16' }, localToday)).toBe(false);
  });

  it('17. mantém compatibilidade com check-in antigo sem novos campos', () => {
    const legacy = { log_date: TODAY, energy_score: 7, pain_level: 0, created_at: '2026-08-17T07:00:00Z' };
    const result = recommend({ checkin: legacy });
    expect(result.checkinValid).toBe(true);
    expect(result.readinessScore).not.toBeNull();
  });

  it('18. preserva o treino-base quando o usuário ignora a adaptação', () => {
    const original = JSON.stringify(BASE);
    const result = recommend({ checkin: morning({ energy_score: 2, recovery_score: 2 }) });
    const selected = selectWorkoutVariant(BASE, result, 'base');
    expect(JSON.stringify(BASE)).toBe(original);
    expect(selected.map((item) => item.targetSets)).toEqual([3, 3, 3, 3, 3]);
  });

  it('prioriza sono corrigido do dia de despertar sem somar fontes', () => {
    const result = recommend({
      checkin: morning({ sleep_hours: 8 }),
      sleepSessions: [
        { sleep_date: TODAY, duration_minutes: 420, sleep_score: 80 },
        { sleep_date: TODAY, duration_minutes: 365, sleep_score: 72, replaces_health_connect_sleep: true },
      ],
    });
    expect(result.sleep.hours).toBeCloseTo(365 / 60);
    expect(result.sleep.source).toBe('corrected_session');
  });

  it('calcula volume muscular apenas a partir de séries com reps reais', () => {
    const load = calculateRecentMuscleLoad([
      ...sets(2),
      { exercise_name: 'Leg press 45°', reps: 0, load_kg: 200, perceived_effort: 10, performed_at: NOW.toISOString() },
    ], NOW);
    expect(load.quadriceps?.last48h).toBe(2.5);
  });

  it('reduz músculo dolorido sem interpretar notas abertas', () => {
    const result = recommend({ checkin: morning({ soreness_level: 8, muscle_soreness_locations: ['quadriceps'] }) });
    expect(result.adaptedExercises.find((item) => item.exercise.id === 'leg')?.targetSets).toBeLessThanOrEqual(1);
    expect(result.adaptedExercises.find((item) => item.exercise.id === 'chest')?.targetSets).toBeGreaterThan(0);
  });

  it('usa role explícito em vez da posição para Stiff e Supino Inclinado', () => {
    const result = recommend({
      checkin: morning({ sleep_hours: 6.2, energy_score: 5, recovery_score: 5 }),
      cardioPlanned: false,
      baseExercises: [
        { id: 'lateral', position: 1, exercise_name: 'Elevação lateral', sets: '2', reps: '12', rest_seconds: 60, exercise_role: 'accessory' },
        { id: 'stiff', position: 4, exercise_name: 'Stiff com halteres', sets: '2', reps: '10', rest_seconds: 90, exercise_role: 'secondary' },
        { id: 'incline', position: 5, exercise_name: 'Supino inclinado máquina', sets: '3', reps: '10', rest_seconds: 90, exercise_role: 'main' },
      ],
    });
    expect(result.readinessLevel).toBe('moderada');
    expect(result.adaptedExercises.find((item) => item.exercise.id === 'lateral')?.targetSets).toBe(1);
    expect(result.adaptedExercises.find((item) => item.exercise.id === 'stiff')?.targetSets).toBe(2);
    expect(result.adaptedExercises.find((item) => item.exercise.id === 'incline')?.targetSets).toBe(3);
  });

  it('inclui descanso real na estimativa de duração', () => {
    const shortRest = estimateWorkoutSession([{ exercise: { exercise_name: 'Supino máquina', rest_seconds: 30 }, role: 'main', baseSets: 3, targetSets: 3, action: 'keep', reason: null }], 0);
    const longRest = estimateWorkoutSession([{ exercise: { exercise_name: 'Supino máquina', rest_seconds: 120 }, role: 'main', baseSets: 3, targetSets: 3, action: 'keep', reason: null }], 0);
    expect(longRest.strength).toBeGreaterThan(shortRest.strength);
  });

  it.each([30, 40, 45, 50, 90])('garante sessão dentro do limite efetivo para available=%i', (available) => {
    const result = recommend({ checkin: morning({ available_minutes: available }) });
    expect(result.estimatedMinutes.total).toBeLessThanOrEqual(Math.min(available, 50));
    expect(result.timeConstraintSatisfied).toBe(true);
    expect(result.adaptedExercises.filter((item) => item.targetSets > 0).every((item) => item.targetSets >= 1)).toBe(true);
  });

  it('reduz cardio antes de retirar séries principais', () => {
    const upper = [
      { id: 'supino', exercise_name: 'Supino máquina', sets: '3', reps: '10', rest_seconds: 90, exercise_role: 'main' },
      { id: 'puxada', exercise_name: 'Puxada na frente', sets: '3', reps: '10', rest_seconds: 90, exercise_role: 'main' },
      { id: 'remada', exercise_name: 'Remada baixa', sets: '3', reps: '10', rest_seconds: 90, exercise_role: 'main' },
      { id: 'desenvolvimento', exercise_name: 'Desenvolvimento máquina', sets: '2', reps: '10', rest_seconds: 75, exercise_role: 'secondary' },
      { id: 'triceps', exercise_name: 'Tríceps corda', sets: '2', reps: '10', rest_seconds: 60, exercise_role: 'accessory' },
    ];
    const result = recommend({ checkin: morning({ available_minutes: 30 }), baseExercises: upper, cardioPlanned: true });
    expect(result.cardioGuidance.minutes).toBe(0);
    expect(result.adaptedExercises.filter((item) => item.role === 'main').every((item) => item.targetSets === item.baseSets)).toBe(true);
    expect(result.estimatedMinutes.total).toBeLessThanOrEqual(30);
  });

  it('faz reps influenciarem exposição sem usar tonelagem universal', () => {
    const lowReps = calculateRecentMuscleLoad([{ exercise_name: 'Leg press 45°', reps: 5, load_kg: 100, perceived_effort: 8, performed_at: NOW.toISOString() }], NOW);
    const highReps = calculateRecentMuscleLoad([{ exercise_name: 'Leg press 45°', reps: 15, load_kg: 20, perceived_effort: 8, performed_at: NOW.toISOString() }], NOW);
    expect(highReps.quadriceps?.last48h).toBeGreaterThan(lowReps.quadriceps?.last48h ?? 0);
  });

  it('reconhece simultaneamente carga independente em 48h e 7 dias', () => {
    const recentLeg = sets(5, '2026-08-16T07:00:00-03:00', 9);
    const weeklyChest = Array.from({ length: 10 }, (_, index) => ({
      exercise_name: 'Supino máquina', reps: 10, load_kg: 40, perceived_effort: 9,
      performed_at: new Date(new Date('2026-08-12T07:00:00-03:00').getTime() + index * 60_000).toISOString(),
    }));
    const result = recommend({ completedSets: [...recentLeg, ...weeklyChest] });
    expect(result.reasons.some((reason) => reason.includes('Carga recente alta') && reason.includes('quadríceps'))).toBe(true);
    expect(result.reasons.some((reason) => reason.includes('Volume semanal alto') && reason.includes('peito'))).toBe(true);
  });

  it('dor sem localização ou em outro atua globalmente sem inventar alvo', () => {
    const noLocation = recommend({ checkin: morning({ pain_level: 8, joint_pain_locations: [] }) });
    const other = recommend({ checkin: morning({ pain_level: 8, joint_pain_locations: ['outro'] }) });
    expect(noLocation.adaptedExercises.find((item) => item.exercise.id === 'leg')?.targetSets).toBe(1);
    expect(other.adaptedExercises.find((item) => item.exercise.id === 'leg')?.targetSets).toBe(1);
    expect(noLocation.warnings.join(' ')).not.toContain('joelho');
  });

  it('aceita múltiplas localizações e remove somente movimentos incompatíveis', () => {
    const result = recommend({
      checkin: morning({ pain_level: 8, joint_pain_locations: ['joelho', 'ombro'] }),
      baseExercises: [
        BASE[0], BASE[1],
        { id: 'stiff', exercise_name: 'Stiff com halteres', sets: '3', reps: '10', rest_seconds: 90, exercise_role: 'main' },
      ],
    });
    expect(result.adaptedExercises.find((item) => item.exercise.id === 'leg')?.targetSets).toBe(0);
    expect(result.adaptedExercises.find((item) => item.exercise.id === 'chest')?.targetSets).toBe(0);
    expect(result.adaptedExercises.find((item) => item.exercise.id === 'stiff')?.targetSets).toBe(1);
  });
});
