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
