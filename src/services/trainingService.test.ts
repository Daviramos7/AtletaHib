import { beforeEach, describe, expect, it, vi } from 'vitest';

// Cliente Supabase falso que registra cada operação em ordem.
const mock = vi.hoisted(() => ({
  log: [] as string[],
  failOnDayInsert: false,
  insertedDays: [] as any[],
}));

vi.mock('../lib/supabaseClient', () => ({
  requireSupabase: () => ({
    from(table: string) {
      const state: any = { table, op: 'select', payload: null, filters: [] as string[] };
      const query: any = {
        insert(payload: any) { state.op = 'insert'; state.payload = payload; return query; },
        update(payload: any) { state.op = 'update'; state.payload = payload; return query; },
        select() { return query; },
        eq(column: string, value: unknown) { state.filters.push(`${column}=${value}`); return query; },
        neq(column: string, value: unknown) { state.filters.push(`${column}!=${value}`); return query; },
        order() { return query; },
        limit() { return query; },
        async single() { return run(); },
        async maybeSingle() { return run(); },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) { return Promise.resolve(run()).then(resolve, reject); },
      };
      function run() {
        if (state.op === 'select' && table === 'training_plans') return { data: null, error: null };
        mock.log.push(`${table}:${state.op}:${JSON.stringify(state.op === 'update' ? state.payload : { is_active: state.payload?.is_active })}:${state.filters.join('&')}`);
        if (table === 'training_days' && state.op === 'insert') {
          if (mock.failOnDayInsert) return { data: null, error: { message: 'column "session_split" does not exist' } };
          mock.insertedDays.push(state.payload);
          return { data: { id: `day-${mock.insertedDays.length}`, ...state.payload }, error: null };
        }
        if (table === 'training_plans' && state.op === 'insert') return { data: { id: 'new-plan', ...state.payload }, error: null };
        return { data: null, error: null };
      }
      return query;
    },
  }),
}));

import { createTrainingPlanFromProfile } from './trainingService';
import { PROFILE_FALLBACKS } from '../data/defaultPlan';

describe('regenerar plano sem perder o atual', () => {
  beforeEach(() => {
    mock.log = [];
    mock.failOnDayInsert = false;
    mock.insertedDays = [];
  });

  it('cria inativo, grava tudo, ativa o novo e só então arquiva o anterior', async () => {
    await createTrainingPlanFromProfile('user-1', { ...PROFILE_FALLBACKS, weekly_strength_days: 3 }, { deactivatePrevious: true });
    const planOps = mock.log.filter((line) => line.startsWith('training_plans'));
    expect(planOps).toEqual([
      'training_plans:insert:{"is_active":false}:',
      'training_plans:update:{"is_active":true}:id=new-plan&user_id=user-1',
      'training_plans:update:{"is_active":false}:user_id=user-1&is_active=true&id!=new-plan',
    ]);
    const lastDayInsert = mock.log.map((line, index) => (line.startsWith('training_days') || line.startsWith('exercise_entries') ? index : -1)).filter((index) => index >= 0).pop();
    expect(lastDayInsert).toBeLessThan(mock.log.indexOf(planOps[1]));
  });

  it('se gravar um dia falhar (ex.: migration ausente), o plano atual não é tocado', async () => {
    mock.failOnDayInsert = true;
    await expect(createTrainingPlanFromProfile('user-1', PROFILE_FALLBACKS, { deactivatePrevious: true })).rejects.toBeTruthy();
    expect(mock.log.filter((line) => line.startsWith('training_plans:update'))).toEqual([]);
  });

  it('grava a identidade estável e a prescrição de cardio de cada dia', async () => {
    await createTrainingPlanFromProfile('user-1', { ...PROFILE_FALLBACKS, weekly_strength_days: 3 });
    const training = mock.insertedDays.filter((day) => day.day_kind === 'strength_cardio');
    expect(training.map((day) => [day.weekday, day.session_split, day.sequence_order, day.cardio_min_minutes, day.cardio_max_minutes, day.cardio_intensity])).toEqual([
      [2, 'lower', 1, 15, 20, 'leve'],
      [3, 'upper', 2, 20, 25, 'moderado'],
      [5, 'full_body', 3, 10, 15, 'leve'],
    ]);
    expect(training.every((day) => day.user_id === 'user-1' && day.plan_id === 'new-plan')).toBe(true);
  });
});
