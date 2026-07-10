import { describe, expect, it } from 'vitest';
import { localDateKey, localDayRangeIso, normalizeDateKey, shiftDateKey } from './dates';

describe('dates', () => {
  it('rejeita datas de calendário impossíveis', () => {
    expect(normalizeDateKey('2026-02-31')).toBeNull();
    expect(normalizeDateKey('31/02/2026')).toBeNull();
    expect(localDateKey('data-inválida')).toBe('');
  });

  it('mantém a data local sem converter a chave por UTC', () => {
    expect(localDateKey(new Date(2026, 6, 10, 23, 45))).toBe('2026-07-10');
    expect(shiftDateKey('2026-07-10', -1)).toBe('2026-07-09');
  });

  it('cria uma janela local de um dia', () => {
    const range = localDayRangeIso('2026-07-10');
    expect(range).not.toBeNull();
    expect(new Date(range!.endIso).getTime() - new Date(range!.startIso).getTime()).toBeGreaterThanOrEqual(23 * 60 * 60 * 1000);
  });
});
