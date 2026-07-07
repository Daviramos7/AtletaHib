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

export function getCardioProgression(cardioSessions = [], selectedOption = null) {
  const sessions = Array.isArray(cardioSessions) ? cardioSessions : [];
  const completed = sessions.length;
  const phaseIndex = Math.min(Math.floor(completed / 3), DEFAULT_PROGRESSIONS.length - 1);
  const phase = DEFAULT_PROGRESSIONS[phaseIndex];
  const inPhase = completed % 3;
  const nextUnlock = 3 - inPhase;

  if (isFootballOption(selectedOption)) {
    return {
      ...phase,
      title: 'Futebol controlado',
      workout: 'até 20 min recomendados',
      prescription: 'Se jogar futebol de verdade, não faça cardio extra no mesmo dia. Para o plano do app, o teto recomendado continua 20 min.',
      intensity: 'RPE 6-8',
      custom: true,
      completed,
      inPhase,
      nextUnlock,
      phaseLabel: `Fase ${phase.phase} de ${DEFAULT_PROGRESSIONS.length}`,
      progressText: `${inPhase}/3 cardios nesta fase`,
      maxMinutes: MAX_RECOMMENDED_CARDIO_MINUTES,
    };
  }

  return {
    ...phase,
    completed,
    inPhase,
    nextUnlock,
    phaseLabel: `Fase ${phase.phase} de ${DEFAULT_PROGRESSIONS.length}`,
    progressText: `${inPhase}/3 cardios nesta fase`,
    maxMinutes: MAX_RECOMMENDED_CARDIO_MINUTES,
  };
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
