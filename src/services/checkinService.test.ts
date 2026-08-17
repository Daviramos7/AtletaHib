import { describe, expect, it } from 'vitest';
import { normalizeCheckinRow } from './checkinService';

describe('normalização dos campos opcionais do check-in', () => {
  it('mantém recovery_score e available_minutes como NULL quando não foram respondidos', () => {
    const row = normalizeCheckinRow('user-1', {
      log_date: '2026-08-17',
      checkin_mode: 'morning',
      energy_score: 7,
      recovery_score: '',
      available_minutes: '',
    });
    expect(row.recovery_score).toBeNull();
    expect(row.available_minutes).toBeNull();
  });

  it('persiste overrides explícitos válidos', () => {
    const row = normalizeCheckinRow('user-1', {
      log_date: '2026-08-17',
      recovery_score: '6',
      available_minutes: '40',
    });
    expect(row.recovery_score).toBe(6);
    expect(row.available_minutes).toBe(40);
  });

  it('mantém registros antigos válidos sem os campos novos', () => {
    const row = normalizeCheckinRow('user-1', { log_date: '2026-08-17', energy_score: 7, pain_level: 0 });
    expect(row.energy_score).toBe(7);
    expect(row.recovery_score).toBeNull();
    expect(row.available_minutes).toBeNull();
  });
});
