-- v3.1 — Sessões de treino vindas de print do relógio/Mi Fitness
-- Objetivo: registrar duração, kcal, FC e zonas do treino medido pelo relógio, sem duplicar totais diários.
-- A verdade das séries/cargas/reps continua em workout_sessions + workout_exercise_sets.

create table if not exists public.wearable_workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_session_id uuid references public.workout_sessions(id) on delete set null,

  performed_at timestamptz not null,
  activity_type text not null default 'strength_training',
  activity_label text,

  source text not null default 'mi_fitness_screenshot',
  import_method text not null default 'screenshot_json',
  source_app text,
  device_name text,

  duration_seconds integer not null check (duration_seconds >= 0 and duration_seconds <= 86400),
  active_kcal integer check (active_kcal is null or active_kcal >= 0),
  total_kcal integer check (total_kcal is null or total_kcal >= 0),
  avg_heart_rate integer check (avg_heart_rate is null or avg_heart_rate >= 0),
  max_heart_rate integer check (max_heart_rate is null or max_heart_rate >= 0),
  training_effect numeric,
  vitality_score integer,

  heart_rate_zones jsonb,
  raw_json jsonb,

  counts_toward_daily_totals boolean not null default false,
  metrics_may_already_exist_in_health_connect boolean not null default true,
  confidence text not null default 'manual_review' check (confidence in ('low','medium','high','manual_review')),
  dedupe_key text not null,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(user_id, dedupe_key)
);

alter table public.wearable_workout_sessions enable row level security;

drop policy if exists "wearable_workout_sessions_select_own" on public.wearable_workout_sessions;
create policy "wearable_workout_sessions_select_own" on public.wearable_workout_sessions for select using (auth.uid() = user_id);

drop policy if exists "wearable_workout_sessions_insert_own" on public.wearable_workout_sessions;
create policy "wearable_workout_sessions_insert_own" on public.wearable_workout_sessions for insert with check (auth.uid() = user_id);

drop policy if exists "wearable_workout_sessions_update_own" on public.wearable_workout_sessions;
create policy "wearable_workout_sessions_update_own" on public.wearable_workout_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "wearable_workout_sessions_delete_own" on public.wearable_workout_sessions;
create policy "wearable_workout_sessions_delete_own" on public.wearable_workout_sessions for delete using (auth.uid() = user_id);

create index if not exists idx_wearable_workout_sessions_user_performed_at on public.wearable_workout_sessions(user_id, performed_at desc);
create index if not exists idx_wearable_workout_sessions_user_type on public.wearable_workout_sessions(user_id, activity_type, performed_at desc);
create index if not exists idx_wearable_workout_sessions_workout_session on public.wearable_workout_sessions(workout_session_id);
