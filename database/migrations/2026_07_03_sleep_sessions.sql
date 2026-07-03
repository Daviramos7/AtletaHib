-- v2.4 — Sono corrigido/importado por JSON de print
-- Objetivo: registrar a sessão consolidada de sono do Mi Fitness quando o Health Connect vier com divergência, duplicidade ou registros sobrepostos.
-- Regra: sono é métrica diária única. Se existir sleep_sessions para o dia, o site deve priorizar esse registro sobre o sono automático do wearable_daily_metrics.

create table if not exists public.sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  sleep_date date not null,
  sleep_start_at timestamptz,
  sleep_end_at timestamptz,
  sleep_start_time text,
  sleep_end_time text,
  duration_minutes integer not null check (duration_minutes >= 0 and duration_minutes <= 1440),

  sleep_score integer check (sleep_score is null or (sleep_score >= 0 and sleep_score <= 100)),
  sleep_quality_label text,
  sleep_score_delta integer,
  sleep_percentile_text text,

  deep_sleep_minutes integer check (deep_sleep_minutes is null or deep_sleep_minutes >= 0),
  deep_sleep_percent integer check (deep_sleep_percent is null or (deep_sleep_percent >= 0 and deep_sleep_percent <= 100)),
  deep_sleep_reference text,

  light_sleep_minutes integer check (light_sleep_minutes is null or light_sleep_minutes >= 0),
  light_sleep_percent integer check (light_sleep_percent is null or (light_sleep_percent >= 0 and light_sleep_percent <= 100)),
  light_sleep_reference text,

  rem_sleep_minutes integer check (rem_sleep_minutes is null or rem_sleep_minutes >= 0),
  rem_sleep_percent integer check (rem_sleep_percent is null or (rem_sleep_percent >= 0 and rem_sleep_percent <= 100)),
  rem_sleep_reference text,

  awake_minutes integer check (awake_minutes is null or awake_minutes >= 0),
  awake_count integer check (awake_count is null or awake_count >= 0),
  awake_reference text,
  awake_warning_label text,

  avg_heart_rate integer check (avg_heart_rate is null or avg_heart_rate >= 0),
  min_heart_rate integer check (min_heart_rate is null or min_heart_rate >= 0),
  max_heart_rate integer check (max_heart_rate is null or max_heart_rate >= 0),
  avg_spo2 integer check (avg_spo2 is null or (avg_spo2 >= 0 and avg_spo2 <= 100)),
  min_spo2 integer check (min_spo2 is null or (min_spo2 >= 0 and min_spo2 <= 100)),
  breathing_score integer check (breathing_score is null or (breathing_score >= 0 and breathing_score <= 100)),

  source text not null default 'manual',
  import_method text not null default 'manual' check (import_method in ('manual','screenshot_json','health_connect_corrected','other')),
  source_app text,
  device_name text,

  replaces_health_connect_sleep boolean not null default true,
  counts_toward_daily_totals boolean not null default true,
  metrics_may_already_exist_in_health_connect boolean not null default true,

  overlap_detected boolean not null default false,
  corrected_from_overlapping_records boolean not null default false,
  raw_json jsonb,
  confidence text not null default 'manual_review' check (confidence in ('low','medium','high','manual_review')),
  dedupe_key text not null,
  warnings jsonb not null default '[]'::jsonb,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, dedupe_key)
);

alter table public.sleep_sessions enable row level security;

drop policy if exists "sleep_sessions_select_own" on public.sleep_sessions;
create policy "sleep_sessions_select_own" on public.sleep_sessions for select using (auth.uid() = user_id);

drop policy if exists "sleep_sessions_insert_own" on public.sleep_sessions;
create policy "sleep_sessions_insert_own" on public.sleep_sessions for insert with check (auth.uid() = user_id);

drop policy if exists "sleep_sessions_update_own" on public.sleep_sessions;
create policy "sleep_sessions_update_own" on public.sleep_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sleep_sessions_delete_own" on public.sleep_sessions;
create policy "sleep_sessions_delete_own" on public.sleep_sessions for delete using (auth.uid() = user_id);

create index if not exists idx_sleep_sessions_user_date on public.sleep_sessions(user_id, sleep_date desc);
create index if not exists idx_sleep_sessions_user_source_date on public.sleep_sessions(user_id, source, sleep_date desc);

drop trigger if exists set_sleep_sessions_updated_at on public.sleep_sessions;
create trigger set_sleep_sessions_updated_at
before update on public.sleep_sessions
for each row execute function public.set_updated_at();
