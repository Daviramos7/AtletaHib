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
