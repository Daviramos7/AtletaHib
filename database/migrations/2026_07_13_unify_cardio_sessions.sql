-- v4.1.2 — unifica toda sessão de cardio em public.cardio_sessions.
-- Seguro para reexecução: cada corrida antiga recebe uma dedupe_key estável.
-- A tabela run_sessions é mantida apenas como reserva histórica, sem novas escritas pelo app.

do $$
begin
  if to_regclass('public.run_sessions') is not null then
    execute $migration$
      insert into public.cardio_sessions (
        id,
        user_id,
        performed_at,
        activity_type,
        activity_label,
        source,
        import_method,
        source_app,
        distance_km,
        duration_seconds,
        confidence,
        counts_toward_daily_totals,
        metrics_may_already_exist_in_health_connect,
        dedupe_key,
        notes,
        raw_json,
        created_at,
        updated_at
      )
      select
        run.id,
        run.user_id,
        run.performed_at,
        'outdoor_run',
        'Corrida',
        'legacy_run_sessions',
        'other',
        'Atleta Híbrido legado',
        run.distance_km,
        run.duration_seconds,
        'manual_review',
        false,
        true,
        'legacy_run_' || run.id::text,
        nullif(concat_ws(' · ', nullif(run.run_walk_protocol, ''), nullif(run.notes, '')), ''),
        jsonb_build_object(
          'legacy_table', 'run_sessions',
          'legacy_id', run.id,
          'run_walk_protocol', run.run_walk_protocol,
          'original_notes', run.notes
        ),
        run.created_at,
        greatest(run.created_at, run.performed_at)
      from public.run_sessions as run
      on conflict do nothing
    $migration$;

    comment on table public.run_sessions is
      'LEGADO v4.1.2: dados migrados para cardio_sessions. Não usar para novas escritas.';

    drop policy if exists "run_sessions_insert_own" on public.run_sessions;
    drop policy if exists "run_sessions_update_own" on public.run_sessions;
    drop policy if exists "run_sessions_delete_own" on public.run_sessions;
  end if;
end
$$;

