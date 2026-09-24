import { describe, expect, it } from 'vitest';
import { getCardioProgression } from './cardioProgression';
import { normalizeCardioImportPayload } from '../services/cardioService';

const now = new Date('2026-09-24T15:00:00Z');
const context = { now, timeZone: 'America/Sao_Paulo' };
function history(gap = 1, count = 9) {
  return Array.from({ length: count }, (_, i) => ({
    id: `c${i}`, workout_session_id: `w${i}`, duration_seconds: 1200, source: 'wearable',
    performed_at: new Date(now.getTime() - (gap + count - i - 1) * 86400000).toISOString(),
  }));
}
describe('cardio recency', () => {
  it('yesterday can advance after three eligible performances', () => expect(getCardioProgression(history(1), null, context).phase).toBe(4));
  it('seven days keeps the recent progression without inventing sessions', () => expect(getCardioProgression(history(7), null, context).phase).toBe(4));
  it('ten days repeats the last performed stage instead of advancing', () => {
    const result = getCardioProgression(history(10), null, context);
    expect(result.phase).toBe(3); expect(result.statusLabel).toContain('Repetir');
  });
  it.each([14, 21, 27])('%s days steps back at least one stage', (gap) => {
    const result = getCardioProgression(history(gap), null, context);
    expect(result.phase).toBe(2); expect(result.returnMode).toBe(true);
  });
  it.each([28, 45, 90])('%s days returns to baseline', (gap) => expect(getCardioProgression(history(gap), null, context).phase).toBe(1));
  it('never mutates or truncates historical execution', () => {
    const rows = history(28); rows[0].duration_seconds = 1500;
    const before = JSON.stringify(rows); getCardioProgression(rows, null, context); expect(JSON.stringify(rows)).toBe(before);
  });
  it('skipped and pending are not successful execution', () => {
    for (const status of ['skipped', 'pending', 'awaiting_import']) expect(getCardioProgression(history().map((row) => ({ ...row, status })), null, context).completed).toBe(0);
  });
  it('prescribed with no actual duration cannot progress', () => {
    expect(getCardioProgression(history().map((row) => ({ ...row, duration_seconds: 0 })), null, context).phase).toBe(1);
  });
  it('linked wearable counts while standalone wearable does not complete a stage', () => {
    expect(getCardioProgression(history(), null, context).completed).toBe(9);
    expect(getCardioProgression(history().map((row) => ({ ...row, workout_session_id: null })), null, context).completed).toBe(0);
  });
  it('a link to a skipped or unplanned parent cannot progress', () => {
    const rows = history(); const parents = rows.map((row) => ({ id: row.workout_session_id, cardio_status: 'skipped', cardio_plan: { planned: true } }));
    expect(getCardioProgression(rows, null, { ...context, workoutSessions: parents }).completed).toBe(0);
  });
  it('never counts two imports for the same prescribed session twice', () => {
    const rows = history(); expect(getCardioProgression([...rows, ...rows], null, context).completed).toBe(9);
  });
  it('poor tolerance does not unlock a new stage', () => {
    expect(getCardioProgression(history().map((row) => ({ ...row, perceived_effort: 9 })), null, context).phase).toBe(1);
  });
  it('uses existing adaptive return and cardio allowance', () => {
    const result = getCardioProgression(history(), null, { ...context, recommendation: { checkinValid: true, workoutMode: 'retorno', progressionAllowed: false, cardioGuidance: { minutes: 8 } } });
    expect(result.phase).toBe(2); expect(result.targetMinutes).toBe(8); expect(result.workout).toContain('8 min');
  });
  it('a zero-minute readiness recommendation remains zero', () => {
    expect(getCardioProgression(history(), null, { ...context, recommendation: { checkinValid: true, cardioGuidance: { minutes: 0 } } }).targetMinutes).toBe(0);
  });
  it('prescription never exceeds20 while actual25 stays25', () => {
    expect(getCardioProgression(history(1, 60), null, context).targetMinutes).toBeLessThanOrEqual(20);
    expect(normalizeCardioImportPayload({ date: '2026-09-24', duration_seconds: 1500 }).duration_seconds).toBe(1500);
  });
  it('23h59 to00h01 respects local calendar rather than UTC date', () => {
    const row = { ...history()[0], performed_at: '2026-09-24T02:59:00Z' };
    expect(getCardioProgression([row], null, { now: '2026-09-24T03:01:00Z', timeZone: 'America/Sao_Paulo' }).gapDays).toBe(1);
  });
  it('replays a past break so one comeback does not restore an old advanced stage', () => {
    const old = history(45, 12); const recent = { ...history(1, 1)[0], workout_session_id: 'new' };
    expect(getCardioProgression([...old, recent], null, context).phase).toBe(1);
  });
  it('future records cannot advance progression', () => {
    expect(getCardioProgression(history(-20), null, context).completed).toBe(0);
  });
});
