import { describe, expect, it } from 'vitest';
import migrationSql from '../../database/migrations/2026_08_30_flexible_gym_sessions.sql?raw';
import schemaSql from '../../database/schema.sql?raw';

describe('migration da Academia flexível', () => {
  const backfill = migrationSql.slice(
    migrationSql.indexOf('update public.workout_sessions'),
    migrationSql.indexOf('create or replace function public.normalize_legacy_workout_session_lifecycle'),
  );
  const lifecycleFunction = migrationSql.slice(
    migrationSql.indexOf('create or replace function public.normalize_legacy_workout_session_lifecycle'),
    migrationSql.indexOf('do $$ begin'),
  );

  it('não inventa completed_at a partir de performed_at', () => {
    expect(backfill).not.toMatch(/\bcompleted_at\s*=/i);
    expect(backfill).not.toMatch(/coalesce\s*\(\s*completed_at\s*,\s*performed_at/i);
  });

  it('não inventa strength_completed_at a partir de performed_at', () => {
    expect(backfill).not.toMatch(/\bstrength_completed_at\s*=/i);
    expect(backfill).not.toMatch(/coalesce\s*\(\s*strength_completed_at\s*,\s*performed_at/i);
  });

  it('mantém completed legado concluído e separa incompleto como legacy', () => {
    expect(backfill).toContain("session_status = case when completed then 'completed' else 'legacy' end");
    expect(backfill).toContain("strength_status = case when completed then 'completed' else 'active' end");
  });

  it('mantém insert legado completed=true normalizado', () => {
    expect(migrationSql).toContain('normalize_legacy_workout_session_lifecycle');
    expect(migrationSql).toMatch(/before insert or update on public\.workout_sessions/i);
    expect(lifecycleFunction).toContain("tg_op = 'INSERT'");
    expect(migrationSql).toContain("new.session_status := 'completed'");
    expect(migrationSql).toContain("new.strength_status := 'completed'");
  });

  it('normaliza update legado que altera somente completed de false para true', () => {
    expect(lifecycleFunction).toContain("tg_op = 'UPDATE'");
    expect(lifecycleFunction).toMatch(/old\.completed = false[\s\S]*new\.completed = true/i);
    expect(lifecycleFunction).toContain("old.session_status = 'active'");
    expect(lifecycleFunction).toContain("old.strength_status = 'active'");
    expect(lifecycleFunction).toContain("old.cardio_status = 'not_planned'");
    expect(lifecycleFunction).toContain("(to_jsonb(new) - 'completed') = (to_jsonb(old) - 'completed')");
  });

  it('não inventa timestamps ao normalizar update legado', () => {
    expect(lifecycleFunction).not.toMatch(/new\.completed_at\s*:=/i);
    expect(lifecycleFunction).not.toMatch(/new\.strength_completed_at\s*:=/i);
  });

  it('não interfere em update moderno válido', () => {
    expect(lifecycleFunction).toContain("old.session_status = 'active'");
    expect(lifecycleFunction).toContain("old.strength_status = 'active'");
    expect(lifecycleFunction).toContain("old.cardio_status = 'not_planned'");
  });

  it('não normaliza finalização moderna com cardio pendente', () => {
    expect(lifecycleFunction).not.toMatch(/old\.cardio_status\s*=\s*'pending'/i);
    expect(migrationSql).toMatch(/completed = true[\s\S]*cardio_status in \('not_planned', 'awaiting_import', 'completed', 'skipped'\)/i);
  });

  it('não conserta update moderno incoerente que altera outros campos', () => {
    expect(lifecycleFunction).toContain("(to_jsonb(new) - 'completed') = (to_jsonb(old) - 'completed')");
  });

  it('mantém awaiting_import finalizado válido e fora da assinatura legada', () => {
    expect(lifecycleFunction).toContain("old.cardio_status = 'not_planned'");
    expect(migrationSql).toMatch(/completed = true[\s\S]*session_status = 'completed'[\s\S]*cardio_status in \('not_planned', 'awaiting_import', 'completed', 'skipped'\)/i);
  });

  it('instala a constraint combinada também no schema canônico', () => {
    for (const sql of [migrationSql, schemaSql]) {
      expect(sql).toContain('workout_sessions_lifecycle_coherence_check');
      expect(sql).toContain("session_status = 'legacy'");
      expect(sql).toMatch(/completed = true[\s\S]*session_status = 'completed'[\s\S]*cardio_status in \('not_planned', 'awaiting_import', 'completed', 'skipped'\)/i);
    }
  });
});
