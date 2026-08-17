export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ActiveWorkoutDraft {
  version: 1;
  sessionId: string;
  startedAt: string;
  sessionLocalDate: string;
  planDayId: string;
  planDayWeekday: number | null;
  workoutVariant: 'base' | 'adapted';
  recommendation: Record<string, unknown> | null;
  rows: Array<Record<string, any>>;
  selectedCardioChoice: string;
  duration: string;
  effort: string;
}

export interface PendingWorkoutDraft {
  version: 1;
  userId: string;
  planDayId: string;
  localDate: string;
  updatedAt: string;
  rows: Array<Record<string, any>>;
}

export function createStableSessionId(now: Date = new Date(), randomValue: number = Math.random()) {
  return `${now.getTime().toString(36)}-${Math.floor(randomValue * 1_000_000_000).toString(36)}`;
}

export function canStartNewWorkoutSession(sessionId: string | null | undefined, startedAt: string | null | undefined) {
  return !(sessionId && startedAt);
}

export function resolveSessionPerformedAt(startedAt: string | null | undefined, fallback: Date = new Date()) {
  const parsed = startedAt ? new Date(startedAt) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? startedAt as string : fallback.toISOString();
}

export function createActiveWorkoutDraft(input: Omit<ActiveWorkoutDraft, 'version'>): ActiveWorkoutDraft {
  return cloneDraft({ version: 1, ...input });
}

export function saveActiveWorkoutDraft(storage: StorageLike, userId: string, draft: ActiveWorkoutDraft) {
  const normalized = cloneDraft(draft);
  storage.setItem(activeDraftKey(userId, normalized.sessionId), JSON.stringify(normalized));
  storage.setItem(activePointerKey(userId), JSON.stringify({ version: 1, sessionId: normalized.sessionId }));
  return normalized;
}

export function loadActiveWorkoutDraft(storage: StorageLike, userId: string): ActiveWorkoutDraft | null {
  const pointer = readJson(storage.getItem(activePointerKey(userId)));
  const sessionId = String(pointer?.sessionId ?? '');
  if (!sessionId) return null;
  const draft = readJson(storage.getItem(activeDraftKey(userId, sessionId)));
  if (!isActiveDraft(draft) || draft.sessionId !== sessionId) return null;
  return cloneDraft(draft);
}

export function clearActiveWorkoutDraft(storage: StorageLike, userId: string, sessionId?: string | null) {
  const pointer = readJson(storage.getItem(activePointerKey(userId)));
  const resolvedSessionId = String(sessionId ?? pointer?.sessionId ?? '');
  if (resolvedSessionId) storage.removeItem(activeDraftKey(userId, resolvedSessionId));
  storage.removeItem(activePointerKey(userId));
}

export function savePendingWorkoutRows(
  storage: StorageLike,
  userId: string,
  planDayId: string,
  localDate: string,
  rows: Array<Record<string, any>>,
  updatedAt = new Date().toISOString(),
) {
  const draft: PendingWorkoutDraft = {
    version: 1,
    userId: String(userId),
    planDayId: String(planDayId),
    localDate: String(localDate),
    updatedAt,
    rows: cloneRows(rows),
  };
  storage.setItem(pendingDraftKey(userId, planDayId), JSON.stringify(draft));
  return draft;
}

export function loadPendingWorkoutRows(storage: StorageLike, userId: string, planDayId: string, localDate: string) {
  const key = pendingDraftKey(userId, planDayId);
  const value = readJson(storage.getItem(key));
  const valid = isPendingDraft(value)
    && value.userId === String(userId)
    && value.planDayId === String(planDayId)
    && value.localDate === String(localDate);
  if (!valid) {
    if (value !== null) storage.removeItem(key);
    return [];
  }
  return cloneRows(value.rows);
}

export function clearPendingWorkoutRows(storage: StorageLike, userId: string, planDayId: string) {
  storage.removeItem(pendingDraftKey(userId, planDayId));
}

export function mergeRowsPreservingInput(candidateRows: Array<Record<string, any>>, currentRows: Array<Record<string, any>>) {
  const currentById = new Map((currentRows ?? []).map((row) => [String(row.rowId), row]));
  return (candidateRows ?? []).map((row) => {
    const current = currentById.get(String(row.rowId));
    return current ? { ...row, ...current, exercise: { ...row.exercise, ...current.exercise } } : { ...row, exercise: { ...row.exercise } };
  });
}

export function activePointerKey(userId: string) {
  return `gym-active-session-v414-${userId}`;
}

export function activeDraftKey(userId: string, sessionId: string) {
  return `gym-session-draft-v414-${userId}-${sessionId}`;
}

export function pendingDraftKey(userId: string, planDayId: string) {
  return `gym-pending-draft-v414-${userId}-${planDayId}`;
}

function isActiveDraft(value: any): value is ActiveWorkoutDraft {
  return value?.version === 1
    && typeof value.sessionId === 'string'
    && typeof value.startedAt === 'string'
    && typeof value.sessionLocalDate === 'string'
    && typeof value.planDayId === 'string'
    && Array.isArray(value.rows);
}

function isPendingDraft(value: any): value is PendingWorkoutDraft {
  return value?.version === 1
    && typeof value.userId === 'string'
    && typeof value.planDayId === 'string'
    && typeof value.localDate === 'string'
    && typeof value.updatedAt === 'string'
    && Array.isArray(value.rows);
}

function cloneDraft(draft: ActiveWorkoutDraft): ActiveWorkoutDraft {
  return {
    ...draft,
    recommendation: draft.recommendation ? { ...draft.recommendation } : null,
    rows: cloneRows(draft.rows),
  };
}

function cloneRows(rows: Array<Record<string, any>>) {
  return (rows ?? []).map((row) => ({ ...row, exercise: row.exercise ? { ...row.exercise } : row.exercise }));
}

function readJson(value: string | null): any {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}
