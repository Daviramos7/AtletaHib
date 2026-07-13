import { describe, expect, it } from 'vitest';
import { formatDurationClock, parseDurationSeconds } from './durations';

describe('durations', () => {
  it('preserva cardio 20:08', () => expect(parseDurationSeconds('20:08')).toBe(1208));
  it('rejeita duração numérica sem unidade', () => expect(parseDurationSeconds(20)).toBeNull());
  it('aceita unidade explícita', () => expect(parseDurationSeconds(20, { numericUnit: 'minutes' })).toBe(1200));
  it('normaliza arredondamento sem produzir 10:60', () => expect(formatDurationClock(659.6)).toBe('11:00'));
});
