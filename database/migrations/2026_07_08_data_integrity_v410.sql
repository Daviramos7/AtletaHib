-- Atleta Hib v4.1.0 — integridade de dados e fontes múltiplas
-- Objetivo: alinhar Web + Android Bridge para não sobrescrever métricas diárias de fontes diferentes.

create unique index if not exists wearable_daily_metrics_user_day_source_unique
  on public.wearable_daily_metrics(user_id, metric_date, source);

-- Índice antigo do Bridge v4.0.x: impedia múltiplas fontes no mesmo dia.
drop index if exists public.wearable_daily_metrics_user_day_unique;

-- Garante que os upserts usados pelo front/bridge tenham a constraint esperada.
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'wearable_daily_metrics_user_day_source_unique'
  ) then
    raise exception 'Índice wearable_daily_metrics_user_day_source_unique não foi criado.';
  end if;
end $$;
