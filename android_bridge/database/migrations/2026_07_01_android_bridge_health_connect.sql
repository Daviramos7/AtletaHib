-- Atleta Híbrido Android Bridge
-- Garante que a tabela wearable_daily_metrics aceite upsert seguro por usuário + data.

alter table public.wearable_daily_metrics
  alter column user_id set default auth.uid();

create unique index if not exists wearable_daily_metrics_user_day_unique
  on public.wearable_daily_metrics(user_id, metric_date);

-- Caso ainda não exista RLS/policies nesta tabela, mantenha este bloco.
alter table public.wearable_daily_metrics enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'wearable_daily_metrics'
      and policyname = 'Users can read own wearable metrics'
  ) then
    create policy "Users can read own wearable metrics"
    on public.wearable_daily_metrics
    for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'wearable_daily_metrics'
      and policyname = 'Users can insert own wearable metrics'
  ) then
    create policy "Users can insert own wearable metrics"
    on public.wearable_daily_metrics
    for insert
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'wearable_daily_metrics'
      and policyname = 'Users can update own wearable metrics'
  ) then
    create policy "Users can update own wearable metrics"
    on public.wearable_daily_metrics
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end $$;

grant select, insert, update on public.wearable_daily_metrics to authenticated;
