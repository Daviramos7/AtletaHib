import { calculateReadiness } from '../services/checkinService';

export function buildDailyReadiness(payload: any = {}) {
  const {
    checkin = null,
    sleepSessions = [],
    workoutHistory = [],
    cardioSessions = [],
    todayPlan = null,
  } = payload;

  const base = calculateReadiness(checkin);
  const sleep = pickLatestSleep(sleepSessions);
  const lastWorkout = pickLatestByDate(workoutHistory, 'performed_at');
  const lastCardio = pickLatestByDate(cardioSessions, 'performed_at');
  const today = localDateKey(new Date());
  const yesterday = shiftDate(today, -1);

  let score = Number(base.score ?? 60);
  const reasons = [];

  if (!checkin) {
    reasons.push('Sem check-in hoje. A decisão fica menos precisa.');
  }

  if (sleep) {
    const minutes = Number(sleep.duration_minutes || 0);
    const scoreSleep = Number(sleep.sleep_score || 0);

    if (minutes && minutes < 330) {
      score -= 14;
      reasons.push('Sono curto: evite forçar progressão.');
    } else if (minutes && minutes < 390) {
      score -= 8;
      reasons.push('Sono razoável: treine com controle.');
    } else if (minutes >= 420) {
      score += 4;
      reasons.push('Sono bom: recuperação favorece treino.');
    }

    if (scoreSleep && scoreSleep < 65) {
      score -= 6;
      reasons.push('Qualidade do sono baixa.');
    } else if (scoreSleep >= 80) {
      score += 3;
      reasons.push('Boa pontuação de sono.');
    }
  } else {
    reasons.push('Sem sono importado recentemente.');
  }

  if (lastWorkout && localDateKey(lastWorkout.performed_at) === yesterday && todayPlan?.strength) {
    score -= 5;
    reasons.push('Treino de força ontem: aqueça melhor e não force ego.');
  }

  if (lastCardio && localDateKey(lastCardio.performed_at) === yesterday && todayPlan?.cardio) {
    score -= 4;
    reasons.push('Cardio recente: mantenha intensidade controlada se estiver cansado.');
  }

  score = clamp(Math.round(score), 0, 100);

  const decision = buildDecision(score, todayPlan);
  const flags = buildFlags({ checkin, sleep, todayPlan });

  return {
    score,
    label: decision.label,
    tone: decision.tone,
    headline: decision.headline,
    trainingAdvice: decision.trainingAdvice,
    cardioAdvice: decision.cardioAdvice,
    foodAdvice: decision.foodAdvice,
    reasons: reasons.slice(0, 4),
    flags,
    sleep,
    lastWorkout,
    lastCardio,
  };
}

function buildDecision(score, todayPlan) {
  const hasStrength = Boolean(todayPlan?.strength);
  const hasCardio = Boolean(todayPlan?.cardio);

  if (score >= 80) {
    return {
      tone: 'good',
      label: 'Boa',
      headline: 'Pode seguir o plano.',
      trainingAdvice: hasStrength ? 'Treino normal. Pode tentar progressão pequena se a execução estiver limpa.' : 'Sem força pesada planejada.',
      cardioAdvice: hasCardio ? 'Cardio normal. Evite transformar treino leve em tiro máximo.' : 'Cardio não é obrigatório hoje.',
      foodAdvice: 'Mantenha água e proteína. Não complica.',
    };
  }

  if (score >= 60) {
    return {
      tone: 'warning',
      label: 'Média',
      headline: 'Treine, mas sem inventar moda.',
      trainingAdvice: hasStrength ? 'Mantenha carga ou suba só se estiver muito fácil. Reduza 1 série se estiver pesado.' : 'Força não é prioridade hoje.',
      cardioAdvice: hasCardio ? 'Prefira zona 2, caminhada/trote ou futebol controlado. Sem tiro forte.' : 'Se fizer cardio extra, faça leve.',
      foodAdvice: 'Coma normal. Fome alta pede refeição planejada, não belisco aleatório.',
    };
  }

  return {
    tone: 'danger',
    label: 'Baixa',
    headline: 'Recuperação primeiro.',
    trainingAdvice: hasStrength ? 'Faça treino técnico leve ou reduza carga/volume. Sem recorde hoje.' : 'Evite esforço pesado.',
    cardioAdvice: hasCardio ? 'Troque intervalado por caminhada, bike leve ou descanso.' : 'Caminhada leve só se ajudar a relaxar.',
    foodAdvice: 'Priorize água, refeição simples e sono. Não compense com restrição.',
  };
}

function buildFlags({ checkin, sleep, todayPlan }) {
  const flags = [];

  if (todayPlan?.strength) flags.push('Força');
  if (todayPlan?.cardio) flags.push('Cardio');
  if (!todayPlan?.strength && !todayPlan?.cardio) flags.push('Recuperação');

  if (checkin?.pain_level >= 7) flags.push('Dor alta');
  else if (checkin?.pain_level >= 4) flags.push('Dor moderada');

  if (checkin?.energy_score && checkin.energy_score <= 3) flags.push('Energia baixa');
  if (checkin?.stress_score >= 7) flags.push('Estresse alto');

  if (sleep?.duration_minutes) {
    const hours = Number(sleep.duration_minutes) / 60;
    flags.push(`${hours.toFixed(1)}h sono`);
  }

  return flags.slice(0, 5);
}

function pickLatestSleep(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  return [...list].sort((a, b) => {
    const aTime = new Date(a.sleep_end_at || a.sleep_date || a.created_at || 0).getTime();
    const bTime = new Date(b.sleep_end_at || b.sleep_date || b.created_at || 0).getTime();
    return bTime - aTime;
  })[0] ?? null;
}

function pickLatestByDate(rows, field) {
  const list = Array.isArray(rows) ? rows : [];
  return [...list].sort((a, b) => new Date(b[field] || 0).getTime() - new Date(a[field] || 0).getTime())[0] ?? null;
}

function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftDate(dateKey, days) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
