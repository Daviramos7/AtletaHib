import { calculateReadiness, type ReadinessLevel } from '../domain/readiness';
import { buildAdaptiveWorkoutRecommendation } from '../domain/adaptiveWorkout';

export function buildDailyReadiness(payload: any = {}) {
  const {
    checkin = null,
    sleepSessions = [],
    workoutHistory = [],
    cardioSessions = [],
    todayPlan = null,
    now = new Date(),
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
    completedSets = [],
    baseExercises = null,
  } = payload;

  const adaptive = Array.isArray(baseExercises) ? buildAdaptiveWorkoutRecommendation({
    checkin,
    sleepSessions,
    completedSets,
    baseExercises,
    cardioPlanned: Boolean(todayPlan?.cardio),
    now,
    timeZone,
  }) : null;
  const canonical = calculateReadiness({ checkin, sleepSessions, now, timeZone });
  const readiness = adaptive?.checkinValid ? {
    ...canonical,
    score: adaptive.readinessScore ?? canonical.score,
    level: adaptive.readinessLevel as ReadinessLevel,
    reasons: adaptive.reasons,
    warnings: adaptive.warnings,
    relevantSignals: { ...canonical.relevantSignals, sleep: adaptive.sleep },
    label: labelForLevel(adaptive.readinessLevel as ReadinessLevel),
    tone: toneForLevel(adaptive.readinessLevel as ReadinessLevel),
  } : canonical;
  const lastWorkout = pickLatestByDate(workoutHistory, 'performed_at');
  const lastCardio = pickLatestByDate(cardioSessions, 'performed_at');
  const decision = buildDecision(readiness.level, todayPlan);
  const sleep = readiness.relevantSignals.sleep.hours === null ? null : readiness.relevantSignals.sleep;

  return {
    score: readiness.score,
    level: readiness.level,
    label: readiness.label,
    tone: readiness.tone,
    headline: decision.headline,
    trainingAdvice: decision.trainingAdvice,
    cardioAdvice: decision.cardioAdvice,
    foodAdvice: decision.foodAdvice,
    reasons: readiness.reasons.slice(0, 4),
    flags: buildFlags({ checkin, sleep, todayPlan }),
    sleep,
    lastWorkout,
    lastCardio,
  };
}

function labelForLevel(level: ReadinessLevel) {
  if (level === 'recuperacao') return 'Recuperação';
  if (level === 'baixa') return 'Baixa';
  if (level === 'moderada') return 'Moderada';
  return 'Boa';
}

function toneForLevel(level: ReadinessLevel) {
  if (level === 'boa') return 'good' as const;
  if (level === 'moderada') return 'warning' as const;
  return 'danger' as const;
}

function buildDecision(level: ReadinessLevel, todayPlan: any) {
  const hasStrength = Boolean(todayPlan?.strength);
  const hasCardio = Boolean(todayPlan?.cardio);

  if (level === 'boa') {
    return {
      headline: 'Pode seguir o plano.',
      trainingAdvice: hasStrength ? 'Treino normal. Progressão pequena somente com execução limpa.' : 'Sem força pesada planejada.',
      cardioAdvice: hasCardio ? 'Cardio leve a moderado, RPE 5–6.' : 'Cardio não é obrigatório hoje.',
      foodAdvice: 'Mantenha água e proteína; cardio não compensa alimentação.',
    };
  }

  if (level === 'moderada') {
    return {
      headline: 'Treine com controle.',
      trainingAdvice: hasStrength ? 'Mantenha cargas e aceite a redução de acessórios.' : 'Força não é prioridade hoje.',
      cardioAdvice: hasCardio ? 'Cardio curto e conversável.' : 'Se fizer cardio extra, mantenha leve.',
      foodAdvice: 'Mantenha refeições e hidratação normais.',
    };
  }

  if (level === 'baixa') {
    return {
      headline: 'Reduza volume e intensidade.',
      trainingAdvice: hasStrength ? 'Treino reduzido, longe da falha e sem progressão de carga.' : 'Evite força pesada.',
      cardioAdvice: hasCardio ? 'Até 5 minutos leves, se fizer sentido.' : 'Caminhada leve é opcional.',
      foodAdvice: 'Priorize água e refeições simples; não compense com restrição.',
    };
  }

  return {
    headline: 'Recuperação primeiro.',
    trainingAdvice: hasStrength ? 'Faça somente a versão técnica recomendada e pare se a dor piorar.' : 'Evite esforço pesado.',
    cardioAdvice: 'Cardio pode ser retirado hoje.',
    foodAdvice: 'Priorize água, refeição simples e sono.',
  };
}

function buildFlags({ checkin, sleep, todayPlan }) {
  const flags = [];
  if (todayPlan?.strength) flags.push('Força');
  if (todayPlan?.cardio) flags.push('Cardio');
  if (!todayPlan?.strength && !todayPlan?.cardio) flags.push('Recuperação');
  if (Number(checkin?.pain_level) >= 7) flags.push('Dor alta');
  else if (Number(checkin?.pain_level) >= 4) flags.push('Dor moderada');
  if (Number(checkin?.energy_score) > 0 && Number(checkin.energy_score) <= 3) flags.push('Energia baixa');
  if (Number(checkin?.stress_score) >= 8) flags.push('Estresse alto');
  if (sleep?.hours) flags.push(`${Number(sleep.hours).toFixed(1)}h sono`);
  return flags.slice(0, 5);
}

function pickLatestByDate(rows, field) {
  const list = Array.isArray(rows) ? rows : [];
  return [...list].sort((a, b) => new Date(b[field] || 0).getTime() - new Date(a[field] || 0).getTime())[0] ?? null;
}
