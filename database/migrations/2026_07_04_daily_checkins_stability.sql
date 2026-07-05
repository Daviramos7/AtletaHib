-- v3.9.5 — Estabilidade do check-in diário
-- Rode no Supabase SQL Editor se o check-in não estiver salvando.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  sleep_hours numeric(4,2),
  energy_score integer,
  hunger_score integer,
  stress_score integer,
  pain_level integer,
  soreness_level integer,
  steps integer,
  lactose_symptoms boolean not null default false,
  cravings_notes text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.daily_checkins add column if not exists sleep_hours numeric(4,2);
alter table public.daily_checkins add column if not exists energy_score integer;
alter table public.daily_checkins add column if not exists hunger_score integer;
alter table public.daily_checkins add column if not exists stress_score integer;
alter table public.daily_checkins add column if not exists pain_level integer;
alter table public.daily_checkins add column if not exists soreness_level integer;
alter table public.daily_checkins add column if not exists steps integer;
alter table public.daily_checkins add column if not exists lactose_symptoms boolean not null default false;
alter table public.daily_checkins add column if not exists cravings_notes text;
alter table public.daily_checkins add column if not exists notes text;
alter table public.daily_checkins add column if not exists created_at timestamptz not null default now();
alter table public.daily_checkins add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table public.daily_checkins
    add constraint daily_checkins_energy_score_check check (energy_score is null or energy_score between 1 and 10);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.daily_checkins
    add constraint daily_checkins_hunger_score_check check (hunger_score is null or hunger_score between 1 and 10);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.daily_checkins
    add constraint daily_checkins_stress_score_check check (stress_score is null or stress_score between 1 and 10);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.daily_checkins
    add constraint daily_checkins_pain_level_check check (pain_level is null or pain_level between 0 and 10);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.daily_checkins
    add constraint daily_checkins_soreness_level_check check (soreness_level is null or soreness_level between 0 and 10);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.daily_checkins
    add constraint daily_checkins_steps_check check (steps is null or steps >= 0);
exception when duplicate_object then null;
end $$;

create unique index if not exists daily_checkins_user_log_date_uidx
on public.daily_checkins(user_id, log_date);

drop trigger if exists set_daily_checkins_updated_at on public.daily_checkins;
create trigger set_daily_checkins_updated_at
before update on public.daily_checkins
for each row execute function public.set_updated_at();

alter table public.daily_checkins enable row level security;

drop policy if exists "daily_checkins_select_own" on public.daily_checkins;
drop policy if exists "daily_checkins_insert_own" on public.daily_checkins;
drop policy if exists "daily_checkins_update_own" on public.daily_checkins;
drop policy if exists "daily_checkins_delete_own" on public.daily_checkins;

create policy "daily_checkins_select_own" on public.daily_checkins
for select using (auth.uid() = user_id);

create policy "daily_checkins_insert_own" on public.daily_checkins
for insert with check (auth.uid() = user_id);

create policy "daily_checkins_update_own" on public.daily_checkins
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "daily_checkins_delete_own" on public.daily_checkins
for delete using (auth.uid() = user_id);
