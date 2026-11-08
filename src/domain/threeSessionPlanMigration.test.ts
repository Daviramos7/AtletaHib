import { describe, expect, it } from 'vitest';
import migrationSql from '../../database/migrations/20261107120000_three_session_plan.sql?raw';

const sql = migrationSql
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

describe('migration do plano de 3 treinos', () => {
  it('é só aditiva: não apaga, não reescreve dado e não mexe em policy', () => {
    expect(sql).not.toMatch(/\bdrop\s+(table|column)\b/i);
    expect(sql).not.toMatch(/\b(update|delete\s+from|truncate)\b/i);
    expect(sql).not.toMatch(/\bpolicy\b/i);
    expect(sql).not.toMatch(/\bdisable\s+row\s+level\s+security\b/i);
  });

  it('cria as 6 colunas como opcionais, sem default nem not null', () => {
    for (const column of ['session_split', 'sequence_order', 'target_minutes', 'cardio_min_minutes', 'cardio_max_minutes', 'cardio_intensity']) {
      expect(sql).toMatch(new RegExp(`add column if not exists ${column} \\w+[,;]`));
    }
    expect(sql).not.toMatch(/not null/i);
    expect(sql).not.toMatch(/\bdefault\b/i);
  });

  it('limita a sessão a 90 min e não fixa o teto recomendado de cardio no banco', () => {
    expect(sql).toContain('target_minutes between 20 and 90');
    expect(sql).toContain('cardio_max_minutes between 1 and 90');
    expect(sql).not.toMatch(/between 1 and 25/);
  });

  it('roda em transação e é idempotente', () => {
    expect(sql).toMatch(/^\s*begin;/m);
    expect(sql).toMatch(/^\s*commit;/m);
    expect(sql.match(/add constraint/g)?.length).toBe(sql.match(/exception when duplicate_object then null/g)?.length);
  });
});
