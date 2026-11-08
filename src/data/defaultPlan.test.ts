import { describe, expect, it } from 'vitest';
import { getExerciseMetadata } from '../domain/exerciseCatalog';
import { estimateWorkoutSession, type AdaptedExercise } from '../domain/adaptiveWorkout';
import { CARDIO_RECOMMENDED_CAP_MINUTES } from '../domain/cardioRules';
import { SESSION_MAX_MINUTES } from '../domain/weeklyPlanRules';
import { buildTrainingPlanFromProfile, PROFILE_FALLBACKS } from './defaultPlan';

const TRAINING_WEEKDAYS = [2, 3, 5];

describe('plano-base de 3 treinos (Ter Inferior, Qua Superior, Sex Full body)', () => {
  it.each([3, 4, 5])('gera os mesmos 3 treinos para perfil com %i dias de força', (strengthDays) => {
    const plan = makePlan({ weekly_strength_days: strengthDays });
    expect(strengthDays_(plan)).toEqual(TRAINING_WEEKDAYS);
  });

  it.each([0, 1, 2, 3, 4])('não cria dia de cardio separado com %i dias de cardio no perfil', (cardioDays) => {
    const plan = makePlan({ weekly_cardio_days: cardioDays });
    expect(plan.days.filter((day) => day.day_kind === 'cardio')).toEqual([]);
    expect(strengthDays_(plan)).toEqual(TRAINING_WEEKDAYS);
  });

  it('deixa segunda, quinta, sábado e domingo sem treino, mesmo para quem joga futebol', () => {
    const plan = makePlan({ plays_football: true });
    for (const weekday of [0, 1, 4, 6]) {
      const day = plan.days.find((item) => item.weekday === weekday);
      expect(day?.day_kind).toBe('rest');
      expect(day?.cardio_required).toBe(false);
    }
  });

  it('dá identidade estável a cada sessão (split + ordem), sem depender do título', () => {
    const plan = makePlan();
    expect(TRAINING_WEEKDAYS.map((weekday) => {
      const day = plan.days.find((item) => item.weekday === weekday);
      return [day?.title, day?.session_split, day?.sequence_order];
    })).toEqual([
      ['Inferior', 'lower', 1],
      ['Superior', 'upper', 2],
      ['Full body', 'full_body', 3],
    ]);
  });

  it('prescreve cardio fixo por dia: terça leve 15–20, quarta moderado 20–25, sexta leve 10–15', () => {
    const plan = makePlan();
    expect(TRAINING_WEEKDAYS.map((weekday) => {
      const day = plan.days.find((item) => item.weekday === weekday);
      return [day?.cardio_required, day?.cardio_min_minutes, day?.cardio_max_minutes, day?.cardio_intensity];
    })).toEqual([
      [true, 15, 20, 'leve'],
      [true, 20, 25, 'moderado'],
      [true, 10, 15, 'leve'],
    ]);
  });

  it('nenhuma prescrição de cardio passa do teto central', () => {
    for (const day of trainingDays(makePlan())) {
      expect(day.cardio_max_minutes).toBeLessThanOrEqual(CARDIO_RECOMMENDED_CAP_MINUTES);
    }
  });

  it('cardio é etapa da sessão, não exercício: evita dupla contagem', () => {
    for (const day of trainingDays(makePlan())) {
      expect(day.exercises.filter((exercise) => getExerciseMetadata(exercise.exercise_name).category === 'cardio')).toEqual([]);
    }
  });

  it('todo exercício existe no catálogo e é principal ou acessório', () => {
    for (const day of trainingDays(makePlan())) {
      for (const exercise of day.exercises) {
        expect(getExerciseMetadata(exercise.exercise_name).primaryMuscles.length, exercise.exercise_name).toBeGreaterThan(0);
        expect(['main', 'accessory']).toContain(exercise.exercise_role);
      }
      expect(day.exercises.some((exercise) => exercise.exercise_role === 'main')).toBe(true);
      expect(day.exercises.some((exercise) => exercise.exercise_role === 'accessory')).toBe(true);
    }
  });

  it('terça é só inferior e quarta é só superior', () => {
    const plan = makePlan();
    const upper = new Set(['peito', 'dorsais', 'costas_superiores', 'ombros', 'biceps', 'triceps']);
    const muscles = (weekday: number) => (plan.days.find((day) => day.weekday === weekday)?.exercises ?? [])
      .flatMap((exercise) => getExerciseMetadata(exercise.exercise_name).primaryMuscles)
      .filter((muscle) => muscle !== 'core');
    expect(muscles(2).some((muscle) => upper.has(muscle))).toBe(false);
    expect(muscles(3).every((muscle) => upper.has(muscle))).toBe(true);
  });

  it.each(TRAINING_WEEKDAYS)('sessão do weekday %i: ~60 min de força e até 90 min com o cardio máximo', (weekday) => {
    const day = makePlan().days.find((item) => item.weekday === weekday);
    expect(day?.target_minutes).toBe(SESSION_MAX_MINUTES);
    const estimate = estimateWorkoutSession(toAdapted(day?.exercises ?? []), day?.cardio_max_minutes ?? 0);
    expect(estimate.strength).toBeGreaterThanOrEqual(45);
    expect(estimate.strength).toBeLessThanOrEqual(70);
    expect(estimate.total).toBeLessThanOrEqual(SESSION_MAX_MINUTES);
  });

  it('não usa mais o exercício ambíguo Abdutor/adutor', () => {
    const names = makePlan().days.flatMap((day) => day.exercises.map((exercise) => exercise.exercise_name));
    expect(names).not.toContain('Abdutor/adutor');
    expect(names).toContain('Cadeira abdutora');
  });
});

describe('perfil com 2 dias de força continua com o plano curto', () => {
  it('mantém os dois full body de segunda e quinta', () => {
    expect(strengthDays_(makePlan({ weekly_strength_days: 2 }))).toEqual([1, 4]);
  });
});

function makePlan(overrides: Record<string, unknown> = {}) {
  return buildTrainingPlanFromProfile({ ...PROFILE_FALLBACKS, weekly_strength_days: 3, weekly_cardio_days: 2, plays_football: false, ...overrides });
}

function trainingDays(plan: ReturnType<typeof makePlan>) {
  return plan.days.filter((day) => TRAINING_WEEKDAYS.includes(day.weekday));
}

function strengthDays_(plan: ReturnType<typeof makePlan>) {
  return plan.days.filter((day) => String(day.day_kind).includes('strength')).map((day) => day.weekday);
}

function toAdapted(exercises: Array<Record<string, any>>): AdaptedExercise[] {
  return exercises.map((exercise) => {
    const sets = Number.parseInt(String(exercise.sets), 10);
    return { exercise: exercise as AdaptedExercise['exercise'], role: exercise.exercise_role, baseSets: sets, targetSets: sets, action: 'keep', reason: null };
  });
}
