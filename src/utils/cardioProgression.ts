const DEFAULT_PROGRESSIONS = [
  {
    phase: 1,
    title: 'Base 1',
    goal: 'Criar consistência sem sofrer.',
    workout: '20 min leve',
    prescription: 'Aqueça 5 min. Depois faça 8x: 1 min trote leve + 2 min caminhada. Finalize caminhando.',
    intensity: 'RPE 5-6',
  },
  {
    phase: 2,
    title: 'Base 2',
    goal: 'Aumentar tempo em movimento.',
    workout: '25 min leve',
    prescription: 'Aqueça 5 min. Depois faça 8x: 90s trote leve + 2 min caminhada. Finalize caminhando.',
    intensity: 'RPE 5-6',
  },
  {
    phase: 3,
    title: '1 km progressivo',
    goal: 'Fazer 1 km controlado sem quebrar.',
    workout: '1 km controlado',
    prescription: 'Aqueça 5-8 min. Faça 1 km em ritmo confortável. Caminhe 5 min no fim.',
    intensity: 'RPE 6',
  },
  {
    phase: 4,
    title: 'Intervalado leve',
    goal: 'Ganhar fôlego com segurança.',
    workout: '6 repetições',
    prescription: 'Aqueça 8 min. Faça 6x: 1 min forte controlado + 2 min leve. Sem sprint.',
    intensity: 'RPE 7 nos tiros',
  },
  {
    phase: 5,
    title: 'Zona 2',
    goal: 'Melhorar resistência e recuperação.',
    workout: '30 min leve',
    prescription: 'Ritmo em que ainda dá para conversar. Pode ser caminhada rápida, bike, esteira ou elíptico.',
    intensity: 'RPE 5-6',
  },
  {
    phase: 6,
    title: 'Intervalado moderado',
    goal: 'Aumentar tolerância ao esforço.',
    workout: '8 repetições',
    prescription: 'Aqueça 8 min. Faça 8x: 1 min forte controlado + 90s leve. Termine caminhando.',
    intensity: 'RPE 7-8 nos tiros',
  },
  {
    phase: 7,
    title: 'Base longa',
    goal: 'Sustentar mais tempo sem exagerar.',
    workout: '35-45 min leve',
    prescription: 'Ritmo confortável. Prioridade é terminar inteiro, não bater recorde.',
    intensity: 'RPE 5-6',
  },
  {
    phase: 8,
    title: 'Manutenção',
    goal: 'Alternar base e intervalado.',
    workout: 'Z2 ou intervalado',
    prescription: 'Se estiver cansado: 30-40 min leve. Se estiver bem: 6-8 tiros controlados.',
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
      title: 'Futebol recreativo',
      workout: '40-60 min',
      prescription: 'Aqueça 8-10 min. Jogue controlado. Não faça tiro/intervalado extra no mesmo dia.',
      intensity: 'RPE 6-8',
      custom: true,
      completed,
      inPhase,
      nextUnlock,
      phaseLabel: `Fase ${phase.phase} de ${DEFAULT_PROGRESSIONS.length}`,
      progressText: `${inPhase}/3 cardios nesta fase`,
    };
  }

  return {
    ...phase,
    completed,
    inPhase,
    nextUnlock,
    phaseLabel: `Fase ${phase.phase} de ${DEFAULT_PROGRESSIONS.length}`,
    progressText: `${inPhase}/3 cardios nesta fase`,
  };
}

export function getSelectedCardioOption(options = [], selectedLabel = '') {
  const list = Array.isArray(options) ? options : [];
  return list.find((option) => option.label === selectedLabel) ?? list[0] ?? null;
}

function isFootballOption(option) {
  const text = String(option?.label ?? '').toLowerCase();
  return text.includes('futebol') || text.includes('bola');
}
