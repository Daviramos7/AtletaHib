import {
  formatMuscleGroup,
  getExerciseMetadata,
  resolveExerciseRole,
  type ExerciseRole,
  type MuscleGroup,
} from './exerciseCatalog';
import {
  calculateReadiness,
  dateKeyInTimeZone as readinessDateKeyInTimeZone,
  type ReadinessCheckin,
  type ReadinessLevel,
  type ReadinessSleepRow,
} from './readiness';

export interface AdaptiveBaseExercise {
  id?: string | number | null;
  exercise_name?: string | null;
  sets?: string | number | null;
  reps?: string | number | null;
  rest_seconds?: number | null;
  position?: number | null;
  exercise_role?: ExerciseRole | string | null;
  [key: string]: unknown;
}

export interface CompletedStrengthSet {
  exercise_name?: string | null;
  reps?: number | string | null;
  load_kg?: number | string | null;
  perceived_effort?: number | string | null;
  performed_at?: string | null;
}

export interface AdaptiveCheckin extends ReadinessCheckin {
  log_date?: string | null;
  muscle_soreness_locations?: string[] | null;
  available_minutes?: number | string | null;
  morning_saved_at?: string | null;
  evening_saved_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SleepSignalRow extends ReadinessSleepRow {}

export interface MuscleLoad {
  last48h: number;
  last72h: number;
  last7d: number;
  latestAt: string | null;
}

export interface AdaptedExercise {
  exercise: AdaptiveBaseExercise;
  role: ExerciseRole;
  baseSets: number;
  targetSets: number;
  action: 'keep' | 'reduce' | 'skip';
  reason: string | null;
}

export interface SessionEstimate {
  strength: number;
  cardio: number;
  total: number;
  label: string;
}

export interface AdaptiveWorkoutRecommendation {
  checkinValid: boolean;
  readinessLevel: ReadinessLevel | 'aguardando_checkin';
  readinessScore: number | null;
  reasons: string[];
  recommendations: string[];
  volumeAdjustment: 'normal' | 'reduzido' | 'muito_reduzido';
  intensityGuidance: string;
  cardioGuidance: { minutes: number; intensity: string; text: string };
  warnings: string[];
  adaptedExercises: AdaptedExercise[];
  estimatedMinutes: SessionEstimate;
  effectiveAvailableMinutes: number;
  timeConstraintSatisfied: boolean;
  workoutMode: 'normal' | 'retorno';
  recommendedVariant: 'base' | 'adapted';
  progressionAllowed: boolean;
  recentMuscleLoad: Partial<Record<MuscleGroup, MuscleLoad>>;
  sleep: { hours: number | null; qualityScore: number | null; source: 'corrected_session' | 'sleep_session' | 'checkin' | 'missing' };
}

export interface AdaptiveWorkoutInput {
  checkin?: AdaptiveCheckin | null;
  sleepSessions?: SleepSignalRow[];
  completedSets?: CompletedStrengthSet[];
  baseExercises?: AdaptiveBaseExercise[];
  cardioPlanned?: boolean;
  now?: Date | string | number;
  timeZone?: string;
}

const MUSCLE_LOCATION_MAP: Record<string, MuscleGroup[]> = {
  quadriceps: ['quadriceps'],
  posterior_de_coxa: ['posterior_de_coxa'],
  gluteos: ['gluteos'],
  peito: ['peito'],
  costas: ['dorsais', 'costas_superiores'],
  ombros: ['ombros'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  panturrilhas: ['panturrilhas'],
  core: ['core'],
};

const SETUP_MARGIN_MINUTES = 5;
const TRANSITION_MINUTES = 1;

export function buildAdaptiveWorkoutRecommendation(input: AdaptiveWorkoutInput): AdaptiveWorkoutRecommendation {
  const now = toDate(input.now ?? new Date());
  const timeZone = input.timeZone ?? resolvedTimeZone();
  const today = dateKeyInTimeZone(now, timeZone);
  const baseExercises = cloneExercises(input.baseExercises ?? []);
  const checkin = input.checkin ?? null;
  const recentMuscleLoad = calculateRecentMuscleLoad(input.completedSets ?? [], now);
  const baseAdapted = baseExercises.map(toAdaptedExercise);
  const effectiveAvailableMinutes = clamp(toOptionalNumber(checkin?.available_minutes) ?? 45, 20, 50);

  if (!isValidMorningCheckin(checkin, today)) {
    const estimates = estimateWorkoutSession(baseAdapted, input.cardioPlanned ? 10 : 0);
    return {
      checkinValid: false,
      readinessLevel: 'aguardando_checkin',
      readinessScore: null,
      reasons: ['O check-in da manhã de hoje ainda não foi concluído.'],
      recommendations: ['Faça o check-in para gerar uma recomendação adaptativa ou escolha explicitamente o treino-base.'],
      volumeAdjustment: 'normal',
      intensityGuidance: 'Sem recomendação adaptativa até o check-in.',
      cardioGuidance: { minutes: 0, intensity: 'não calculado', text: 'Cardio será calculado após o check-in.' },
      warnings: [],
      adaptedExercises: baseAdapted,
      estimatedMinutes: estimates,
      effectiveAvailableMinutes,
      timeConstraintSatisfied: estimates.total <= effectiveAvailableMinutes,
      workoutMode: 'normal',
      recommendedVariant: 'base',
      progressionAllowed: false,
      recentMuscleLoad,
      sleep: { hours: null, qualityScore: null, source: 'missing' },
    };
  }

  const currentMuscles = uniqueMuscles(baseExercises);
  const workload = summarizeOverlap(currentMuscles, recentMuscleLoad);
  const returnGapDays = calculateReturnGapDays(input.completedSets ?? [], now);
  const workoutMode = returnGapDays !== null && returnGapDays >= 7 ? 'retorno' : 'normal';
  const readiness = calculateReadiness({
    checkin,
    sleepSessions: input.sleepSessions,
    now,
    timeZone,
    workload: {
      high48h: workload.high48h.map(formatMuscleGroup),
      moderate72h: workload.moderate72h.map(formatMuscleGroup),
      high7d: workload.high7d.map(formatMuscleGroup),
    },
    returnGapDays,
  });

  let adaptedExercises = adaptExercises({
    baseExercises,
    readinessLevel: readiness.level,
    checkin,
    recentMuscleLoad,
    workoutMode,
  });
  const initialCardioMinutes = recommendedCardioMinutes(readiness.level, Boolean(input.cardioPlanned), effectiveAvailableMinutes, workoutMode);
  const fitted = fitWorkoutToTime(adaptedExercises, initialCardioMinutes, effectiveAvailableMinutes);
  adaptedExercises = fitted.exercises;

  const adaptations = describeAdaptations(adaptedExercises, baseExercises, fitted.cardioMinutes, Boolean(input.cardioPlanned));
  const volumeReduced = adaptedExercises.some((item) => item.targetSets < item.baseSets);
  const progressionAllowed = readiness.level === 'boa' && workoutMode === 'normal' && !volumeReduced;
  const recommendedVariant = adaptations.length > 0 || workoutMode === 'retorno' || readiness.level !== 'boa' ? 'adapted' : 'base';

  return {
    checkinValid: true,
    readinessLevel: readiness.level,
    readinessScore: readiness.score,
    reasons: readiness.reasons.slice(0, 6),
    recommendations: adaptations.length > 0 ? adaptations : ['Treino-base completo, com progressão gradual apenas se a execução estiver limpa.'],
    volumeAdjustment: volumeAdjustmentForLevel(readiness.level, workoutMode),
    intensityGuidance: intensityForLevel(readiness.level, workoutMode),
    cardioGuidance: buildCardioGuidance(fitted.cardioMinutes, readiness.level, Boolean(input.cardioPlanned)),
    warnings: readiness.warnings,
    adaptedExercises,
    estimatedMinutes: fitted.estimate,
    effectiveAvailableMinutes,
    timeConstraintSatisfied: fitted.estimate.total <= effectiveAvailableMinutes,
    workoutMode,
    recommendedVariant,
    progressionAllowed,
    recentMuscleLoad,
    sleep: readiness.relevantSignals.sleep,
  };
}

export function isValidMorningCheckin(checkin: AdaptiveCheckin | null | undefined, todayKey: string) {
  if (!checkin || String(checkin.log_date ?? '').slice(0, 10) !== todayKey) return false;
  if (checkin.morning_saved_at) return hasMorningSignal(checkin);
  if (checkin.evening_saved_at) return false;
  return hasMorningSignal(checkin);
}

export function calculateRecentMuscleLoad(sets: CompletedStrengthSet[], nowInput: Date | string | number = new Date()) {
  const now = toDate(nowInput);
  const result: Partial<Record<MuscleGroup, MuscleLoad>> = {};

  for (const set of sets) {
    const reps = toOptionalNumber(set.reps);
    const performedAt = toDate(set.performed_at ?? '');
    const ageHours = (now.getTime() - performedAt.getTime()) / 3_600_000;
    if (!reps || reps <= 0 || Number.isNaN(performedAt.getTime()) || ageHours < 0 || ageHours > 168) continue;

    const metadata = getExerciseMetadata(set.exercise_name);
    const rpe = toOptionalNumber(set.perceived_effort);
    const effortWeight = rpe !== null && rpe >= 9 ? 1.5 : rpe !== null && rpe >= 8 ? 1.25 : rpe !== null && rpe <= 5 ? 0.75 : 1;
    const repWeight = reps <= 5 ? 0.85 : reps <= 12 ? 1 : reps <= 20 ? 1.1 : 1.2;
    const exposure = effortWeight * repWeight;
    addMusclePoints(result, metadata.primaryMuscles, ageHours, exposure, set.performed_at ?? null);
    addMusclePoints(result, metadata.secondaryMuscles, ageHours, exposure * 0.35, set.performed_at ?? null);
  }

  return result;
}

export function selectWorkoutVariant(baseExercises: AdaptiveBaseExercise[], recommendation: AdaptiveWorkoutRecommendation, variant: 'base' | 'adapted') {
  if (variant === 'base') return cloneExercises(baseExercises).map(toAdaptedExercise);
  return recommendation.adaptedExercises.map((item) => ({ ...item, exercise: { ...item.exercise } }));
}

export function dateKeyInTimeZone(value: Date | string | number, timeZone: string) {
  return readinessDateKeyInTimeZone(value, timeZone);
}

export function estimateWorkoutSession(exercises: AdaptedExercise[], cardioMinutes: number): SessionEstimate {
  const active = exercises.filter((item) => item.targetSets > 0);
  const exerciseMinutes = active.reduce((total, item) => {
    const metadata = getExerciseMetadata(item.exercise.exercise_name);
    const activeMinutes = metadata.estimatedActiveSecondsPerSet * item.targetSets / 60;
    const restSeconds = normalizedRestSeconds(item.exercise.rest_seconds, item.role);
    const restMinutes = restSeconds * Math.max(item.targetSets - 1, 0) / 60;
    return total + activeMinutes + restMinutes;
  }, 0);
  const operationalMinutes = active.length > 0 ? SETUP_MARGIN_MINUTES + Math.max(active.length - 1, 0) * TRANSITION_MINUTES : 0;
  const strength = Math.round(exerciseMinutes + operationalMinutes);
  const cardio = clamp(Math.round(cardioMinutes), 0, 20);
  const total = strength + cardio;
  const rounded = total > 0 ? Math.max(5, Math.round(total / 5) * 5) : 0;
  return { strength, cardio, total, label: `~${rounded} min` };
}

function adaptExercises(input: {
  baseExercises: AdaptiveBaseExercise[];
  readinessLevel: ReadinessLevel;
  checkin: AdaptiveCheckin | null;
  recentMuscleLoad: Partial<Record<MuscleGroup, MuscleLoad>>;
  workoutMode: 'normal' | 'retorno';
}) {
  const jointPain = toOptionalNumber(input.checkin?.pain_level);
  const soreness = toOptionalNumber(input.checkin?.soreness_level);
  const painfulJoints = new Set(asStringArray(input.checkin?.joint_pain_locations));
  const soreMuscles = new Set(asStringArray(input.checkin?.muscle_soreness_locations).flatMap((location) => MUSCLE_LOCATION_MAP[location] ?? []));

  return input.baseExercises.map((exercise) => {
    const base = toAdaptedExercise(exercise);
    const metadata = getExerciseMetadata(exercise.exercise_name);
    const role = base.role;
    let targetSets = base.baseSets;
    const reasons: string[] = [];

    if (input.readinessLevel === 'moderada' && role === 'accessory' && targetSets > 1) {
      targetSets -= 1;
      reasons.push('volume acessório reduzido');
    } else if (input.readinessLevel === 'baixa') {
      targetSets = role === 'accessory' ? Math.min(targetSets, 1) : Math.min(targetSets, 2);
      reasons.push('prontidão baixa');
    } else if (input.readinessLevel === 'recuperacao') {
      targetSets = role === 'accessory' ? 0 : Math.min(targetSets, 1);
      reasons.push('sessão técnica de recuperação');
    }

    if (input.workoutMode === 'retorno') {
      targetSets = role === 'main' ? Math.min(targetSets, 2) : Math.min(targetSets, 1);
      reasons.push('retorno após pausa');
    }

    const high48 = metadata.primaryMuscles.some((muscle) => (input.recentMuscleLoad[muscle]?.last48h ?? 0) >= 5);
    const moderate72 = !high48 && metadata.primaryMuscles.some((muscle) => (input.recentMuscleLoad[muscle]?.last72h ?? 0) >= 4);
    const high7d = !high48 && !moderate72 && metadata.primaryMuscles.some((muscle) => (input.recentMuscleLoad[muscle]?.last7d ?? 0) >= 14);
    if (high48 && targetSets > 1) {
      targetSets -= 1;
      reasons.push('músculo com carga alta nas últimas 48h');
    } else if (moderate72 && role !== 'main' && targetSets > 1) {
      targetSets -= 1;
      reasons.push('músculo ainda carregado nas últimas 72h');
    } else if (high7d && targetSets > 1) {
      targetSets -= 1;
      reasons.push('volume muscular alto nos últimos 7 dias');
    }

    const overlapsJointPain = metadata.jointLocations.some((joint) => painfulJoints.has(joint));
    if (overlapsJointPain && jointPain !== null && jointPain >= 7) {
      targetSets = 0;
      reasons.push('movimento incompatível com dor articular alta informada');
    } else if (overlapsJointPain && jointPain !== null && jointPain >= 4) {
      targetSets = Math.min(targetSets, 1);
      reasons.push('dor articular localizada');
    }

    const overlapsSoreness = metadata.primaryMuscles.some((muscle) => soreMuscles.has(muscle));
    if (overlapsSoreness && soreness !== null && soreness >= 7) {
      targetSets = Math.min(targetSets, 1);
      reasons.push('dor muscular localizada');
    }

    targetSets = clamp(Math.round(targetSets), 0, base.baseSets);
    return finalizeAdaptedExercise(base, targetSets, reasons);
  });
}

function fitWorkoutToTime(exercises: AdaptedExercise[], cardioInput: number, availableMinutes: number) {
  const result = exercises.map((item) => ({ ...item, exercise: { ...item.exercise } }));
  let cardioMinutes = clamp(Math.round(cardioInput), 0, 20);
  let estimate = estimateWorkoutSession(result, cardioMinutes);

  if (estimate.total > availableMinutes && cardioMinutes > 0) {
    cardioMinutes = Math.max(0, cardioMinutes - (estimate.total - availableMinutes));
    if (cardioMinutes > 0 && cardioMinutes < 5) cardioMinutes = 0;
    estimate = estimateWorkoutSession(result, cardioMinutes);
  }

  reduceSetsForTime(result, 'accessory', 1, availableMinutes, cardioMinutes);
  removeExercisesForTime(result, 'accessory', availableMinutes, cardioMinutes);
  reduceSetsForTime(result, 'secondary', 1, availableMinutes, cardioMinutes);
  reduceSetsForTime(result, 'main', 1, availableMinutes, cardioMinutes);
  removeExercisesForTime(result, 'secondary', availableMinutes, cardioMinutes);
  removeExercisesForTime(result, 'main', availableMinutes, cardioMinutes);
  estimate = estimateWorkoutSession(result, cardioMinutes);

  return { exercises: result, cardioMinutes, estimate };
}

function reduceSetsForTime(exercises: AdaptedExercise[], role: ExerciseRole, floor: number, available: number, cardio: number) {
  while (estimateWorkoutSession(exercises, cardio).total > available) {
    const candidate = [...exercises].reverse().find((item) => item.role === role && item.targetSets > floor);
    if (!candidate) break;
    candidate.targetSets -= 1;
    markTimeAdjustment(candidate);
  }
}

function removeExercisesForTime(exercises: AdaptedExercise[], role: ExerciseRole, available: number, cardio: number) {
  while (estimateWorkoutSession(exercises, cardio).total > available) {
    const activeForRole = exercises.filter((item) => item.role === role && item.targetSets > 0);
    const allActive = exercises.filter((item) => item.targetSets > 0);
    const candidate = activeForRole[activeForRole.length - 1];
    if (!candidate || (role === 'main' && allActive.length <= 1)) break;
    candidate.targetSets = 0;
    markTimeAdjustment(candidate);
  }
}

function markTimeAdjustment(item: AdaptedExercise) {
  item.action = item.targetSets === 0 ? 'skip' : 'reduce';
  item.reason = unique([item.reason, 'ajuste ao tempo disponível'].filter(Boolean) as string[]).join(' · ');
}

function describeAdaptations(adapted: AdaptedExercise[], base: AdaptiveBaseExercise[], cardioMinutes: number, cardioPlanned: boolean) {
  const reduced = adapted.filter((item) => item.action === 'reduce');
  const skipped = adapted.filter((item) => item.action === 'skip');
  const messages: string[] = [];
  if (reduced.length > 0) messages.push(`Volume reduzido em ${reduced.length} exercício(s), preservando os principais quando possível.`);
  if (skipped.length > 0) messages.push(`${skipped.length} exercício(s) removido(s) por dor, recuperação ou tempo.`);
  if (cardioPlanned && cardioMinutes > 0 && cardioMinutes < 15) messages.push(`Cardio leve limitado a ${cardioMinutes} min.`);
  if (cardioPlanned && cardioMinutes === 0) messages.push('Cardio retirado hoje para priorizar força e recuperação.');
  if (adapted.reduce((sum, item) => sum + item.targetSets, 0) < base.reduce((sum, exercise) => sum + parseSetCount(exercise.sets), 0)) {
    messages.push('Sem progressão de carga ou treino próximo da falha hoje.');
  }
  return unique(messages);
}

function recommendedCardioMinutes(level: ReadinessLevel, planned: boolean, available: number, mode: 'normal' | 'retorno') {
  if (!planned || level === 'recuperacao') return 0;
  if (level === 'baixa') return 5;
  if (level === 'moderada' || mode === 'retorno') return Math.min(8, Math.max(5, available - 35));
  return Math.min(15, Math.max(5, available - 35));
}

function buildCardioGuidance(minutes: number, level: ReadinessLevel, planned: boolean) {
  if (!planned) return { minutes: 0, intensity: 'opcional', text: 'Sem cardio obrigatório no plano-base de hoje.' };
  if (minutes <= 0) return { minutes: 0, intensity: 'recuperação', text: 'Sem cardio hoje; preserve recuperação.' };
  const intensity = level === 'boa' ? 'leve a moderado, RPE 5–6' : 'leve, ritmo conversável';
  return { minutes, intensity, text: `${minutes} min em ${intensity}. Evolua controle e qualidade, não duração.` };
}

function intensityForLevel(level: ReadinessLevel, mode: 'normal' | 'retorno') {
  if (mode === 'retorno') return 'Mantenha ou reduza cargas, RPE 6–7 e deixe 3–4 repetições na reserva.';
  if (level === 'boa') return 'Progressão pequena é permitida com técnica limpa; evite falha desnecessária.';
  if (level === 'moderada') return 'Mantenha cargas, RPE 6–7 e deixe 2–4 repetições na reserva.';
  if (level === 'baixa') return 'Reduza carga se necessário, RPE até 6 e longe da falha.';
  return 'Somente execução leve e técnica; pare se houver piora de dor ou mal-estar.';
}

function volumeAdjustmentForLevel(level: ReadinessLevel, mode: 'normal' | 'retorno'): AdaptiveWorkoutRecommendation['volumeAdjustment'] {
  if (level === 'recuperacao' || level === 'baixa') return 'muito_reduzido';
  if (level === 'moderada' || mode === 'retorno') return 'reduzido';
  return 'normal';
}

function calculateReturnGapDays(sets: CompletedStrengthSet[], now: Date) {
  const timestamps = sets
    .filter((set) => (toOptionalNumber(set.reps) ?? 0) > 0)
    .map((set) => dateValue(set.performed_at))
    .filter((value) => Number.isFinite(value) && value <= now.getTime());
  if (timestamps.length === 0) return null;
  return Math.floor((now.getTime() - Math.max(...timestamps)) / 86_400_000);
}

function summarizeOverlap(muscles: MuscleGroup[], load: Partial<Record<MuscleGroup, MuscleLoad>>) {
  return {
    high48h: muscles.filter((muscle) => (load[muscle]?.last48h ?? 0) >= 5),
    moderate72h: muscles.filter((muscle) => (load[muscle]?.last72h ?? 0) >= 4),
    high7d: muscles.filter((muscle) => (load[muscle]?.last7d ?? 0) >= 14),
  };
}

function uniqueMuscles(exercises: AdaptiveBaseExercise[]) {
  return unique(exercises.flatMap((exercise) => {
    const metadata = getExerciseMetadata(exercise.exercise_name);
    return [...metadata.primaryMuscles, ...metadata.secondaryMuscles];
  }));
}

function addMusclePoints(target: Partial<Record<MuscleGroup, MuscleLoad>>, muscles: MuscleGroup[], ageHours: number, points: number, performedAt: string | null) {
  for (const muscle of muscles) {
    const current = target[muscle] ?? { last48h: 0, last72h: 0, last7d: 0, latestAt: null };
    if (ageHours <= 48) current.last48h += points;
    if (ageHours <= 72) current.last72h += points;
    current.last7d += points;
    if (!current.latestAt || dateValue(performedAt) > dateValue(current.latestAt)) current.latestAt = performedAt;
    target[muscle] = current;
  }
}

function toAdaptedExercise(exercise: AdaptiveBaseExercise): AdaptedExercise {
  const baseSets = parseSetCount(exercise.sets);
  return { exercise: { ...exercise }, role: resolveExerciseRole(exercise), baseSets, targetSets: baseSets, action: 'keep', reason: null };
}

function finalizeAdaptedExercise(base: AdaptedExercise, targetSets: number, reasons: string[]) {
  return {
    ...base,
    targetSets,
    action: targetSets === 0 ? 'skip' as const : targetSets < base.baseSets ? 'reduce' as const : 'keep' as const,
    reason: reasons.length > 0 ? unique(reasons).join(' · ') : null,
  };
}

function normalizedRestSeconds(value: unknown, role: ExerciseRole) {
  const parsed = toOptionalNumber(value);
  if (parsed !== null && parsed >= 0) return parsed;
  if (role === 'main') return 90;
  if (role === 'secondary') return 75;
  return 60;
}

function cloneExercises(exercises: AdaptiveBaseExercise[]) {
  return exercises.map((exercise) => ({ ...exercise }));
}

function parseSetCount(value: unknown) {
  const match = String(value ?? '').match(/\d+/);
  return Math.max(match ? Number(match[0]) : 1, 1);
}

function hasMorningSignal(checkin: AdaptiveCheckin) {
  return [checkin.sleep_hours, checkin.energy_score, checkin.recovery_score, checkin.pain_level, checkin.soreness_level, checkin.stress_score]
    .some((value) => toOptionalNumber(value) !== null);
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function toOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function dateValue(value: unknown) {
  const parsed = new Date(String(value ?? '')).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function toDate(value: Date | string | number) {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

function resolvedTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

export type { ExerciseRole, ReadinessLevel };
