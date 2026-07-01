-- Atleta Híbrido Cloud — Row Level Security
-- Execute depois do schema.sql.

alter table public.profiles enable row level security;
alter table public.daily_logs enable row level security;
alter table public.meal_entries enable row level security;
alter table public.custom_foods enable row level security;
alter table public.weight_logs enable row level security;
alter table public.training_plans enable row level security;
alter table public.training_days enable row level security;
alter table public.exercise_entries enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.run_sessions enable row level security;

-- Profiles
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = user_id);

-- Daily logs
create policy "daily_logs_select_own" on public.daily_logs for select using (auth.uid() = user_id);
create policy "daily_logs_insert_own" on public.daily_logs for insert with check (auth.uid() = user_id);
create policy "daily_logs_update_own" on public.daily_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_logs_delete_own" on public.daily_logs for delete using (auth.uid() = user_id);

-- Meal entries
create policy "meal_entries_select_own" on public.meal_entries for select using (auth.uid() = user_id);
create policy "meal_entries_insert_own" on public.meal_entries for insert with check (auth.uid() = user_id);
create policy "meal_entries_update_own" on public.meal_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "meal_entries_delete_own" on public.meal_entries for delete using (auth.uid() = user_id);

-- Custom foods
create policy "custom_foods_select_own" on public.custom_foods for select using (auth.uid() = user_id);
create policy "custom_foods_insert_own" on public.custom_foods for insert with check (auth.uid() = user_id);
create policy "custom_foods_update_own" on public.custom_foods for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "custom_foods_delete_own" on public.custom_foods for delete using (auth.uid() = user_id);

-- Weight logs
create policy "weight_logs_select_own" on public.weight_logs for select using (auth.uid() = user_id);
create policy "weight_logs_insert_own" on public.weight_logs for insert with check (auth.uid() = user_id);
create policy "weight_logs_update_own" on public.weight_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "weight_logs_delete_own" on public.weight_logs for delete using (auth.uid() = user_id);

-- Training plans
create policy "training_plans_select_own" on public.training_plans for select using (auth.uid() = user_id);
create policy "training_plans_insert_own" on public.training_plans for insert with check (auth.uid() = user_id);
create policy "training_plans_update_own" on public.training_plans for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "training_plans_delete_own" on public.training_plans for delete using (auth.uid() = user_id);

-- Training days
create policy "training_days_select_own" on public.training_days for select using (auth.uid() = user_id);
create policy "training_days_insert_own" on public.training_days for insert with check (auth.uid() = user_id);
create policy "training_days_update_own" on public.training_days for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "training_days_delete_own" on public.training_days for delete using (auth.uid() = user_id);

-- Exercise entries
create policy "exercise_entries_select_own" on public.exercise_entries for select using (auth.uid() = user_id);
create policy "exercise_entries_insert_own" on public.exercise_entries for insert with check (auth.uid() = user_id);
create policy "exercise_entries_update_own" on public.exercise_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exercise_entries_delete_own" on public.exercise_entries for delete using (auth.uid() = user_id);

-- Workout sessions
create policy "workout_sessions_select_own" on public.workout_sessions for select using (auth.uid() = user_id);
create policy "workout_sessions_insert_own" on public.workout_sessions for insert with check (auth.uid() = user_id);
create policy "workout_sessions_update_own" on public.workout_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workout_sessions_delete_own" on public.workout_sessions for delete using (auth.uid() = user_id);

-- Run sessions
create policy "run_sessions_select_own" on public.run_sessions for select using (auth.uid() = user_id);
create policy "run_sessions_insert_own" on public.run_sessions for insert with check (auth.uid() = user_id);
create policy "run_sessions_update_own" on public.run_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "run_sessions_delete_own" on public.run_sessions for delete using (auth.uid() = user_id);

-- Daily check-ins
alter table public.daily_checkins enable row level security;
create policy "daily_checkins_select_own" on public.daily_checkins for select using (auth.uid() = user_id);
create policy "daily_checkins_insert_own" on public.daily_checkins for insert with check (auth.uid() = user_id);
create policy "daily_checkins_update_own" on public.daily_checkins for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_checkins_delete_own" on public.daily_checkins for delete using (auth.uid() = user_id);

-- v1.3 — execução real de séries/cargas
alter table public.workout_exercise_sets enable row level security;
drop policy if exists "workout_exercise_sets_select_own" on public.workout_exercise_sets;
create policy "workout_exercise_sets_select_own" on public.workout_exercise_sets for select using (auth.uid() = user_id);
drop policy if exists "workout_exercise_sets_insert_own" on public.workout_exercise_sets;
create policy "workout_exercise_sets_insert_own" on public.workout_exercise_sets for insert with check (auth.uid() = user_id);
drop policy if exists "workout_exercise_sets_update_own" on public.workout_exercise_sets;
create policy "workout_exercise_sets_update_own" on public.workout_exercise_sets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "workout_exercise_sets_delete_own" on public.workout_exercise_sets;
create policy "workout_exercise_sets_delete_own" on public.workout_exercise_sets for delete using (auth.uid() = user_id);

-- v1.5 — integrações e métricas de relógio
alter table public.health_integrations enable row level security;
alter table public.wearable_daily_metrics enable row level security;

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
