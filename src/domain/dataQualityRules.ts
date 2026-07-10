import type { DailyTruthRaw, DailyWarning } from './dailyTypes';
import { CARDIO_RECOMMENDED_CAP_SECONDS } from './cardioRules';

export function buildDailyWarnings(raw: DailyTruthRaw, nutrition: any, sleep: any): DailyWarning[] {
  const warnings: DailyWarning[] = [];
  if (!raw.meals.length) warnings.push({ code: 'meals_missing', level: 'info', title: 'Comida não registrada', message: 'Sem refeições, o total alimentar do dia está ausente — não é zero.' });
  if (raw.meals.length && !nutrition.macrosComplete) warnings.push({ code: 'macros_incomplete', level: 'medium', title: 'Macros incompletos', message: 'O total conhecido não representa macros realmente iguais a zero.' });
  if (sleep.value === null) warnings.push({ code: 'sleep_missing', level: 'info', title: 'Sono ausente', message: 'Não há dados suficientes para concluir como foi a recuperação pelo sono.' });
  if (raw.cardio.some((row) => Number(row.duration_seconds) > CARDIO_RECOMMENDED_CAP_SECONDS)) warnings.push({ code: 'cardio_over_cap', level: 'medium', title: 'Cardio acima de 20 min', message: 'O valor real foi preservado, mas não deve virar uma nova meta.' });
  if (raw.cardio.some((row) => row.active_kcal != null)) warnings.push({ code: 'cardio_kcal_detail', level: 'info', title: 'Kcal de sessão são detalhe', message: 'Essas kcal não entram no total diário para evitar duplicidade com Health Connect.' });
  if (raw.wearableDaily.length > 1) warnings.push({ code: 'wearable_multiple_sources', level: 'info', title: 'Múltiplas fontes wearable', message: 'Cada métrica foi escolhida com sua fonte explícita; os valores não foram somados.' });
  return warnings;
}

export function scoreDailyQuality(warnings: DailyWarning[]) {
  const score = warnings.reduce((value, warning) => value - (warning.level === 'high' ? 25 : warning.level === 'medium' ? 12 : 4), 100);
  return Math.max(0, score);
}
