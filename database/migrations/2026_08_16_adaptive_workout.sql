-- Treino adaptativo diário
-- Campos opcionais preservam registros antigos. As tabelas já possuem RLS por user_id;
-- esta migration não cria novas superfícies de acesso nem altera policies existentes.

alter table public.daily_checkins add column if not exists recovery_score integer;
alter table public.daily_checkins add column if not exists available_minutes integer;
alter table public.daily_checkins add column if not exists joint_pain_locations text[];
alter table public.daily_checkins add column if not exists muscle_soreness_locations text[];

alter table public.exercise_entries add column if not exists exercise_role text;

alter table public.workout_sessions add column if not exists workout_variant text not null default 'base';
alter table public.workout_sessions add column if not exists readiness_score integer;
alter table public.workout_sessions add column if not exists adaptation_summary jsonb;

do $$ begin
  alter table public.daily_checkins
    add constraint daily_checkins_recovery_score_check
    check (recovery_score is null or recovery_score between 1 and 10);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.exercise_entries
    add constraint exercise_entries_exercise_role_check
    check (exercise_role is null or exercise_role in ('main', 'secondary', 'accessory'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.daily_checkins
    add constraint daily_checkins_available_minutes_check
    check (available_minutes is null or available_minutes between 20 and 120);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.workout_sessions
    add constraint workout_sessions_workout_variant_check
    check (workout_variant in ('base', 'adapted'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.workout_sessions
    add constraint workout_sessions_readiness_score_check
    check (readiness_score is null or readiness_score between 0 and 100);
exception when duplicate_object then null;
end $$;

comment on column public.daily_checkins.recovery_score is 'Percepção opcional de recuperação no check-in da manhã, de 1 a 10.';
comment on column public.daily_checkins.available_minutes is 'Tempo total disponível informado para a sessão do dia.';
comment on column public.daily_checkins.joint_pain_locations is 'Localizações opcionais de dor articular; não representa diagnóstico.';
comment on column public.daily_checkins.muscle_soreness_locations is 'Grupos opcionais com dor muscular percebida.';
comment on column public.exercise_entries.exercise_role is 'Prioridade explícita do exercício no plano: main, secondary ou accessory.';
comment on column public.workout_sessions.workout_variant is 'Versão efetivamente escolhida ao iniciar: base ou adaptada.';
comment on column public.workout_sessions.adaptation_summary is 'Resumo compacto e auditável da recomendação no início da sessão.';
