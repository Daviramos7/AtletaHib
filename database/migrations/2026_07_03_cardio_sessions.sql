-- v2.1 — Sessões de cardio importadas por JSON de print
-- Objetivo: registrar esteira/corrida/escada que o Mi Fitness mostra, mas não escreve como sessão em ExerciseSessionRecord.
-- Regra anti-duplicidade: estes dados NÃO devem somar automaticamente nos totais diários do Health Connect.

create table if not exists public.cardio_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  performed_at timestamptz not null,
  activity_type text not null default 'other' check (activity_type in ('treadmill','outdoor_run','walk','stairs','bike','elliptical','other')),
  activity_label text not null default 'Cardio',
  source text not null default 'manual',
  import_method text not null default 'manual' check (import_method in ('manual','screenshot_json','health_connect_inferred','other')),
  source_app text,
  device_name text,
  distance_km numeric(8,3) check (distance_km is null or distance_km >= 0),
  duration_seconds integer not null check (duration_seconds >= 0),
  active_kcal integer check (active_kcal is null or active_kcal >= 0),
  total_kcal integer check (total_kcal is null or total_kcal >= 0),
  avg_heart_rate integer check (avg_heart_rate is null or avg_heart_rate >= 0),
  max_heart_rate integer check (max_heart_rate is null or max_heart_rate >= 0),
  avg_pace_seconds_per_km integer check (avg_pace_seconds_per_km is null or avg_pace_seconds_per_km >= 0),
  best_pace_seconds_per_km integer check (best_pace_seconds_per_km is null or best_pace_seconds_per_km >= 0),
  avg_speed_kmh numeric(6,2) check (avg_speed_kmh is null or avg_speed_kmh >= 0),
  max_speed_kmh numeric(6,2) check (max_speed_kmh is null or max_speed_kmh >= 0),
  steps integer check (steps is null or steps >= 0),
  avg_cadence_spm integer check (avg_cadence_spm is null or avg_cadence_spm >= 0),
  max_cadence_spm integer check (max_cadence_spm is null or max_cadence_spm >= 0),
  avg_stride_cm integer check (avg_stride_cm is null or avg_stride_cm >= 0),
  max_stride_cm integer check (max_stride_cm is null or max_stride_cm >= 0),
  training_effect numeric(4,1),
  heart_rate_zones jsonb,
  splits jsonb,
  raw_json jsonb,
  confidence text not null default 'manual_review' check (confidence in ('low','medium','high','manual_review')),
  counts_toward_daily_totals boolean not null default false,
  metrics_may_already_exist_in_health_connect boolean not null default true,
  dedupe_key text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, dedupe_key)
);

alter table public.cardio_sessions enable row level security;

drop policy if exists "cardio_sessions_select_own" on public.cardio_sessions;
create policy "cardio_sessions_select_own" on public.cardio_sessions for select using (auth.uid() = user_id);

drop policy if exists "cardio_sessions_insert_own" on public.cardio_sessions;
create policy "cardio_sessions_insert_own" on public.cardio_sessions for insert with check (auth.uid() = user_id);

drop policy if exists "cardio_sessions_update_own" on public.cardio_sessions;
create policy "cardio_sessions_update_own" on public.cardio_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cardio_sessions_delete_own" on public.cardio_sessions;
create policy "cardio_sessions_delete_own" on public.cardio_sessions for delete using (auth.uid() = user_id);

create index if not exists idx_cardio_sessions_user_performed_at on public.cardio_sessions(user_id, performed_at desc);
create index if not exists idx_cardio_sessions_user_type on public.cardio_sessions(user_id, activity_type, performed_at desc);

drop trigger if exists set_cardio_sessions_updated_at on public.cardio_sessions;
create trigger set_cardio_sessions_updated_at
before update on public.cardio_sessions
for each row execute function public.set_updated_at();
