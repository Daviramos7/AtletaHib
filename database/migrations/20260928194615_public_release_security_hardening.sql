-- Public-release hardening: least privilege and cross-user FK ownership.
-- This migration changes permissions and validation only; it does not modify user data.

alter function public.set_updated_at() set search_path = public;

create or replace function public.validate_training_day_plan_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_user_id uuid;
begin
  select user_id into parent_user_id
  from public.training_plans
  where id = new.plan_id;

  if parent_user_id is null or parent_user_id <> new.user_id then
    raise exception 'Invalid training plan ownership link.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_exercise_entry_day_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_user_id uuid;
begin
  select user_id into parent_user_id
  from public.training_days
  where id = new.training_day_id;

  if parent_user_id is null or parent_user_id <> new.user_id then
    raise exception 'Invalid training day ownership link.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_workout_session_day_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_user_id uuid;
begin
  if new.training_day_id is null then
    return new;
  end if;

  select user_id into parent_user_id
  from public.training_days
  where id = new.training_day_id;

  if parent_user_id is null or parent_user_id <> new.user_id then
    raise exception 'Invalid workout training day ownership link.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_workout_set_owner_links()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_user_id uuid;
begin
  select user_id into parent_user_id
  from public.workout_sessions
  where id = new.workout_session_id;
  if parent_user_id is null or parent_user_id <> new.user_id then
    raise exception 'Invalid workout session ownership link.' using errcode = '23514';
  end if;

  if new.training_day_id is not null then
    parent_user_id := null;
    select user_id into parent_user_id
    from public.training_days
    where id = new.training_day_id;
    if parent_user_id is null or parent_user_id <> new.user_id then
      raise exception 'Invalid set training day ownership link.' using errcode = '23514';
    end if;
  end if;

  if new.exercise_entry_id is not null then
    parent_user_id := null;
    select user_id into parent_user_id
    from public.exercise_entries
    where id = new.exercise_entry_id;
    if parent_user_id is null or parent_user_id <> new.user_id then
      raise exception 'Invalid set exercise ownership link.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_training_day_plan_owner on public.training_days;
create trigger validate_training_day_plan_owner
before insert or update of user_id, plan_id on public.training_days
for each row execute function public.validate_training_day_plan_owner();

drop trigger if exists validate_exercise_entry_day_owner on public.exercise_entries;
create trigger validate_exercise_entry_day_owner
before insert or update of user_id, training_day_id on public.exercise_entries
for each row execute function public.validate_exercise_entry_day_owner();

drop trigger if exists validate_workout_session_day_owner on public.workout_sessions;
create trigger validate_workout_session_day_owner
before insert or update of user_id, training_day_id on public.workout_sessions
for each row execute function public.validate_workout_session_day_owner();

drop trigger if exists validate_workout_set_owner_links on public.workout_exercise_sets;
create trigger validate_workout_set_owner_links
before insert or update of user_id, workout_session_id, training_day_id, exercise_entry_id
on public.workout_exercise_sets
for each row execute function public.validate_workout_set_owner_links();

-- The unauthenticated client has no reason to access personal tables directly.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;

-- Authenticated clients need row CRUD, never schema-shaping table privileges.
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke insert, update, delete on table public.run_sessions from authenticated;

-- Trigger helpers are internal. Only the authenticated water RPC is callable.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.increment_daily_water(uuid, date, integer) to authenticated;

-- Keep future objects at the same least-privilege baseline.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;
