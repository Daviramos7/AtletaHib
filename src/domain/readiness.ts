export type ReadinessLevel = 'boa' | 'moderada' | 'baixa' | 'recuperacao';

export interface ReadinessCheckin {
  sleep_hours?: number | string | null;
  energy_score?: number | string | null;
  recovery_score?: number | string | null;
  hunger_score?: number | string | null;
  stress_score?: number | string | null;
  pain_level?: number | string | null;
  soreness_level?: number | string | null;
  joint_pain_locations?: string[] | null;
}

export interface ReadinessSleepRow {
  sleep_date?: string | null;
  sleep_end_at?: string | null;
  duration_minutes?: number | string | null;
  sleep_score?: number | string | null;
  replaces_health_connect_sleep?: boolean | null;
  corrected_from_overlapping_records?: boolean | null;
  updated_at?: string | null;
  created_at?: string | null;
}

export interface ReadinessWorkload {
  high48h?: string[];
  moderate72h?: string[];
  high7d?: string[];
}

export interface ReadinessContext {
  checkin?: ReadinessCheckin | null;
  sleepSessions?: ReadinessSleepRow[];
  now?: Date | string | number;
  timeZone?: string;
  workload?: ReadinessWorkload;
  returnGapDays?: number | null;
}

export interface ReadinessResult {
  score: number;
  level: ReadinessLevel;
  reasons: string[];
  warnings: string[];
  relevantSignals: {
    sleep: { hours: number | null; qualityScore: number | null; source: 'corrected_session' | 'sleep_session' | 'checkin' | 'missing' };
    energy: number | null;
    recovery: number | null;
    jointPain: number | null;
    muscleSoreness: number | null;
    stress: number | null;
    hunger: number | null;
    workload: { high48h: string[]; moderate72h: string[]; high7d: string[] };
    returnGapDays: number | null;
  };
  label: string;
  tone: 'good' | 'warning' | 'danger' | 'neutral';
  advice: string;
  confidence: 'low' | 'medium' | 'high';
}

export function calculateReadiness(context: ReadinessContext = {}): ReadinessResult {
  const checkin = context.checkin ?? null;
  const now = toDate(context.now ?? new Date());
  const timeZone = context.timeZone ?? resolvedTimeZone();
  const sleep = resolveReadinessSleep(checkin, context.sleepSessions ?? [], now, timeZone);
  const energy = optionalNumber(checkin?.energy_score);
  const recovery = optionalNumber(checkin?.recovery_score);
  const jointPain = optionalNumber(checkin?.pain_level);
  const muscleSoreness = optionalNumber(checkin?.soreness_level);
  const stress = optionalNumber(checkin?.stress_score);
  const hunger = optionalNumber(checkin?.hunger_score);
  const returnGapDays = optionalNumber(context.returnGapDays);
  const workload = independentWorkload(context.workload);
  const reasons: string[] = [];
  let score = checkin ? 100 : 60;

  if (!checkin) reasons.push('Sem check-in da manhã; a prontidão ainda é provisória.');

  if (sleep.hours !== null && sleep.hours < 5) { score -= 18; reasons.push(`Sono curto (${formatHours(sleep.hours)}).`); }
  else if (sleep.hours !== null && sleep.hours < 6) { score -= 12; reasons.push(`Sono abaixo do ideal (${formatHours(sleep.hours)}).`); }
  else if (sleep.hours !== null && sleep.hours < 6.5) { score -= 7; reasons.push(`Sono um pouco curto (${formatHours(sleep.hours)}).`); }
  else if (sleep.hours !== null && sleep.hours >= 7) { score += 2; reasons.push(`Duração de sono favorável (${formatHours(sleep.hours)}).`); }

  if (sleep.qualityScore !== null && sleep.qualityScore < 60) { score -= 8; reasons.push('Qualidade do sono baixa no registro corrigido.'); }
  else if (sleep.qualityScore !== null && sleep.qualityScore >= 80) score += 2;

  if (energy !== null && energy <= 3) { score -= 18; reasons.push(`Energia baixa (${energy}/10).`); }
  else if (energy !== null && energy <= 5) { score -= 9; reasons.push(`Energia moderada (${energy}/10).`); }
  else if (energy !== null && energy >= 8) score += 2;

  if (recovery !== null && recovery <= 3) { score -= 20; reasons.push(`Recuperação baixa (${recovery}/10).`); }
  else if (recovery !== null && recovery <= 5) { score -= 10; reasons.push(`Recuperação moderada (${recovery}/10).`); }
  else if (recovery !== null && recovery >= 8) score += 2;

  if (jointPain !== null && jointPain >= 7) { score -= 32; reasons.push(`Dor articular alta (${jointPain}/10).`); }
  else if (jointPain !== null && jointPain >= 4) { score -= 18; reasons.push(`Dor articular relevante (${jointPain}/10).`); }

  if (muscleSoreness !== null && muscleSoreness >= 8) { score -= 18; reasons.push(`Dor muscular alta (${muscleSoreness}/10).`); }
  else if (muscleSoreness !== null && muscleSoreness >= 5) { score -= 8; reasons.push(`Dor muscular moderada (${muscleSoreness}/10).`); }

  if (stress !== null && stress >= 8) { score -= 10; reasons.push(`Estresse alto (${stress}/10).`); }
  else if (stress !== null && stress >= 6) score -= 5;
  if (hunger !== null && hunger >= 9) score -= 3;

  if (workload.high48h.length > 0) {
    score -= 10;
    reasons.push(`Carga recente alta em ${workload.high48h.slice(0, 2).join(' e ')}.`);
  }
  if (workload.moderate72h.length > 0) {
    score -= 5;
    reasons.push(`Volume de 72h em ${workload.moderate72h.slice(0, 2).join(' e ')} pede controle.`);
  }
  if (workload.high7d.length > 0) {
    score -= 4;
    reasons.push(`Volume semanal alto em ${workload.high7d.slice(0, 2).join(' e ')}.`);
  }
  if (returnGapDays !== null && returnGapDays >= 7) {
    score -= 12;
    reasons.push(`Retorno após ${returnGapDays} dias sem séries registradas.`);
  }

  score = clamp(Math.round(score), 0, 100);
  const level = readinessLevelFor(score, jointPain);
  const knownSignals = [sleep.hours, energy, recovery, jointPain, muscleSoreness, stress, hunger].filter((value) => value !== null).length;
  const confidence = knownSignals >= 5 ? 'high' : knownSignals >= 3 ? 'medium' : 'low';
  const warnings = buildWarnings(jointPain, checkin?.joint_pain_locations, level);
  const presentation = presentationFor(level, Boolean(checkin));

  return {
    score,
    level,
    reasons,
    warnings,
    relevantSignals: { sleep, energy, recovery, jointPain, muscleSoreness, stress, hunger, workload, returnGapDays },
    ...presentation,
    confidence,
  };
}

export function readinessLevelFor(score: number, jointPain: number | null = null): ReadinessLevel {
  if (score < 45 || (jointPain !== null && jointPain >= 8)) return 'recuperacao';
  if (score < 65) return 'baixa';
  if (score < 82) return 'moderada';
  return 'boa';
}

export function dateKeyInTimeZone(value: Date | string | number, timeZone: string) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
}

function resolveReadinessSleep(checkin: ReadinessCheckin | null, sessions: ReadinessSleepRow[], now: Date, timeZone: string): ReadinessResult['relevantSignals']['sleep'] {
  const today = dateKeyInTimeZone(now, timeZone);
  const candidates = sessions
    .filter((session) => {
      const explicitDate = String(session.sleep_date ?? '').slice(0, 10);
      const awakeningDate = session.sleep_end_at ? dateKeyInTimeZone(session.sleep_end_at, timeZone) : '';
      return explicitDate === today || awakeningDate === today;
    })
    .sort((a, b) => sleepPriority(b) - sleepPriority(a) || dateValue(b.updated_at ?? b.created_at) - dateValue(a.updated_at ?? a.created_at));
  const selected = candidates[0];

  if (selected) {
    const minutes = optionalNumber(selected.duration_minutes);
    return {
      hours: minutes === null ? null : minutes / 60,
      qualityScore: optionalNumber(selected.sleep_score),
      source: selected.replaces_health_connect_sleep || selected.corrected_from_overlapping_records ? 'corrected_session' : 'sleep_session',
    };
  }

  const hours = optionalNumber(checkin?.sleep_hours);
  return { hours, qualityScore: null, source: hours === null ? 'missing' : 'checkin' };
}

function independentWorkload(value: ReadinessWorkload | undefined) {
  const high48h = uniqueStrings(value?.high48h);
  const high48Set = new Set(high48h);
  const moderate72h = uniqueStrings(value?.moderate72h).filter((muscle) => !high48Set.has(muscle));
  const recentSet = new Set([...high48h, ...moderate72h]);
  const high7d = uniqueStrings(value?.high7d).filter((muscle) => !recentSet.has(muscle));
  return { high48h, moderate72h, high7d };
}

function buildWarnings(jointPain: number | null, locations: string[] | null | undefined, level: ReadinessLevel) {
  const warnings: string[] = [];
  const normalizedLocations = uniqueStrings(locations);
  if (jointPain !== null && jointPain >= 4) warnings.push(`Dor articular${normalizedLocations.length ? ` em ${normalizedLocations.join(', ')}` : ''}: não force movimentos dolorosos.`);
  if (jointPain !== null && jointPain >= 7) warnings.push('Dor alta não é diagnóstico: interrompa o exercício se persistir ou piorar e procure avaliação profissional.');
  if (level === 'recuperacao') warnings.push('A recomendação de recuperação é conservadora e não substitui avaliação médica.');
  return warnings;
}

function presentationFor(level: ReadinessLevel, hasCheckin: boolean) {
  if (!hasCheckin) return { label: 'Sem check-in', tone: 'neutral' as const, advice: 'Faça o check-in para liberar uma recomendação confiável.' };
  if (level === 'boa') return { label: 'Boa', tone: 'good' as const, advice: 'Pode seguir o treino planejado com progressão gradual e técnica limpa.' };
  if (level === 'moderada') return { label: 'Moderada', tone: 'warning' as const, advice: 'Mantenha o controle e aceite uma pequena redução de volume.' };
  if (level === 'baixa') return { label: 'Baixa', tone: 'danger' as const, advice: 'Reduza volume e intensidade; fique longe da falha.' };
  return { label: 'Recuperação', tone: 'danger' as const, advice: 'Priorize execução leve, recuperação e pare se a dor piorar.' };
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function formatHours(hours: number) {
  const totalMinutes = Math.round(hours * 60);
  return `${Math.floor(totalMinutes / 60)}h${String(totalMinutes % 60).padStart(2, '0')}`;
}

function sleepPriority(row: ReadinessSleepRow) {
  if (row.corrected_from_overlapping_records) return 3;
  if (row.replaces_health_connect_sleep) return 2;
  return 1;
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

function uniqueStrings(values: unknown) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value)).filter(Boolean))];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}
