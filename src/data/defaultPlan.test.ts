import { describe, expect, it } from 'vitest';
import { getExerciseMetadata } from '../domain/exerciseCatalog';
import { buildAdaptiveWorkoutRecommendation, estimateWorkoutSession, type AdaptedExercise } from '../domain/adaptiveWorkout';
import { CARDIO_RECOMMENDED_CAP_MINUTES, cardioPrescriptionFromDay } from '../domain/cardioRules';
import { SESSION_MAX_MINUTES } from '../domain/weeklyPlanRules';
import { buildTrainingPlanFromProfile, PROFILE_FALLBACKS } from './defaultPlan';

const TRAINING_WEEKDAYS = [2, 3, 5];

describe('plano-base de 3 treinos (Ter Inferior, Qua Superior, Sex Full body)', () => {
  it('perfil com 3 dias de força recebe Ter, Qua e Sex', () => {
    expect(strengthDays_(makePlan({ weekly_strength_days: 3 }))).toEqual(TRAINING_WEEKDAYS);
  });

  it('cardio da sexta é o primeiro a sair quando falta tempo; os principais ficam', () => {
    const friday = makePlan().days.find((day) => day.weekday === 5);
    const recommendation = buildAdaptiveWorkoutRecommendation({
      checkin: { log_date: '2026-11-13', morning_saved_at: '2026-11-13T07:00:00-03:00', sleep_hours: 7.5, energy_score: 8, recovery_score: 8, pain_level: 0, soreness_level: 1, available_minutes: 50 },
      baseExercises: friday?.exercises.map((exercise, index) => ({ id: `fri-${index}`, ...exercise })) ?? [],
      cardioPlanned: true,
      cardioPrescription: cardioPrescriptionFromDay(friday),
      now: new Date('2026-11-13T20:00:00-03:00'),
      timeZone: 'America/Sao_Paulo',
    });
    expect(recommendation.cardioGuidance.minutes).toBe(0);
    for (const item of recommendation.adaptedExercises.filter((entry) => entry.role === 'main')) {
      expect(item.targetSets, item.exercise.exercise_name).toBe(item.baseSets);
    }
  });

  it.each([4, 5])('perfil com %i dias continua recebendo o plano de 4 sessões', (strengthDays) => {
    expect(strengthDays_(makePlan({ weekly_strength_days: strengthDays }))).toEqual([1, 2, 4, 5]);
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

  it('prescreve cardio fixo por dia: terça leve 15–20, quarta moderado 20–25, sexta leve 15–20', () => {
    const plan = makePlan();
    expect(TRAINING_WEEKDAYS.map((weekday) => {
      const day = plan.days.find((item) => item.weekday === weekday);
      return [day?.cardio_required, day?.cardio_min_minutes, day?.cardio_max_minutes, day?.cardio_intensity];
    })).toEqual([
      [true, 15, 20, 'leve'],
      [true, 20, 25, 'moderado'],
      [true, 15, 20, 'leve'],
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

const FOUR_DAY_EXPECTED = {
  1: {
    title: 'Superior A',
    exercises: [
      ['Supino máquina ou halteres', '3', '8-12', 90, 'main'],
      ['Puxada na frente', '3', '10-12', 90, 'main'],
      ['Remada baixa', '3', '10-12', 90, 'main'],
      ['Desenvolvimento máquina/halteres', '2', '10-12', 75, 'secondary'],
      ['Tríceps corda', '2', '10-12', 60, 'accessory'],
    ],
  },
  2: {
    title: 'Inferior A',
    exercises: [
      ['Leg press 45°', '3', '10-12', 90, 'main'],
      ['Cadeira flexora', '3', '10-12', 75, 'main'],
      ['Cadeira extensora', '2', '12-15', 75, 'secondary'],
      ['Panturrilha', '3', '12-15', 60, 'accessory'],
      ['Prancha', '2', '20-45s', 60, 'accessory'],
    ],
  },
  4: {
    title: 'Superior B',
    exercises: [
      ['Supino inclinado máquina/halteres', '3', '10-12', 90, 'main'],
      ['Puxada triângulo', '3', '10-12', 90, 'main'],
      ['Remada baixa', '2', '10-12', 75, 'secondary'],
      ['Elevação lateral', '2', '12-15', 60, 'accessory'],
      ['Rosca direta ou alternada', '2', '10-12', 60, 'accessory'],
    ],
  },
  5: {
    title: 'Inferior B',
    exercises: [
      ['Agachamento goblet ou smith', '3', '8-10', 90, 'main'],
      ['Mesa flexora', '3', '10-12', 75, 'main'],
      ['Stiff com halteres', '2', '8-10', 90, 'secondary'],
      ['Cadeira abdutora', '2', '12-15', 60, 'accessory'],
      ['Panturrilha', '2', '12-15', 60, 'accessory'],
    ],
  },
};

describe('plano-base Upper/Lower de quatro dias (perfil com 4)', () => {
  it('planeja força na segunda, terça, quinta e sexta', () => {
    const plan = makeFourDayPlan(2);
    const strengthWeekdays = plan.days.filter((day) => day.day_kind.includes('strength')).map((day) => day.weekday);
    expect(strengthWeekdays).toEqual([1, 2, 4, 5]);
  });

  it('mantém quarta e fim de semana livres de sessão obrigatória', () => {
    const plan = makeFourDayPlan(4);
    for (const weekday of [0, 3, 6]) {
      const day = plan.days.find((item) => item.weekday === weekday);
      expect(day?.day_kind).toBe('rest');
      expect(day?.cardio_required).toBe(false);
    }
  });

  it.each(Object.entries(FOUR_DAY_EXPECTED))('valida integralmente o treino do weekday %s', (weekday, expected) => {
    const day = makeFourDayPlan(0).days.find((item) => item.weekday === Number(weekday));
    expect(day?.title).toBe(expected.title);
    expect(day?.exercises.map((exercise) => [
      exercise.exercise_name,
      exercise.sets,
      exercise.reps,
      exercise.rest_seconds,
      exercise.exercise_role,
    ])).toEqual(expected.exercises);
  });

  it('não mistura musculatura primária de superior e inferior nos dias consecutivos', () => {
    const plan = makeFourDayPlan(0);
    expect(primaryOverlap(plan, 1, 2)).toEqual([]);
    expect(primaryOverlap(plan, 4, 5)).toEqual([]);
  });

  it('distribui cardio configurável somente nos dias de academia', () => {
    expect(fourDayCardioDays(makeFourDayPlan(1))).toEqual([1]);
    expect(fourDayCardioDays(makeFourDayPlan(2))).toEqual([1, 5]);
    expect(fourDayCardioDays(makeFourDayPlan(3))).toEqual([1, 2, 5]);
    expect(fourDayCardioDays(makeFourDayPlan(4))).toEqual([1, 2, 4, 5]);
  });

  it('ganha identidade estável (split + ordem) sem depender do título', () => {
    const plan = makeFourDayPlan(2);
    expect([1, 2, 4, 5].map((weekday) => {
      const day = plan.days.find((item) => item.weekday === weekday);
      return [day?.session_split, day?.sequence_order];
    })).toEqual([['upper', 1], ['lower', 2], ['upper', 3], ['lower', 4]]);
  });

  it('não usa mais o exercício ambíguo Abdutor/adutor (4 dias)', () => {
    const names = makeFourDayPlan(4).days.flatMap((day) => day.exercises.map((exercise) => exercise.exercise_name));
    expect(names).not.toContain('Abdutor/adutor');
    expect(names).toContain('Cadeira abdutora');
  });
});

function makeFourDayPlan(cardioDays: number) {
  return buildTrainingPlanFromProfile({ ...PROFILE_FALLBACKS, weekly_strength_days: 4, weekly_cardio_days: cardioDays, plays_football: true });
}

function fourDayCardioDays(plan: ReturnType<typeof makeFourDayPlan>) {
  return plan.days.filter((day) => day.cardio_required).map((day) => day.weekday);
}

function primaryOverlap(plan: ReturnType<typeof makeFourDayPlan>, firstWeekday: number, secondWeekday: number) {
  const muscles = (weekday: number) => new Set(plan.days
    .find((day) => day.weekday === weekday)
    ?.exercises.filter((exercise) => exercise.exercise_role)
    .flatMap((exercise) => getExerciseMetadata(exercise.exercise_name).primaryMuscles) ?? []);
  const first = muscles(firstWeekday);
  return [...muscles(secondWeekday)].filter((muscle) => first.has(muscle));
}
