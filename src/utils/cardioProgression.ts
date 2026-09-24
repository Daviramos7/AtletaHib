export const MAX_RECOMMENDED_CARDIO_MINUTES = 20;

const DEFAULT_PROGRESSIONS = [
  {
    phase: 1,
    title: 'Base curta 1',
    goal: 'Criar consistência sem transformar cardio em sofrimento.',
    workout: '15 min leve',
    prescription: 'Aqueça 4 min. Depois faça 5x: 1 min trote leve + 1 min caminhada. Finalize caminhando leve.',
    intensity: 'RPE 5-6',
  },
  {
    phase: 2,
    title: 'Base curta 2',
    goal: 'Melhorar fôlego mantendo o teto de 20 minutos.',
    workout: '18 min leve',
    prescription: 'Aqueça 4 min. Depois faça 6x: 1 min trote leve + 1 min caminhada. Finalize caminhando leve.',
    intensity: 'RPE 5-6',
  },
  {
    phase: 3,
    title: '20 min controlado',
    goal: 'Sustentar cardio curto sem quebrar.',
    workout: '20 min controlado',
    prescription: 'Aqueça 4 min. Faça 12 min em ritmo confortável. Termine com 4 min leve. Não passe de 20 min.',
    intensity: 'RPE 6',
  },
  {
    phase: 4,
    title: 'Intervalado curto',
    goal: 'Ganhar fôlego com pouco volume.',
    workout: '18 min intervalado',
    prescription: 'Aqueça 5 min. Faça 5x: 1 min forte controlado + 90s leve. Sem sprint. Termine leve.',
    intensity: 'RPE 7 nos tiros',
  },
  {
    phase: 5,
    title: 'Zona 2 curta',
    goal: 'Melhorar resistência sem aumentar duração.',
    workout: '20 min leve',
    prescription: '20 min em ritmo em que ainda dá para conversar. Pode ser caminhada rápida, bike, esteira ou elíptico.',
    intensity: 'RPE 5-6',
  },
  {
    phase: 6,
    title: 'Intervalado moderado curto',
    goal: 'Aumentar tolerância ao esforço sem passar do teto.',
    workout: '20 min intervalado',
    prescription: 'Aqueça 5 min. Faça 6x: 45s forte controlado + 90s leve. Termine caminhando. Sem sprint.',
    intensity: 'RPE 7-8 nos tiros',
  },
  {
    phase: 7,
    title: 'Base curta forte',
    goal: 'Consolidar condicionamento com cardio curto.',
    workout: '20 min leve/moderado',
    prescription: '20 min controlados. Prioridade é terminar inteiro e recuperar bem para a musculação.',
    intensity: 'RPE 5-7',
  },
  {
    phase: 8,
    title: 'Manutenção curta',
    goal: 'Manter cardio sustentável.',
    workout: '15-20 min',
    prescription: 'Se estiver cansado: 15-20 min leve. Se estiver bem: 5 tiros controlados dentro de 20 min totais.',
    intensity: 'RPE 5-8',
  },
];

export function getCardioProgression(cardioSessions = [], selectedOption = null, context: any = {}) {
  const now = new Date(context.now ?? Date.now());
  const zone = context.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const parents = new Map((context.workoutSessions ?? []).map((row) => [row.id, row]));
  const sessions = (Array.isArray(cardioSessions) ? cardioSessions : [])
    .filter((row) => Number(row.duration_seconds) > 0 && new Date(row.performed_at).getTime() <= now.getTime())
    .filter((row) => !['skipped', 'pending', 'awaiting_import'].includes(row.status ?? row.cardio_status) && row.completed !== false)
    // An explicit workout link is evidence of which prescription was performed. Standalone imports are not stage completions.
    .filter((row) => {
      if (!row.workout_session_id) return false;
      const parent: any = parents.get(row.workout_session_id);
      return !parent || (parent.cardio_status === 'completed' && parent.cardio_plan?.planned === true);
    })
    .filter((row, index, rows) => rows.findIndex((other) => other.workout_session_id === row.workout_session_id) === index)
    .sort((a, b) => new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime());
  let phaseIndex = 0;
  let inPhase = 0;
  let lastStage = 0;
  let lastDate: string | null = null;
  const applyPause = (gap: number) => {
    if (gap >= 28) { phaseIndex = 0; inPhase = 0; }
    else if (gap >= 14) { phaseIndex = Math.max(0, lastStage - 1); inPhase = 0; }
    else if (gap >= 8) { phaseIndex = lastStage; inPhase = 0; }
  };
  for (const session of sessions) {
    const date = dateKeyInTimeZone(session.performed_at, zone);
    if (lastDate) applyPause(calendarGap(lastDate, date));
    lastStage = phaseIndex;
    const parent: any = parents.get(session.workout_session_id);
    const effort = Number(session.perceived_effort ?? session.raw_json?.perceived_effort ?? parent?.perceived_effort);
    const adapted = parent?.adaptation_summary;
    if (!(effort >= 9) && adapted?.progression_allowed !== false && adapted?.workoutMode !== 'retorno') {
      inPhase++;
      if (inPhase >= 3) { phaseIndex = Math.min(phaseIndex + 1, DEFAULT_PROGRESSIONS.length - 1); inPhase = 0; }
    }
    lastDate = date;
  }
  const gap = lastDate ? calendarGap(lastDate, dateKeyInTimeZone(now, zone)) : null;
  if (gap !== null) applyPause(gap);
  const recommendation = context.recommendation;
  const adaptiveReturn = recommendation?.workoutMode === 'retorno';
  const progressionBlocked = recommendation && recommendation.progressionAllowed !== true;
  if (progressionBlocked || adaptiveReturn) phaseIndex = Math.min(phaseIndex, lastStage);
  if (adaptiveReturn) phaseIndex = Math.max(0, Math.min(phaseIndex, lastStage - 1));
  const returnMode = adaptiveReturn || (gap !== null && gap >= 14);
  const paused = gap !== null && gap >= 8;
  const phase = DEFAULT_PROGRESSIONS[phaseIndex];
  const completed = sessions.length;
  const nextUnlock = 3 - inPhase;
  const adaptiveMinutes = recommendation?.checkinValid ? Number(recommendation.cardioGuidance?.minutes) : null;
  const phaseMinutes = phaseIndex === 0 ? 15 : [1, 3].includes(phaseIndex) ? 18 : 20;
  const targetMinutes = Math.min(phaseMinutes, adaptiveMinutes === null || !Number.isFinite(adaptiveMinutes) ? 20 : Math.max(0, adaptiveMinutes));
  const reduced = targetMinutes < phaseMinutes;
  const common = {
    ...phase, phaseIndex, completed, inPhase, nextUnlock, gapDays: gap, returnMode, targetMinutes,
    phaseLabel: `Fase ${phase.phase} de ${DEFAULT_PROGRESSIONS.length}`,
    progressText: `${inPhase}/3 execuções elegíveis nesta fase`, maxMinutes: MAX_RECOMMENDED_CARDIO_MINUTES,
    statusLabel: returnMode ? 'Retorno · ritmo reduzido após pausa' : paused ? 'Repetir estágio após pausa' : progressionBlocked ? 'Progressão aguardando prontidão' : null,
    ...(reduced ? { workout: `${targetMinutes} min leves`, prescription: targetMinutes > 0 ? `Faça ${targetMinutes} min em ritmo conversável, conforme a prontidão de hoje.` : 'Sem cardio prescrito hoje.', intensity: 'Leve' } : {}),
  };

  if (isFootballOption(selectedOption)) {
    return {
      ...common,
      title: 'Futebol controlado',
      workout: `até ${targetMinutes} min recomendados`,
      prescription: 'Se jogar futebol de verdade, não faça cardio extra no mesmo dia. Para o plano do app, o teto recomendado continua 20 min.',
      intensity: 'RPE 6-8',
      custom: true,
      completed,
      inPhase,
      nextUnlock,
      phaseLabel: `Fase ${phase.phase} de ${DEFAULT_PROGRESSIONS.length}`,
      progressText: common.progressText,
      maxMinutes: MAX_RECOMMENDED_CARDIO_MINUTES,
    };
  }

  return common;
}

function calendarGap(first: string, last: string) {
  return Math.max(0, Math.round((Date.parse(`${last}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / 86_400_000));
}

export function getSelectedCardioOption(options = [], selectedLabel = '') {
  const list = Array.isArray(options) ? options : [];
  return list.find((option) => option.label === selectedLabel) ?? list[0] ?? null;
}

export function clampRecommendedCardioMinutes(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) return MAX_RECOMMENDED_CARDIO_MINUTES;
  return Math.min(Math.round(value), MAX_RECOMMENDED_CARDIO_MINUTES);
}

function isFootballOption(option) {
  const text = String(option?.label ?? '').toLowerCase();
  return text.includes('futebol') || text.includes('bola');
}
import { dateKeyInTimeZone } from '../domain/readiness';
