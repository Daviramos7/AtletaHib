-- Atleta Híbrido Cloud — Schema PostgreSQL/Supabase
-- Execute no Supabase SQL Editor antes de rodar o app.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default '',
  height_cm numeric(5,2) not null default 170,
  starting_weight_kg numeric(6,2) not null default 80,
  current_weight_kg numeric(6,2) not null default 80,
  target_weight_kg numeric(6,2) not null default 75,
  kcal_goal integer not null default 2200,
  water_goal_ml integer not null default 2500,
  dietary_restriction text not null default 'Nenhuma restrição informada.',
  lunch_time time not null default '12:30',
  training_time time not null default '18:00',
  routine_notes text not null default 'Rotina ainda não personalizada.',
  objective text not null default 'Melhorar saúde, condicionamento e consistência.',
  onboarding_completed boolean not null default false,
  training_level text not null default 'iniciante',
  main_goal text not null default 'saude',
  weekly_strength_days integer not null default 3 check (weekly_strength_days between 1 and 7),
  weekly_cardio_days integer not null default 2 check (weekly_cardio_days between 0 and 7),
  plays_football boolean not null default false,
  diet_style text not null default 'flexivel',
  wearable_provider text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  water_ml integer not null default 0,
  sleep_hours numeric(4,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, log_date)
);

create table if not exists public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  meal_type text not null check (meal_type in ('cafe','lanche1','almoco','lanche2','jantar','extra')),
  food_name text not null,
  grams numeric(8,2) not null check (grams > 0),
  kcal integer not null check (kcal >= 0),
  protein_g numeric(8,2) default 0,
  carbs_g numeric(8,2) default 0,
  fat_g numeric(8,2) default 0,
  source text not null default 'manual',
  import_method text not null default 'manual',
  confidence text not null default 'manual_review' check (confidence in ('low','medium','high','manual_review')),
  dedupe_key text,
  created_at timestamptz not null default now()
);

create table if not exists public.custom_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  normalized_name text generated always as (lower(trim(name))) stored,
  kcal_per_100g integer not null check (kcal_per_100g >= 0 and kcal_per_100g < 1200),
  protein_per_100g numeric(8,2) default 0,
  carbs_per_100g numeric(8,2) default 0,
  fat_per_100g numeric(8,2) default 0,
  created_at timestamptz not null default now(),
  unique(user_id, normalized_name)
);

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  weight_kg numeric(6,2) not null check (weight_kg > 0),
  waist_cm numeric(6,2),
  notes text,
  created_at timestamptz not null default now(),
  unique(user_id, log_date)
);

create table if not exists public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  objective text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.training_plans(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  title text not null,
  type text not null default 'forca',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.exercise_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  training_day_id uuid not null references public.training_days(id) on delete cascade,
  position integer not null default 1,
  exercise_name text not null,
  sets text not null,
  reps text not null,
  load_kg numeric(6,2),
  rest_seconds integer,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  training_day_id uuid references public.training_days(id) on delete set null,
  performed_at timestamptz not null default now(),
  duration_minutes integer,
  perceived_effort integer check (perceived_effort between 1 and 10),
  completed boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.run_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  performed_at timestamptz not null default now(),
  distance_km numeric(6,3) not null check (distance_km >= 0),
  duration_seconds integer not null check (duration_seconds >= 0),
  run_walk_protocol text,
  notes text,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_daily_logs_updated_at on public.daily_logs;
create trigger set_daily_logs_updated_at
before update on public.daily_logs
for each row execute function public.set_updated_at();

drop trigger if exists set_training_plans_updated_at on public.training_plans;
create trigger set_training_plans_updated_at
before update on public.training_plans
for each row execute function public.set_updated_at();

-- v1.2 — Produção: check-in, performance e índices
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
  morning_notes text,
  evening_notes text,
  morning_saved_at timestamptz,
  evening_saved_at timestamptz,
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
create unique index if not exists meal_entries_user_dedupe_uidx on public.meal_entries(user_id, dedupe_key) where dedupe_key is not null;
create index if not exists idx_weight_logs_user_date on public.weight_logs(user_id, log_date desc);
create index if not exists idx_run_sessions_user_performed_at on public.run_sessions(user_id, performed_at desc);
create index if not exists idx_workout_sessions_user_performed_at on public.workout_sessions(user_id, performed_at desc);

create or replace function public.increment_daily_water(p_user_id uuid, p_log_date date, p_delta integer)
returns public.daily_logs
language plpgsql
security invoker
set search_path = public
as $$
declare result public.daily_logs;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Acesso negado para hidratação.' using errcode = '42501';
  end if;
  insert into public.daily_logs (user_id, log_date, water_ml)
  values (p_user_id, p_log_date, greatest(0, p_delta))
  on conflict (user_id, log_date)
  do update set water_ml = greatest(0, public.daily_logs.water_ml + p_delta)
  returning * into result;
  return result;
end;
$$;

revoke all on function public.increment_daily_water(uuid, date, integer) from public;
grant execute on function public.increment_daily_water(uuid, date, integer) to authenticated;
-- v1.3 — TypeScript + registro real de séries, cargas e evolução de força
-- Execute no Supabase SQL Editor se você já rodou versões anteriores.

create table if not exists public.workout_exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  training_day_id uuid references public.training_days(id) on delete set null,
  exercise_entry_id uuid references public.exercise_entries(id) on delete set null,
  exercise_name text not null,
  set_number integer not null check (set_number > 0),
  planned_reps text,
  reps integer not null check (reps >= 0),
  load_kg numeric(7,2) not null default 0 check (load_kg >= 0),
  perceived_effort integer check (perceived_effort between 1 and 10),
  performed_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.workout_exercise_sets enable row level security;

drop policy if exists "workout_exercise_sets_select_own" on public.workout_exercise_sets;
create policy "workout_exercise_sets_select_own" on public.workout_exercise_sets for select using (auth.uid() = user_id);
drop policy if exists "workout_exercise_sets_insert_own" on public.workout_exercise_sets;
create policy "workout_exercise_sets_insert_own" on public.workout_exercise_sets for insert with check (auth.uid() = user_id);
drop policy if exists "workout_exercise_sets_update_own" on public.workout_exercise_sets;
create policy "workout_exercise_sets_update_own" on public.workout_exercise_sets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "workout_exercise_sets_delete_own" on public.workout_exercise_sets;
create policy "workout_exercise_sets_delete_own" on public.workout_exercise_sets for delete using (auth.uid() = user_id);

create index if not exists idx_workout_exercise_sets_user_performed_at on public.workout_exercise_sets(user_id, performed_at desc);
create index if not exists idx_workout_exercise_sets_user_exercise on public.workout_exercise_sets(user_id, exercise_name, performed_at desc);
create index if not exists idx_workout_exercise_sets_session on public.workout_exercise_sets(workout_session_id);
-- v1.5 — Integrações de relógio/saúde
-- Execute no Supabase SQL Editor se você já rodou versões anteriores.

alter table public.profiles
  add column if not exists preferred_sync_mode text not null default 'manual',
  add column if not exists health_platform text not null default 'none';

create table if not exists public.health_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'manual',
  device_name text not null default '',
  source_app text not null default '',
  sync_mode text not null default 'manual' check (sync_mode in ('manual','health_connect','strava','xiaomi_export','apple_health','other')),
  status text not null default 'planned' check (status in ('planned','configured','connected','paused','error')),
  permissions_text text not null default '',
  notes text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider, sync_mode)
);

create table if not exists public.wearable_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_date date not null,
  provider text not null default 'manual',
  source text not null default 'manual',
  steps integer check (steps >= 0),
  sleep_minutes integer check (sleep_minutes >= 0),
  avg_heart_rate integer check (avg_heart_rate >= 0),
  resting_heart_rate integer check (resting_heart_rate >= 0),
  active_kcal integer check (active_kcal >= 0),
  workout_minutes integer check (workout_minutes >= 0),
  distance_km numeric(8,3) check (distance_km >= 0),
  readiness_hint text,
  notes text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, metric_date, source)
);

alter table public.health_integrations enable row level security;
alter table public.wearable_daily_metrics enable row level security;

drop trigger if exists set_health_integrations_updated_at on public.health_integrations;
create trigger set_health_integrations_updated_at
before update on public.health_integrations
for each row execute function public.set_updated_at();

drop trigger if exists set_wearable_daily_metrics_updated_at on public.wearable_daily_metrics;
create trigger set_wearable_daily_metrics_updated_at
before update on public.wearable_daily_metrics
for each row execute function public.set_updated_at();

create index if not exists idx_health_integrations_user_provider on public.health_integrations(user_id, provider);
create index if not exists idx_wearable_daily_metrics_user_date on public.wearable_daily_metrics(user_id, metric_date desc);
create index if not exists idx_wearable_daily_metrics_user_provider_date on public.wearable_daily_metrics(user_id, provider, metric_date desc);

-- RLS: cada usuário acessa apenas suas integrações e métricas.
drop policy if exists "health_integrations_select_own" on public.health_integrations;
create policy "health_integrations_select_own" on public.health_integrations for select using (auth.uid() = user_id);
drop policy if exists "health_integrations_insert_own" on public.health_integrations;
create policy "health_integrations_insert_own" on public.health_integrations for insert with check (auth.uid() = user_id);
drop policy if exists "health_integrations_update_own" on public.health_integrations;
create policy "health_integrations_update_own" on public.health_integrations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "health_integrations_delete_own" on public.health_integrations;
create policy "health_integrations_delete_own" on public.health_integrations for delete using (auth.uid() = user_id);

drop policy if exists "wearable_daily_metrics_select_own" on public.wearable_daily_metrics;
create policy "wearable_daily_metrics_select_own" on public.wearable_daily_metrics for select using (auth.uid() = user_id);
drop policy if exists "wearable_daily_metrics_insert_own" on public.wearable_daily_metrics;
create policy "wearable_daily_metrics_insert_own" on public.wearable_daily_metrics for insert with check (auth.uid() = user_id);
drop policy if exists "wearable_daily_metrics_update_own" on public.wearable_daily_metrics;
create policy "wearable_daily_metrics_update_own" on public.wearable_daily_metrics for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "wearable_daily_metrics_delete_own" on public.wearable_daily_metrics;
create policy "wearable_daily_metrics_delete_own" on public.wearable_daily_metrics for delete using (auth.uid() = user_id);
