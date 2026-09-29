import { describe, expect, it } from 'vitest';
import migrationSql from '../../database/migrations/20260928194615_public_release_security_hardening.sql?raw';

describe('migration de segurança para publicação', () => {
  it('remove privilégios desnecessários sem apagar dados', () => {
    expect(migrationSql).toMatch(/revoke all privileges on all tables in schema public from anon/i);
    expect(migrationSql).toMatch(/revoke truncate, references, trigger on all tables in schema public from authenticated/i);
    expect(migrationSql).not.toMatch(/^\s*(delete\s+from|truncate\s+table|drop\s+table)/im);
  });

  it('expõe somente o RPC de água para authenticated', () => {
    expect(migrationSql).toMatch(/revoke execute on all functions in schema public from public, anon, authenticated/i);
    expect(migrationSql).toMatch(/grant execute on function public\.increment_daily_water\(uuid, date, integer\) to authenticated/i);
  });

  it('fixa search_path das funções criadas', () => {
    expect(migrationSql).toMatch(/alter function public\.set_updated_at\(\) set search_path = public/i);
    expect(migrationSql.match(/set search_path = ''/g)).toHaveLength(4);
    expect(migrationSql).not.toMatch(/security definer/i);
  });

  it.each([
    'validate_training_day_plan_owner',
    'validate_exercise_entry_day_owner',
    'validate_workout_session_day_owner',
    'validate_workout_set_owner_links',
  ])('instala a barreira cross-user %s', (name) => {
    expect(migrationSql).toContain(`function public.${name}()`);
    expect(migrationSql).toContain(`trigger ${name}`);
  });
});
