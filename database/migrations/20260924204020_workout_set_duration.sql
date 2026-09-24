-- MIGRATION NECESSÁRIA — NÃO APLICADA.
-- No backfill: legacy reps/load values do not prove an actual duration.
begin;
alter table public.workout_exercise_sets
  add column if not exists duration_seconds integer;
alter table public.workout_exercise_sets
  add constraint workout_exercise_sets_duration_valid
  check (duration_seconds is null or (duration_seconds between 1 and 86400 and reps = 0 and load_kg = 0));
comment on column public.workout_exercise_sets.duration_seconds is
  'Actual timed-set duration in seconds. Null means not recorded; never inferred from historical reps or load.';
commit;
