import { describe, expect, it } from 'vitest';
import { buildWeeklyGymQueue, countUniqueBaseSessionsByWeek, getLocalWeek, selectionKindFor } from './weeklyGym';

const TZ = 'America/Sao_Paulo';
const NOW = new Date('2026-08-19T10:00:00-03:00');
const CHECKIN = {
  log_date: '2026-08-19',
  morning_saved_at: '2026-08-19T07:00:00-03:00',
  sleep_hours: 7.2,
  energy_score: 7,
  recovery_score: 7,
  pain_level: 0,
};
const PLAN = [
  day('upper-a', 'Superior A', 1, ['Supino máquina', 'Puxada alta']),
  day('lower-a', 'Inferior A', 2, ['Leg press 45°', 'Cadeira flexora']),
  day('upper-b', 'Superior B', 4, ['Remada baixa', 'Desenvolvimento máquina']),
  day('lower-b', 'Inferior B', 5, ['Stiff', 'Cadeira extensora']),
];

describe('semana local segunda a domingo', () => {
  it.each([
    '2026-08-17T12:00:00-03:00',
    '2026-08-18T12:00:00-03:00',
    '2026-08-19T12:00:00-03:00',
    '2026-08-20T12:00:00-03:00',
    '2026-08-21T12:00:00-03:00',
    '2026-08-22T12:00:00-03:00',
    '2026-08-23T12:00:00-03:00',
  ])('mantém %s na mesma janela semanal', (value) => {
    expect(getLocalWeek(value, TZ)).toMatchObject({ startKey: '2026-08-17', endKey: '2026-08-23' });
  });

  it('vira a semana à meia-noite local de segunda-feira', () => {
    expect(getLocalWeek('2026-08-24T00:01:00-03:00', TZ).startKey).toBe('2026-08-24');
  });
});

describe('fila semanal flexível', () => {
  it('monta quatro sessões-base', () => {
    expect(queue().targetCount).toBe(4);
  });

  it('ordena Upper/Lower A/B pela sequência lógica', () => {
    expect(queue().items.map((item) => item.day.id)).toEqual(['upper-a', 'lower-a', 'upper-b', 'lower-b']);
  });

  it('recomenda a primeira pendente quando a semana está vazia', () => {
    expect(queue().recommended?.day.id).toBe('upper-a');
  });

  it('avança para Inferior A depois de Superior A', () => {
    expect(queue([session('upper-a', '2026-08-17T08:00:00-03:00')]).recommended?.day.id).toBe('lower-a');
  });

  it('conta somente uma conclusão-base quando Superior A é repetido', () => {
    const result = queue([
      session('upper-a', '2026-08-17T08:00:00-03:00'),
      session('upper-a', '2026-08-18T08:00:00-03:00'),
    ]);
    expect(result.completedBaseCount).toBe(1);
  });

  it('classifica a repetição na mesma semana como extra', () => {
    const result = queue([
      session('upper-a', '2026-08-17T08:00:00-03:00'),
      session('upper-a', '2026-08-18T08:00:00-03:00'),
    ]);
    expect(result.extraCount).toBe(1);
  });

  it('retorna selection_kind extra para dia já concluído', () => {
    const result = queue([session('upper-a', '2026-08-17T08:00:00-03:00')]);
    expect(selectionKindFor(result, 'upper-a')).toBe('extra');
  });

  it('retorna selection_kind recommended para a sugestão atual', () => {
    expect(selectionKindFor(queue(), 'upper-a', 'recommended')).toBe('recommended');
  });

  it('retorna selection_kind manual para escolha alternativa', () => {
    expect(selectionKindFor(queue(), 'lower-b', 'manual')).toBe('manual');
  });

  it('não bloqueia Superior A só porque hoje é quarta-feira', () => {
    expect(queue().recommended?.day.id).toBe('upper-a');
  });

  it('prefere Inferior A quando superiores foram treinados nas últimas 48h', () => {
    const result = queue([], [{ exercise_name: 'Supino máquina', performed_at: '2026-08-18T10:00:00-03:00' }]);
    expect(result.recommended?.day.id).toBe('lower-a');
  });

  it('marca sessão com musculatura recente como não ideal', () => {
    const result = queue([], [{ exercise_name: 'Supino máquina', performed_at: '2026-08-18T10:00:00-03:00' }]);
    expect(result.items.find((item) => item.day.id === 'upper-a')?.status).toBe('not_ideal');
  });

  it('marca outro Upper como não ideal após Upper recente', () => {
    const result = queue([], [{ exercise_name: 'Supino máquina', performed_at: '2026-08-18T10:00:00-03:00' }]);
    expect(result.items.find((item) => item.day.id === 'upper-b')?.status).toBe('not_ideal');
  });

  it('marca outro Lower como não ideal após Lower recente', () => {
    const result = queue([], [{ exercise_name: 'Leg press 45°', performed_at: '2026-08-18T10:00:00-03:00' }]);
    expect(result.items.find((item) => item.day.id === 'lower-b')?.status).toBe('not_ideal');
  });

  it('explica volume alto de sete dias', () => {
    const sets = Array.from({ length: 16 }, (_, index) => ({ exercise_name: 'Supino máquina', performed_at: new Date(NOW.getTime() - (80 + index) * 3_600_000).toISOString() }));
    expect(queue([], sets).items[0].reasons.some((reason) => reason.includes('Volume recente alto'))).toBe(true);
  });

  it('explica falta de tempo sem esconder a sessão', () => {
    const result = buildWeeklyGymQueue({ planDays: PLAN, checkin: { ...CHECKIN, available_minutes: 10 }, now: NOW, timeZone: TZ });
    expect(result.items[0].reasons.some((reason) => reason.includes('Tempo disponível'))).toBe(true);
  });

  it('indica check-in ausente sem inventar dados', () => {
    expect(buildWeeklyGymQueue({ planDays: PLAN, now: NOW, timeZone: TZ }).checkinMissing).toBe(true);
  });

  it('não trata sessão ativa como conclusão', () => {
    const result = queue([{ ...session('upper-a', '2026-08-17T08:00:00-03:00'), completed: false, strength_status: 'active' }]);
    expect(result.completedBaseCount).toBe(0);
  });

  it('aceita sessão legada completed=true como conclusão', () => {
    const result = queue([{ training_day_id: 'upper-a', performed_at: '2026-08-17T08:00:00-03:00', completed: true }]);
    expect(result.completedBaseCount).toBe(1);
  });

  it('ignora conclusão da semana anterior', () => {
    expect(queue([session('upper-a', '2026-08-16T08:00:00-03:00')]).completedBaseCount).toBe(0);
  });

  it('reinicia todas as pendências na semana seguinte sem carregar dívida', () => {
    const result = buildWeeklyGymQueue({
      planDays: PLAN,
      workoutSessions: [session('upper-a', '2026-08-17T08:00:00-03:00')],
      checkin: { ...CHECKIN, log_date: '2026-08-24' },
      now: '2026-08-24T10:00:00-03:00',
      timeZone: TZ,
    });
    expect(result.items.every((item) => item.completionCount === 0)).toBe(true);
  });

  it('usa session_local_date para preservar sessão atravessando meia-noite', () => {
    const result = queue([{ ...session('upper-a', '2026-08-24T00:05:00-03:00'), session_local_date: '2026-08-23' }]);
    expect(result.completedBaseCount).toBe(1);
  });

  it('mantém as quatro bases concluídas mesmo com um extra', () => {
    const sessions = PLAN.map((item, index) => session(item.id, `2026-08-${17 + index}T08:00:00-03:00`));
    sessions.push({ ...session('upper-a', '2026-08-22T08:00:00-03:00'), selection_kind: 'extra' });
    expect(queue(sessions).completedBaseCount).toBe(4);
  });

  it('oferece uma repetição quando todas as bases acabaram', () => {
    const sessions = PLAN.map((item, index) => session(item.id, `2026-08-${17 + index}T08:00:00-03:00`));
    expect(queue(sessions).recommended).not.toBeNull();
  });
});

describe('aderência sem inflação por extras', () => {
  it('deduplica o mesmo training_day na mesma semana', () => {
    expect(countUniqueBaseSessionsByWeek([
      session('upper-a', '2026-08-17T08:00:00-03:00'),
      session('upper-a', '2026-08-18T08:00:00-03:00'),
    ], TZ)).toBe(1);
  });

  it('ignora seleção explicitamente extra', () => {
    expect(countUniqueBaseSessionsByWeek([{ ...session('upper-a', '2026-08-17T08:00:00-03:00'), selection_kind: 'extra' }], TZ)).toBe(0);
  });

  it('conta o mesmo treino novamente em uma semana futura', () => {
    expect(countUniqueBaseSessionsByWeek([
      session('upper-a', '2026-08-17T08:00:00-03:00'),
      session('upper-a', '2026-08-24T08:00:00-03:00'),
    ], TZ)).toBe(2);
  });

  it('mantém 3/4 quando há três bases diferentes e um extra', () => {
    expect(countUniqueBaseSessionsByWeek([
      session('upper-a', '2026-08-17T08:00:00-03:00'),
      session('lower-a', '2026-08-18T08:00:00-03:00'),
      session('upper-b', '2026-08-20T08:00:00-03:00'),
      { ...session('upper-a', '2026-08-21T08:00:00-03:00'), selection_kind: 'extra' },
    ], TZ)).toBe(3);
  });
});

function day(id: string, title: string, weekday: number, exercises: string[]) {
  return { id, title, weekday, day_kind: 'strength_cardio', exercise_entries: exercises.map((exercise_name, index) => ({ id: `${id}-${index}`, exercise_name, sets: '3', reps: '10' })) };
}

function session(trainingDayId: string, performedAt: string) {
  return { id: `${trainingDayId}-${performedAt}`, training_day_id: trainingDayId, performed_at: performedAt, completed: false, strength_status: 'completed', selection_kind: 'manual' };
}

function queue(workoutSessions: any[] = [], completedSets: any[] = []) {
  return buildWeeklyGymQueue({ planDays: PLAN, workoutSessions, completedSets, checkin: CHECKIN, now: NOW, timeZone: TZ });
}
