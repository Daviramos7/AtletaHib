const WEEK_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function normalizeTrainingDays(rawDays = []) {
  return [...rawDays]
    .map((day, index) => ({
      ...day,
      weekdayNumber: normalizeWeekday(day, index),
      dayKind: resolveDayKind(day),
      exercise_entries: [...(day.exercise_entries ?? [])].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0)),
    }))
    .sort((a, b) => {
      const weekdayDiff = Number(a.weekdayNumber ?? 0) - Number(b.weekdayNumber ?? 0);
      if (weekdayDiff !== 0) return weekdayDiff;
      return Number(a.position ?? 0) - Number(b.position ?? 0);
    });
}

export function normalizeWeekday(day, fallbackIndex = 0) {
  const rawValue = day?.weekday ?? day?.weekday_number ?? day?.weekdayNumber ?? day?.day_of_week ?? day?.dayOfWeek;
  const numeric = Number(rawValue);

  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) return numeric;
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 7) return numeric === 7 ? 0 : numeric;

  const raw = normalizeText([rawValue, day?.title, day?.type, day?.notes].join(' '));
  const rules = [
    { value: 0, terms: ['domingo', 'dom'] },
    { value: 1, terms: ['segunda', 'segunda feira', 'seg'] },
    { value: 2, terms: ['terca', 'terca feira', 'ter'] },
    { value: 3, terms: ['quarta', 'quarta feira', 'qua'] },
    { value: 4, terms: ['quinta', 'quinta feira', 'qui'] },
    { value: 5, terms: ['sexta', 'sexta feira', 'sex'] },
    { value: 6, terms: ['sabado', 'sab'] },
  ];

  const matched = rules.find((rule) => rule.terms.some((term) => raw.includes(term)));
  if (matched) return matched.value;
  return Math.max(0, Math.min(6, fallbackIndex));
}

export function resolveDayKind(day) {
  const explicit = normalizeKind(day?.day_kind ?? day?.dayKind);
  if (explicit) return explicit;

  const rawType = normalizeText(day?.type ?? '');
  if (['forca_corrida', 'forca_z2', 'strength_cardio'].includes(rawType)) return 'strength_cardio';
  if (['corrida', 'futebol', 'cardio_leve', 'cardio'].includes(rawType)) return 'cardio';
  if (['descanso', 'rest', 'recovery'].includes(rawType)) return 'rest';
  return 'strength';
}

export function isStrengthDay(day) {
  const kind = resolveDayKind(day);
  return kind === 'strength' || kind === 'strength_cardio';
}

export function isCardioDay(day) {
  const kind = resolveDayKind(day);
  return kind === 'cardio' || kind === 'strength_cardio';
}

export function isRestDay(day) {
  return resolveDayKind(day) === 'rest';
}

export function getDayKindLabel(kind) {
  return ({
    strength: 'Força',
    cardio: 'Cardio',
    strength_cardio: 'Força + cardio',
    rest: 'Descanso',
  })[kind] ?? 'Força';
}

export function getWeekdayLabel(value) {
  return WEEK_LABELS[Number(value)] ?? 'Dia';
}

export function getCardioOptions(day) {
  if (!day) return [];

  const explicit = Array.isArray(day.cardio_options)
    ? day.cardio_options
    : typeof day.cardio_options === 'string'
      ? safeJson(day.cardio_options, [])
      : [];

  if (explicit.length) {
    return explicit.map((option) => ({
      label: option.label ?? option.name ?? 'Cardio',
      description: option.description ?? option.notes ?? 'Cardio planejado.',
    }));
  }

  const entries = day.exercise_entries ?? [];
  const cardioEntries = entries
    .filter((entry) => resolveExerciseKind(entry) === 'cardio')
    .map((entry) => ({
      label: entry.exercise_name ?? 'Cardio',
      description: [entry.sets, entry.reps, entry.notes].filter(Boolean).join(' · ') || 'Cardio planejado.',
    }));

  if (cardioEntries.length) return cardioEntries;

  if (isCardioDay(day)) return [{ label: day.title ?? 'Cardio', description: day.notes ?? 'Faça de forma controlada.' }];
  return [];
}

export function getStrengthEntries(day) {
  if (!day) return [];
  return (day.exercise_entries ?? []).filter((entry) => resolveExerciseKind(entry) !== 'cardio');
}

export function resolveExerciseKind(entry) {
  const text = normalizeText([entry?.exercise_name, entry?.notes, entry?.reps].join(' '));
  const cardioTerms = ['cardio', 'corrida', 'caminhada', 'trote', 'futebol', 'esteira', 'bike', 'bicicleta', 'escada', 'eliptico'];
  const strengthTerms = ['leg press', 'supino', 'remada', 'puxada', 'cadeira', 'mesa', 'flexora', 'extensora', 'stiff', 'agachamento', 'levantamento', 'terra', 'rosca', 'triceps', 'biceps', 'desenvolvimento', 'elevacao', 'panturrilha', 'abdominal', 'crucifixo', 'voador', 'gluteo', 'abdutora', 'adutora', 'maquina', 'halter', 'halteres', 'polia'];

  const hasCardio = cardioTerms.some((term) => text.includes(term));
  const hasStrength = strengthTerms.some((term) => text.includes(term));
  if (hasCardio && !hasStrength) return 'cardio';
  return 'strength';
}

export function buildTodayPlan(trainingPlan) {
  const days = normalizeTrainingDays(trainingPlan?.training_days ?? []);
  const weekday = new Date().getDay();
  const todayDay = days.find((day) => day.weekdayNumber === weekday) ?? null;

  if (!todayDay) {
    return {
      day: null,
      dayKind: 'rest',
      strength: false,
      cardio: false,
      title: 'Sem plano para hoje',
      action: 'Organizar rotina',
      description: 'Nenhum treino configurado para hoje.',
      cardioOptions: [],
      strengthEntries: [],
    };
  }

  const dayKind = resolveDayKind(todayDay);
  const strengthEntries = getStrengthEntries(todayDay);
  const cardioOptions = getCardioOptions(todayDay);

  return {
    day: todayDay,
    dayKind,
    strength: dayKind === 'strength' || dayKind === 'strength_cardio',
    cardio: dayKind === 'cardio' || dayKind === 'strength_cardio',
    title: todayDay.title ?? getDayKindLabel(dayKind),
    action: actionForKind(dayKind),
    description: descriptionForKind(dayKind),
    cardioOptions,
    strengthEntries,
  };
}

function normalizeKind(value) {
  const raw = normalizeText(value);
  if (!raw) return null;
  if (['strength', 'forca'].includes(raw)) return 'strength';
  if (['cardio', 'corrida', 'futebol', 'cardio_leve'].includes(raw)) return 'cardio';
  if (['strength_cardio', 'forca_corrida', 'forca_z2', 'forca cardio', 'treino cardio'].includes(raw)) return 'strength_cardio';
  if (['rest', 'descanso', 'recovery'].includes(raw)) return 'rest';
  return null;
}

function actionForKind(kind) {
  return ({ strength: 'Iniciar treino', cardio: 'Iniciar cardio', strength_cardio: 'Iniciar treino', rest: 'Descansar' })[kind] ?? 'Iniciar';
}

function descriptionForKind(kind) {
  return ({ strength: 'Hoje é só força.', cardio: 'Hoje é cardio.', strength_cardio: 'Força primeiro. Cardio depois.', rest: 'Hoje é recuperação.' })[kind] ?? 'Plano do dia.';
}

function safeJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function normalizeText(value) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
