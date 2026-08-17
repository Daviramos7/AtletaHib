import { describe, expect, it } from 'vitest';
import { getExerciseMetadata } from '../domain/exerciseCatalog';
import { buildTrainingPlanFromProfile, PROFILE_FALLBACKS } from './defaultPlan';

const EXPECTED = {
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

describe('plano-base Upper/Lower de quatro dias', () => {
  it('planeja força na segunda, terça, quinta e sexta', () => {
    const plan = makePlan(2);
    const strengthWeekdays = plan.days.filter((day) => day.day_kind.includes('strength')).map((day) => day.weekday);
    expect(strengthWeekdays).toEqual([1, 2, 4, 5]);
  });

  it('mantém quarta e fim de semana livres de sessão obrigatória', () => {
    const plan = makePlan(4);
    for (const weekday of [0, 3, 6]) {
      const day = plan.days.find((item) => item.weekday === weekday);
      expect(day?.day_kind).toBe('rest');
      expect(day?.cardio_required).toBe(false);
    }
  });

  it.each(Object.entries(EXPECTED))('valida integralmente o treino do weekday %s', (weekday, expected) => {
    const day = makePlan(0).days.find((item) => item.weekday === Number(weekday));
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
    const plan = makePlan(0);
    expect(primaryOverlap(plan, 1, 2)).toEqual([]);
    expect(primaryOverlap(plan, 4, 5)).toEqual([]);
  });

  it('distribui cardio configurável somente nos dias de academia', () => {
    expect(cardioDays(makePlan(1))).toEqual([1]);
    expect(cardioDays(makePlan(2))).toEqual([1, 5]);
    expect(cardioDays(makePlan(3))).toEqual([1, 2, 5]);
    expect(cardioDays(makePlan(4))).toEqual([1, 2, 4, 5]);
  });

  it('não usa mais o exercício ambíguo Abdutor/adutor', () => {
    const names = makePlan(4).days.flatMap((day) => day.exercises.map((exercise) => exercise.exercise_name));
    expect(names).not.toContain('Abdutor/adutor');
    expect(names).toContain('Cadeira abdutora');
  });
});

function makePlan(cardioDays: number) {
  return buildTrainingPlanFromProfile({ ...PROFILE_FALLBACKS, weekly_strength_days: 4, weekly_cardio_days: cardioDays, plays_football: true });
}

function cardioDays(plan) {
  return plan.days.filter((day) => day.cardio_required).map((day) => day.weekday);
}

function primaryOverlap(plan, firstWeekday, secondWeekday) {
  const muscles = (weekday) => new Set(plan.days
    .find((day) => day.weekday === weekday)
    ?.exercises.filter((exercise) => exercise.exercise_role)
    .flatMap((exercise) => getExerciseMetadata(exercise.exercise_name).primaryMuscles) ?? []);
  const first = muscles(firstWeekday);
  return [...muscles(secondWeekday)].filter((muscle) => first.has(muscle));
}
