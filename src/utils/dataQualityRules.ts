export function getLocalDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function sameLocalDate(value, expectedDate) {
  return getLocalDateKey(value) === expectedDate;
}

export function belongsToTodayByField(row, fieldName, todayKey) {
  const value = row?.[fieldName];
  if (!value) return false;
  return String(value).slice(0, 10) === todayKey || sameLocalDate(value, todayKey);
}

export function buildDataQualityWarnings(payload: any = {}) {
  const {
    todayKey = getLocalDateKey(),
    meals = [],
    cardios = [],
    sleeps = [],
    checkin = null,
    todayPlan = {},
  } = payload;

  const warnings: any[] = [];

  const todayMeals = meals.filter((meal) => String(meal.log_date ?? '').slice(0, 10) === todayKey);
  const todayCardios = cardios.filter((session) => belongsToTodayByField(session, 'performed_at', todayKey));
  const todaySleeps = sleeps.filter((sleep) => String(sleep.sleep_date ?? '').slice(0, 10) === todayKey);

  const mealsMissingMacros = todayMeals.filter((meal) => meal.protein_g === null || meal.protein_g === undefined || meal.carbs_g === null || meal.carbs_g === undefined || meal.fat_g === null || meal.fat_g === undefined);
  const mealsSuspiciousPortion = todayMeals.filter((meal) => Number(meal.grams || 0) <= 0);
  const cardiosWithoutKcal = todayCardios.filter((session) => session.active_kcal === null || session.active_kcal === undefined);
  const cardioMayDuplicateWearable = todayCardios.filter((session) => Boolean(session.metrics_may_already_exist_in_health_connect));
  const cardiosOverCap = todayCardios.filter((session) => Number(session.duration_seconds || 0) > 20 * 60);
  const sleepWithOverlap = todaySleeps.filter((sleep) => Boolean(sleep.overlap_detected || sleep.corrected_from_overlapping_records));

  if (!checkin) {
    warnings.push({
      level: 'medium',
      title: 'Check-in ausente',
      message: 'A prontidão do dia fica mais fraca sem fome, energia, estresse e dor.',
    });
  }

  if (todayPlan?.cardio && !todayCardios.length) {
    warnings.push({
      level: 'medium',
      title: 'Cardio planejado ainda não registrado',
      message: 'Se você fez cardio pela Academia, finalize como cardio; se foi pelo relógio, importe o JSON.',
    });
  }

  if (todayPlan?.strength && todayPlan?.strengthEntries?.length === 0) {
    warnings.push({
      level: 'high',
      title: 'Dia de força sem exercícios',
      message: 'O plano diz que é força, mas não há exercício estruturado para executar.',
    });
  }

  if (todayMeals.length && mealsMissingMacros.length) {
    warnings.push({
      level: 'medium',
      title: 'Macros incompletos',
      message: `${mealsMissingMacros.length} item(ns) têm kcal, mas não têm todos os macros. Isso não deve virar proteína/carbo/gordura zero.`,
    });
  }

  if (mealsSuspiciousPortion.length) {
    warnings.push({
      level: 'high',
      title: 'Porção de comida suspeita',
      message: `${mealsSuspiciousPortion.length} item(ns) estão sem gramas válidas. Revise antes de confiar no total do dia.`,
    });
  }

  if (cardiosWithoutKcal.length) {
    warnings.push({
      level: 'info',
      title: 'Cardio sem kcal',
      message: `${cardiosWithoutKcal.length} sessão(ões) contam para frequência, mas não para gasto calórico detalhado.`,
    });
  }

  if (cardiosOverCap.length) {
    warnings.push({
      level: 'medium',
      title: 'Cardio passou de 20 min',
      message: `${cardiosOverCap.length} sessão(ões) passaram do teto recomendado. Salve o valor real, mas ajuste o próximo cardio para 15-20 min.`,
    });
  }

  if (cardioMayDuplicateWearable.length) {
    warnings.push({
      level: 'info',
      title: 'Kcal do cardio pode duplicar wearable',
      message: 'As kcal de prints/sessões devem ser detalhe; o total diário principal deve vir do wearable diário.',
    });
  }

  if (sleepWithOverlap.length) {
    warnings.push({
      level: 'medium',
      title: 'Sono corrigido por sobreposição',
      message: 'O app detectou sono sobreposto/corrigido. Use o sono consolidado como fonte principal.',
    });
  }

  if (!todaySleeps.length) {
    warnings.push({
      level: 'info',
      title: 'Sono de hoje não encontrado',
      message: 'Para prontidão, o ideal é importar o sono do dia do despertar.',
    });
  }

  return warnings;
}

export function summarizeQualityWarnings(warnings = []) {
  const high = warnings.filter((item: any) => item.level === 'high').length;
  const medium = warnings.filter((item: any) => item.level === 'medium').length;
  const info = warnings.filter((item: any) => item.level === 'info').length;

  if (high > 0) return { tone: 'danger', label: `${high} atenção alta`, score: Math.max(40, 100 - (high * 25) - (medium * 12) - (info * 4)) };
  if (medium > 0) return { tone: 'warning', label: `${medium} atenção média`, score: Math.max(55, 100 - (medium * 12) - (info * 4)) };
  if (info > 0) return { tone: 'neutral', label: `${info} aviso(s)`, score: Math.max(70, 100 - (info * 4)) };
  return { tone: 'good', label: 'dados consistentes', score: 100 };
}
