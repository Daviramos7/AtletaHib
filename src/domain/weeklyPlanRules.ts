// Regras da semana de treino. Fonte única para fila, UI e análise semanal.

/** Meta base: 3 treinos por semana. */
export const WEEKLY_STRENGTH_BASE_TARGET = 3;
/** Semana com 2 treinos (prova, doença, viagem, pouco sono) é válida e não é atraso. */
export const WEEKLY_STRENGTH_MIN_VALID = 2;

/** Teto da sessão inteira (força + cardio). */
export const SESSION_MAX_MINUTES = 90;
export const SESSION_MIN_MINUTES = 20;
/** Usado só quando não há check-in nem duração-alvo no plano. */
export const SESSION_FALLBACK_MINUTES = 45;

export type WeekState = 'in_progress' | 'valid' | 'complete';

/**
 * Estado da semana corrente. Não existe "atrasado": treino perdido não é compensado
 * nem empilhado, e cada semana começa sem dívida.
 */
export function weekStateFor(completedBaseCount: number, targetCount: number): WeekState {
  const target = Math.max(0, targetCount);
  const minimum = Math.min(WEEKLY_STRENGTH_MIN_VALID, target);
  if (target > 0 && completedBaseCount >= target) return 'complete';
  if (target > 0 && completedBaseCount >= minimum) return 'valid';
  return 'in_progress';
}

export function clampSessionMinutes(value: number) {
  if (!Number.isFinite(value)) return SESSION_FALLBACK_MINUTES;
  return Math.min(Math.max(Math.round(value), SESSION_MIN_MINUTES), SESSION_MAX_MINUTES);
}
