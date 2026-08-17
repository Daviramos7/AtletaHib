import { describe, expect, it } from 'vitest';
import { buildTrend, buildWeeklyBuckets, groupSetsBySession } from './StrengthHistoryView';

describe('histórico de força consciente de adaptações', () => {
  it('não chama semana reduzida por baixa prontidão de queda de 33%', () => {
    const weekly = buildWeeklyBuckets([
      ...sessionSets('normal-15', '2026-08-03T08:00:00Z', 15, 'base', true),
      ...sessionSets('adapted-10', '2026-08-10T08:00:00Z', 10, 'adapted', false),
    ]);
    const trend = buildTrend(weekly);
    expect(trend.label).toBe('Semana adaptada — volume realizado reduzido conforme prontidão.');
    expect(trend.label).not.toMatch(/caiu|33%/i);
  });

  it('continua indicando queda real entre semanas normais comparáveis', () => {
    const weekly = buildWeeklyBuckets([
      ...sessionSets('normal-15', '2026-08-03T08:00:00Z', 15, 'base', true),
      ...sessionSets('normal-10', '2026-08-10T08:00:00Z', 10, 'base', true),
    ]);
    expect(buildTrend(weekly).label).toBe('Performance comparável caiu 33% vs última semana normal.');
  });

  it('mantém o volume real da sessão adaptada nos totais semanais', () => {
    const weekly = buildWeeklyBuckets(sessionSets('adapted-10', '2026-08-10T08:00:00Z', 10, 'adapted', false));
    expect(weekly[0].volume).toBe(1000);
    expect(weekly[0].sets).toBe(10);
    expect(weekly[0].restrictedSessionCount).toBe(1);
  });

  it('mantém carga e reps visíveis na sessão adaptada', () => {
    const source = sessionSets('adapted-10', '2026-08-10T08:00:00Z', 10, 'adapted', false);
    const sessions = groupSetsBySession(source);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sets[0]).toMatchObject({ load_kg: 10, reps: 10 });
  });

  it('não usa progression_allowed=false como referência para a próxima semana normal', () => {
    const weekly = buildWeeklyBuckets([
      ...sessionSets('normal-15', '2026-08-03T08:00:00Z', 15, 'base', true),
      ...sessionSets('adapted-10', '2026-08-10T08:00:00Z', 10, 'adapted', false),
      ...sessionSets('normal-12', '2026-08-17T08:00:00Z', 12, 'base', true),
    ]);
    const trend = buildTrend(weekly);
    expect(trend.label).toBe('Performance comparável caiu 20% vs última semana normal.');
    expect(trend.comparisonWeekKey).toBe('2026-08-03');
  });

  it('mantém adapted com progression_allowed=true como comparável', () => {
    const weekly = buildWeeklyBuckets([
      ...sessionSets('normal-15', '2026-08-03T08:00:00Z', 15, 'base', true),
      ...sessionSets('cardio-only-10', '2026-08-10T08:00:00Z', 10, 'adapted', true),
    ]);
    expect(buildTrend(weekly).label).toBe('Performance comparável caiu 33% vs última semana normal.');
  });
});

function sessionSets(sessionId: string, performedAt: string, count: number, variant: 'base' | 'adapted', progressionAllowed: boolean) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${sessionId}-${index + 1}`,
    workout_session_id: sessionId,
    exercise_name: 'Supino máquina',
    set_number: index + 1,
    performed_at: new Date(new Date(performedAt).getTime() + index * 1000).toISOString(),
    load_kg: 10,
    reps: 10,
    workout_variant: variant,
    adaptation_summary: { progression_allowed: progressionAllowed },
  }));
}
