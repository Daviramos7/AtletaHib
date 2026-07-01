-- v1.2 — Produção: check-in diário, índices e RLS
-- Execute este arquivo se você já rodou schema.sql/policies.sql de versões anteriores.

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  sleep_hours numeric(4,2),
  energy_score integer check (energy_score between 1 and 10),
  hunger_score integer check (hunger_score between 1 and 10),
  stress_score integer check (stress_score between 1 and 10),
  pain_level integer check (pain_level between 0 and 10),
  soreness_level integer check (soreness_level between 0 and 10),
  steps integer check (steps >= 0),
  lactose_symptoms boolean not null default false,
  cravings_notes text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, log_date)
);

drop trigger if exists set_daily_checkins_updated_at on public.daily_checkins;
create trigger set_daily_checkins_updated_at
before update on public.daily_checkins
for each row execute function public.set_updated_at();

create index if not exists idx_daily_logs_user_date on public.daily_logs(user_id, log_date desc);
create index if not exists idx_daily_checkins_user_date on public.daily_checkins(user_id, log_date desc);
create index if not exists idx_meal_entries_user_date on public.meal_entries(user_id, log_date desc);
create index if not exists idx_weight_logs_user_date on public.weight_logs(user_id, log_date desc);
create index if not exists idx_run_sessions_user_performed_at on public.run_sessions(user_id, performed_at desc);
create index if not exists idx_workout_sessions_user_performed_at on public.workout_sessions(user_id, performed_at desc);

alter table public.daily_checkins enable row level security;

drop policy if exists "daily_checkins_select_own" on public.daily_checkins;
drop policy if exists "daily_checkins_insert_own" on public.daily_checkins;
drop policy if exists "daily_checkins_update_own" on public.daily_checkins;
drop policy if exists "daily_checkins_delete_own" on public.daily_checkins;

create policy "daily_checkins_select_own" on public.daily_checkins for select using (auth.uid() = user_id);
create policy "daily_checkins_insert_own" on public.daily_checkins for insert with check (auth.uid() = user_id);
create policy "daily_checkins_update_own" on public.daily_checkins for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_checkins_delete_own" on public.daily_checkins for delete using (auth.uid() = user_id);
