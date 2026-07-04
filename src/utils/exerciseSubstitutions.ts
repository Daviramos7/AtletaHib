const REASONS = [
  { id: 'busy', label: 'Aparelho ocupado', hint: 'Trocar por opção parecida.' },
  { id: 'dont_know', label: 'Não sei fazer', hint: 'Escolher uma opção mais simples.' },
  { id: 'discomfort', label: 'Desconforto/dor', hint: 'Usar alternativa mais controlada.' },
  { id: 'crowded', label: 'Academia cheia', hint: 'Preferir máquina/cabo/halter disponível.' },
];

const LIBRARY = [
  {
    match: ['stiff', 'levantamento terra romeno', 'terra romeno'],
    focus: 'posterior de coxa/glúteo',
    options: [
      { name: 'Cadeira flexora', tag: 'Mais simples', reason: 'Isola posterior e exige menos técnica.' },
      { name: 'Mesa flexora', tag: 'Mais simples', reason: 'Boa opção quando não quer fazer dobradiça de quadril.' },
      { name: 'Hip thrust máquina', tag: 'Glúteo', reason: 'Alternativa controlada para glúteo/posterior.' },
      { name: 'Pull-through na polia', tag: 'Parecido', reason: 'Mantém o padrão de quadril com carga mais guiada.' },
    ],
  },
  {
    match: ['leg press', 'agachamento', 'hack'],
    focus: 'quadríceps/pernas',
    options: [
      { name: 'Cadeira extensora', tag: 'Quadríceps', reason: 'Boa troca se o leg press estiver ocupado.' },
      { name: 'Agachamento no smith', tag: 'Parecido', reason: 'Mantém padrão de agachar com mais guia.' },
      { name: 'Afundo no smith', tag: 'Unilateral', reason: 'Opção forte para pernas quando há pouco equipamento.' },
      { name: 'Leg press horizontal', tag: 'Parecido', reason: 'Mesma família do leg press.' },
    ],
  },
  {
    match: ['supino', 'peito', 'chest press'],
    focus: 'peito/tríceps',
    options: [
      { name: 'Supino máquina', tag: 'Controlado', reason: 'Mais fácil de executar e estabilizar.' },
      { name: 'Chest press', tag: 'Parecido', reason: 'Mesmo padrão de empurrar.' },
      { name: 'Flexão inclinada', tag: 'Sem aparelho', reason: 'Boa alternativa se a academia estiver cheia.' },
      { name: 'Crucifixo máquina', tag: 'Peito', reason: 'Mantém foco no peito com menos carga articular.' },
    ],
  },
  {
    match: ['puxada', 'pulldown', 'barra fixa'],
    focus: 'costas/bíceps',
    options: [
      { name: 'Puxada alta frente', tag: 'Parecido', reason: 'Mesma família de puxada vertical.' },
      { name: 'Puxada neutra', tag: 'Confortável', reason: 'Pegada geralmente mais confortável.' },
      { name: 'Remada baixa', tag: 'Costas', reason: 'Troca para puxada horizontal mantendo costas.' },
      { name: 'Pullover na polia', tag: 'Costas', reason: 'Alternativa controlada para dorsal.' },
    ],
  },
  {
    match: ['remada'],
    focus: 'costas',
    options: [
      { name: 'Remada baixa', tag: 'Parecido', reason: 'Opção direta de puxada horizontal.' },
      { name: 'Remada máquina', tag: 'Controlado', reason: 'Mais estável e simples.' },
      { name: 'Remada unilateral halter', tag: 'Halter', reason: 'Boa quando cabos/máquinas estão ocupados.' },
      { name: 'Puxada alta frente', tag: 'Costas', reason: 'Mantém foco em costas se remada não der.' },
    ],
  },
  {
    match: ['desenvolvimento', 'ombro', 'shoulder press'],
    focus: 'ombros',
    options: [
      { name: 'Desenvolvimento máquina', tag: 'Controlado', reason: 'Mais guiado e fácil de ajustar.' },
      { name: 'Elevação lateral', tag: 'Ombro', reason: 'Alternativa simples para ombros.' },
      { name: 'Elevação lateral máquina', tag: 'Controlado', reason: 'Ótima se halteres estiverem ocupados.' },
      { name: 'Arnold press leve', tag: 'Halter', reason: 'Use leve se já conhece o movimento.' },
    ],
  },
  {
    match: ['rosca', 'bíceps', 'biceps'],
    focus: 'bíceps',
    options: [
      { name: 'Rosca máquina', tag: 'Controlado', reason: 'Boa para manter execução simples.' },
      { name: 'Rosca direta barra W', tag: 'Parecido', reason: 'Opção comum para bíceps.' },
      { name: 'Rosca alternada halter', tag: 'Halter', reason: 'Fácil de adaptar se máquina estiver ocupada.' },
      { name: 'Rosca na polia', tag: 'Cabo', reason: 'Tensão constante e fácil de ajustar.' },
    ],
  },
  {
    match: ['tríceps', 'triceps'],
    focus: 'tríceps',
    options: [
      { name: 'Tríceps polia', tag: 'Parecido', reason: 'Opção mais simples e direta.' },
      { name: 'Tríceps corda', tag: 'Cabo', reason: 'Boa variação com cabo.' },
      { name: 'Tríceps máquina', tag: 'Controlado', reason: 'Mais estável para executar.' },
      { name: 'Supino fechado máquina', tag: 'Composto', reason: 'Usa tríceps com apoio.' },
    ],
  },
  {
    match: ['panturrilha'],
    focus: 'panturrilha',
    options: [
      { name: 'Panturrilha máquina', tag: 'Parecido', reason: 'Opção direta e controlada.' },
      { name: 'Panturrilha no leg press', tag: 'Alternativa', reason: 'Boa se a máquina específica estiver ocupada.' },
      { name: 'Panturrilha em pé com halter', tag: 'Halter', reason: 'Funciona bem em academia cheia.' },
    ],
  },
  {
    match: ['abdominal', 'prancha', 'core'],
    focus: 'core',
    options: [
      { name: 'Prancha', tag: 'Core', reason: 'Simples e segura.' },
      { name: 'Abdominal máquina', tag: 'Controlado', reason: 'Mais fácil de dosar carga.' },
      { name: 'Dead bug', tag: 'Controle', reason: 'Boa opção se lombar estiver sensível.' },
      { name: 'Pallof press', tag: 'Cabo', reason: 'Trabalha estabilidade sem flexionar muito a coluna.' },
    ],
  },
];

const FALLBACK_OPTIONS = [
  { name: 'Máquina equivalente', tag: 'Seguro', reason: 'Escolha a máquina mais parecida para o mesmo músculo.' },
  { name: 'Variação com halteres', tag: 'Halter', reason: 'Boa quando máquinas estão ocupadas.' },
  { name: 'Variação na polia', tag: 'Cabo', reason: 'Cabo costuma ser fácil de adaptar.' },
  { name: 'Exercício mais simples para o mesmo músculo', tag: 'Simples', reason: 'Priorize execução limpa.' },
];

export function getReplacementReasons() {
  return REASONS;
}

export function getSmartReplacements(exerciseName, selectedReason = 'busy') {
  const normalized = normalizeText(exerciseName);
  const group = LIBRARY.find((item) => item.match.some((term) => normalized.includes(normalizeText(term))));
  const baseOptions = group?.options ?? FALLBACK_OPTIONS;

  return baseOptions
    .filter((option) => normalizeText(option.name) !== normalized)
    .map((option) => ({
      ...option,
      focus: group?.focus ?? 'mesmo grupo muscular',
      selectedReason,
      safetyNote: buildSafetyNote(selectedReason),
    }));
}

export function getReplacementSummary(exerciseName) {
  const normalized = normalizeText(exerciseName);
  const group = LIBRARY.find((item) => item.match.some((term) => normalized.includes(normalizeText(term))));
  return group?.focus ?? 'mesmo grupo muscular';
}

export function getReasonLabel(reasonId) {
  return REASONS.find((reason) => reason.id === reasonId)?.label ?? 'Substituição';
}

function buildSafetyNote(reasonId) {
  if (reasonId === 'dont_know') return 'Escolha a opção mais simples e controle a carga.';
  if (reasonId === 'discomfort') return 'Se doer de verdade, pare e não force.';
  if (reasonId === 'crowded') return 'Escolha a opção disponível sem mudar o foco do treino.';
  return 'Mantenha reps e RPE parecidos.';
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
