import { describe, expect, it } from 'vitest';
import {
  buildCardioPlanSnapshot,
  buildStrengthPlanSnapshot,
  canFinalizeGymSessionState,
  cardioStatusAfterDeletingLinkedExecution,
  deriveGymSessionLifecycle,
  gymSessionTiming,
  isGymSessionLifecycleStateValid,
  normalizeCardioPlanSnapshot,
  normalizeLegacyCompletedLifecycle,
  nullableNumber,
  plannedVsRealized,
  rankGymImportCandidates,
  withOptionalWorkoutLink,
} from './gymSession';

describe('ciclo único da sessão de Academia', () => {
  it('mantém sessão ativa enquanto a força não acabou', () => {
    expect(deriveGymSessionLifecycle({ strengthStatus: 'active', cardioStatus: 'pending' })).toMatchObject({ sessionStatus: 'active', canFinish: false, nextAction: 'strength' });
  });

  it('exige resolver cardio pendente depois da força', () => {
    expect(deriveGymSessionLifecycle({ strengthStatus: 'completed', cardioStatus: 'pending' })).toMatchObject({ canFinish: false, nextAction: 'cardio' });
  });

  it('permite finalizar enquanto aguarda importação', () => {
    expect(deriveGymSessionLifecycle({ strengthStatus: 'completed', cardioStatus: 'awaiting_import' }).canFinish).toBe(true);
  });

  it('permite finalizar depois de cardio real', () => {
    expect(deriveGymSessionLifecycle({ strengthStatus: 'completed', cardioStatus: 'completed' }).canFinish).toBe(true);
  });

  it('permite finalizar quando cardio foi pulado', () => {
    expect(deriveGymSessionLifecycle({ strengthStatus: 'completed', cardioStatus: 'skipped' }).canFinish).toBe(true);
  });

  it('permite finalizar sem cardio planejado', () => {
    expect(deriveGymSessionLifecycle({ strengthStatus: 'completed', cardioStatus: 'not_planned' }).canFinish).toBe(true);
  });

  it('não oferece nova finalização para sessão já concluída', () => {
    expect(deriveGymSessionLifecycle({ strengthStatus: 'completed', cardioStatus: 'completed', completed: true })).toMatchObject({ sessionStatus: 'completed', canFinish: false, nextAction: 'done' });
  });

  it('trata status desconhecido de cardio como pendência segura', () => {
    expect(deriveGymSessionLifecycle({ strengthStatus: 'completed', cardioStatus: 'unexpected' })).toMatchObject({ canFinish: false, nextAction: 'cardio' });
  });

  it('rejeita completed=true com session_status active', () => {
    expect(isGymSessionLifecycleStateValid(state(true, 'active', 'active', 'not_planned'))).toBe(false);
  });

  it('rejeita sessão finalizada com cardio pendente', () => {
    expect(isGymSessionLifecycleStateValid(state(true, 'completed', 'completed', 'pending'))).toBe(false);
    expect(canFinalizeGymSessionState(state(false, 'strength_completed', 'completed', 'pending'))).toBe(false);
  });

  it('rejeita strength_completed com força ainda ativa', () => {
    expect(isGymSessionLifecycleStateValid(state(false, 'strength_completed', 'active', 'not_planned'))).toBe(false);
  });

  it('aceita sessão pós-força sem cardio e finalização aguardando importação', () => {
    expect(isGymSessionLifecycleStateValid(state(false, 'strength_completed', 'completed', 'not_planned'))).toBe(true);
    expect(isGymSessionLifecycleStateValid(state(true, 'completed', 'completed', 'awaiting_import'))).toBe(true);
    expect(canFinalizeGymSessionState(state(false, 'strength_completed', 'completed', 'awaiting_import'))).toBe(true);
  });

  it('normaliza insert do cliente legado sem manter combinação incoerente', () => {
    const normalized = normalizeLegacyCompletedLifecycle(state(true, 'active', 'active', 'not_planned'));
    expect(normalized).toEqual(state(true, 'completed', 'completed', 'not_planned'));
    expect(isGymSessionLifecycleStateValid(normalized)).toBe(true);
  });

  it('mantém sessão legada incompleta fora do estado ativo atual', () => {
    expect(isGymSessionLifecycleStateValid(state(false, 'legacy', 'active', 'not_planned'))).toBe(true);
  });
});

describe('snapshots planejados e realizados', () => {
  it('não inventa cardio em dia apenas de força', () => {
    expect(buildCardioPlanSnapshot({ selectedDay: { day_kind: 'strength' } }).planned).toBe(false);
  });

  it('cria plano de cardio para strength_cardio', () => {
    expect(buildCardioPlanSnapshot({ selectedDay: { day_kind: 'strength_cardio' }, selectedChoice: 'Esteira 15 min' })).toMatchObject({ planned: true, activity_label: 'Esteira 15 min', target_minutes: 15 });
  });

  it('limita a 20 minutos uma prescrição textual de 25 minutos', () => {
    expect(buildCardioPlanSnapshot({ selectedDay: { day_kind: 'strength_cardio' }, selectedChoice: 'Esteira 25 min' }).target_minutes).toBe(20);
  });

  it.each([
    [null, null],
    [-5, 0],
    [5, 5],
    [10, 10],
    [20, 20],
    [25, 20],
    [60, 20],
  ])('normaliza prescrição pronta de %j min para %j min', (input, output) => {
    expect(normalizeCardioPlanSnapshot({ planned: true, target_minutes: input }).target_minutes).toBe(output);
  });

  it('prioriza minutos recomendados pelo motor adaptativo', () => {
    expect(buildCardioPlanSnapshot({ selectedDay: { day_kind: 'strength_cardio' }, selectedChoice: 'Esteira 20 min', recommendedMinutes: 8 }).target_minutes).toBe(8);
  });

  it('usa dez minutos quando não há número no texto', () => {
    expect(buildCardioPlanSnapshot({ selectedDay: { cardio_required: true }, selectedChoice: 'Bike leve' }).target_minutes).toBe(10);
  });

  it('mantém distância fora do plano de cardio', () => {
    expect(buildCardioPlanSnapshot({ selectedDay: { cardio_required: true }, selectedChoice: 'Corrida' })).not.toHaveProperty('distance_km');
  });

  it('agrupa séries planejadas por exercício', () => {
    const result = buildStrengthPlanSnapshot([
      row('supino', 'Supino máquina', 1),
      row('supino', 'Supino máquina', 2),
      row('remada', 'Remada baixa', 1),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ exercise_name: 'Supino máquina', planned_sets: 2 });
  });

  it('preserva reps planejadas no snapshot', () => {
    expect(buildStrengthPlanSnapshot([{ ...row('supino', 'Supino máquina', 1), planned_reps: '8-10' }])[0].planned_reps).toBe('8-10');
  });

  it('converte carga decimal com vírgula', () => {
    expect(buildStrengthPlanSnapshot([{ ...row('supino', 'Supino máquina', 1), load_kg: '42,5' }])[0].planned_load_kg).toBe(42.5);
  });

  it('mantém carga vazia como null', () => {
    expect(buildStrengthPlanSnapshot([{ ...row('supino', 'Supino máquina', 1), load_kg: '' }])[0].planned_load_kg).toBeNull();
  });

  it('separa plano de força das séries realizadas', () => {
    const detail = plannedVsRealized({ strength_plan: [{ exercise_name: 'Supino' }], workout_exercise_sets: [{ reps: 10 }, { reps: 9 }] });
    expect(detail.strength.planned).toHaveLength(1);
    expect(detail.strength.realized).toHaveLength(2);
  });

  it('expõe cardio fisiológico sem substituir o plano', () => {
    const detail = plannedVsRealized({ cardio_status: 'completed', cardio_plan: { planned: true, target_minutes: 10 }, cardio_sessions: [{ duration_seconds: 728, avg_heart_rate: 132 }] });
    expect(detail.cardio).toMatchObject({ status: 'completed', planned: { target_minutes: 10 }, realized: { duration_seconds: 728 } });
  });

  it('mantém planejado 10 minutos e realizado 25 minutos separados', () => {
    const detail = plannedVsRealized({
      cardio_status: 'completed',
      cardio_plan: { planned: true, target_minutes: 10 },
      cardio_sessions: [{ duration_seconds: 25 * 60, distance_km: 2.5 }],
    });
    expect(detail.cardio.planned.target_minutes).toBe(10);
    expect(detail.cardio.realized.duration_seconds).toBe(1500);
  });

  it('expõe relógio como complemento da força do app', () => {
    const detail = plannedVsRealized({ workout_exercise_sets: [{ reps: 10 }], wearable_workout_sessions: [{ avg_heart_rate: 98 }] });
    expect(detail.wearable).toEqual({ avg_heart_rate: 98 });
    expect(detail.strength.realized).toHaveLength(1);
  });

  it('não transforma cardio pulado em execução zero', () => {
    const detail = plannedVsRealized({ cardio_status: 'skipped', cardio_plan: { planned: true }, cardio_sessions: [] });
    expect(detail.cardio.realized).toBeNull();
  });

  it('restaura cardio pendente ao apagar execução vinculada planejada', () => {
    expect(cardioStatusAfterDeletingLinkedExecution({ planned: true, activity_label: 'Esteira', target_minutes: 10, intensity: null, target_rpe: null, notes: null })).toBe('pending');
  });

  it('restaura not_planned ao apagar execução sem plano', () => {
    expect(cardioStatusAfterDeletingLinkedExecution({ planned: false, activity_label: null, target_minutes: null, intensity: null, target_rpe: null, notes: null })).toBe('not_planned');
  });

  it('mantém sessão finalizada coerente ao apagar cardio planejado', () => {
    expect(cardioStatusAfterDeletingLinkedExecution({ planned: true, activity_label: 'Esteira', target_minutes: 10, intensity: null, target_rpe: null, notes: null }, true)).toBe('awaiting_import');
  });

  it('preserva início legado e não inventa timestamps ou duração final', () => {
    expect(gymSessionTiming({
      completed: true,
      performed_at: '2026-08-01T18:00:00-03:00',
      completed_at: null,
      strength_completed_at: null,
      duration_minutes: null,
    })).toEqual({
      startedAt: '2026-08-01T18:00:00-03:00',
      strengthCompletedAt: null,
      completedAt: null,
      durationMinutes: null,
    });
  });

  it('preserva timestamps reais de uma sessão nova', () => {
    expect(gymSessionTiming({
      performed_at: '2026-08-01T18:00:00-03:00',
      strength_completed_at: '2026-08-01T18:45:00-03:00',
      completed_at: '2026-08-01T19:00:00-03:00',
      duration_minutes: 60,
    })).toMatchObject({
      startedAt: '2026-08-01T18:00:00-03:00',
      strengthCompletedAt: '2026-08-01T18:45:00-03:00',
      completedAt: '2026-08-01T19:00:00-03:00',
      durationMinutes: 60,
    });
  });

  it.each([
    [null, null],
    ['', null],
    ['10', 10],
    ['10,5', 10.5],
    ['abc', null],
  ])('normaliza número %j para %j', (input, output) => {
    expect(nullableNumber(input)).toBe(output);
  });
});

describe('vínculo explícito sugerido por data e horário', () => {
  const importAt = '2026-08-19T18:20:00-03:00';

  it('sugere cardio pendente do mesmo usuário e dia', () => {
    expect(candidates('cardio', [gym('u1', 's1', '2026-08-19T18:00:00-03:00', { cardio_status: 'pending' })])).toHaveLength(1);
  });

  it('prioriza cardio aguardando importação', () => {
    const result = candidates('cardio', [
      gym('u1', 'pending', '2026-08-19T18:10:00-03:00', { cardio_status: 'pending' }),
      gym('u1', 'awaiting', '2026-08-19T18:10:00-03:00', { cardio_status: 'awaiting_import' }),
    ]);
    expect(result[0].id).toBe('awaiting');
  });

  it('não sugere sessão de outro usuário', () => {
    expect(candidates('cardio', [gym('u2', 's1', '2026-08-19T18:00:00-03:00', { cardio_status: 'pending' })])).toHaveLength(0);
  });

  it('não sugere sessão de outro dia', () => {
    expect(candidates('cardio', [gym('u1', 's1', '2026-08-18T18:00:00-03:00', { cardio_status: 'pending' })])).toHaveLength(0);
  });

  it('não sugere cardio já vinculado', () => {
    expect(candidates('cardio', [gym('u1', 's1', '2026-08-19T18:00:00-03:00', { cardio_status: 'pending', cardio_sessions: [{ id: 'c1' }] })])).toHaveLength(0);
  });

  it('não sugere cardio já concluído', () => {
    expect(candidates('cardio', [gym('u1', 's1', '2026-08-19T18:00:00-03:00', { cardio_status: 'completed' })])).toHaveLength(0);
  });

  it('sugere relógio para força concluída', () => {
    expect(candidates('strength', [gym('u1', 's1', '2026-08-19T18:00:00-03:00', { strength_status: 'completed' })])).toHaveLength(1);
  });

  it('não sugere relógio para força ativa', () => {
    expect(candidates('strength', [gym('u1', 's1', '2026-08-19T18:00:00-03:00', { strength_status: 'active' })])).toHaveLength(0);
  });

  it('não sugere relógio já vinculado', () => {
    expect(candidates('strength', [gym('u1', 's1', '2026-08-19T18:00:00-03:00', { strength_status: 'completed', wearable_workout_sessions: [{ id: 'w1' }] })])).toHaveLength(0);
  });

  it('ordena a sessão mais próxima quando bônus é igual', () => {
    const result = candidates('cardio', [
      gym('u1', 'far', '2026-08-19T16:00:00-03:00', { cardio_status: 'pending' }),
      gym('u1', 'near', '2026-08-19T18:15:00-03:00', { cardio_status: 'pending' }),
    ]);
    expect(result[0].id).toBe('near');
  });

  it('não sugere distância temporal maior que oito horas', () => {
    expect(candidates('cardio', [gym('u1', 's1', '2026-08-19T09:00:00-03:00', { cardio_status: 'pending' })])).toHaveLength(0);
  });

  it('sugere sessão iniciada antes da meia-noite para cardio vinte minutos depois', () => {
    const result = rankGymImportCandidates({
      userId: 'u1',
      performedAt: '2026-08-30T00:10:00-03:00',
      sessions: [gym('u1', 'midnight', '2026-08-29T23:50:00-03:00', { session_local_date: '2026-08-29', cardio_status: 'awaiting_import' })],
      kind: 'cardio',
      timeZone: 'America/Sao_Paulo',
    });
    expect(result.map((item) => item.id)).toEqual(['midnight']);
    expect(result[0].session_local_date).toBe('2026-08-29');
  });

  it('não sugere sessão do dia adjacente quando está quatorze horas distante', () => {
    const result = rankGymImportCandidates({
      userId: 'u1',
      performedAt: '2026-08-30T08:00:00-03:00',
      sessions: [gym('u1', 'far-midnight', '2026-08-29T18:00:00-03:00', { session_local_date: '2026-08-29', cardio_status: 'awaiting_import' })],
      kind: 'cardio',
      timeZone: 'America/Sao_Paulo',
    });
    expect(result).toHaveLength(0);
  });

  it('ordena múltiplos candidatos perto da meia-noite pela proximidade', () => {
    const result = rankGymImportCandidates({
      userId: 'u1',
      performedAt: '2026-08-30T00:10:00-03:00',
      sessions: [
        gym('u1', 'farther-awaiting', '2026-08-29T23:20:00-03:00', { session_local_date: '2026-08-29', cardio_status: 'awaiting_import' }),
        gym('u1', 'near-pending', '2026-08-29T23:55:00-03:00', { session_local_date: '2026-08-29', cardio_status: 'pending' }),
      ],
      kind: 'cardio',
      timeZone: 'America/Sao_Paulo',
    });
    expect(result.map((item) => item.id)).toEqual(['near-pending', 'farther-awaiting']);
  });

  it('omite o campo de vínculo quando o usuário salva separado', () => {
    expect(withOptionalWorkoutLink({ dedupe_key: 'same', workout_session_id: null }, null)).toEqual({ dedupe_key: 'same' });
  });

  it('inclui o vínculo apenas após escolha explícita', () => {
    expect(withOptionalWorkoutLink({ dedupe_key: 'same' }, 'session-1')).toEqual({ dedupe_key: 'same', workout_session_id: 'session-1' });
  });

  function candidates(kind: 'cardio' | 'strength', sessions: any[]) {
    return rankGymImportCandidates({ userId: 'u1', performedAt: importAt, sessions, kind, timeZone: 'America/Sao_Paulo' });
  }
});

function row(id: string, name: string, setNumber: number) {
  return { exercise_entry_id: id, exercise_name: name, set_number: setNumber, planned_reps: '10', load_kg: 40 };
}

function gym(userId: string, id: string, performedAt: string, patch: any) {
  return { user_id: userId, id, performed_at: performedAt, cardio_status: 'not_planned', strength_status: 'active', cardio_sessions: [], wearable_workout_sessions: [], ...patch };
}

function state(completed: boolean, sessionStatus: string, strengthStatus: string, cardioStatus: string) {
  return { completed, sessionStatus, strengthStatus, cardioStatus };
}
