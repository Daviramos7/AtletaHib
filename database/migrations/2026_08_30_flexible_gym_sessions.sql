-- Academia flexível: fila semanal derivada e uma ida à academia como sessão lógica.
-- NÃO executar automaticamente. Revisar e aplicar no Supabase antes de publicar o frontend.

alter table public.workout_sessions add column if not exists session_status text not null default 'active';
alter table public.workout_sessions add column if not exists strength_status text not null default 'active';
alter table public.workout_sessions add column if not exists cardio_status text not null default 'not_planned';
alter table public.workout_sessions add column if not exists selection_kind text not null default 'manual';
alter table public.workout_sessions add column if not exists session_local_date date;
alter table public.workout_sessions add column if not exists strength_completed_at timestamptz;
alter table public.workout_sessions add column if not exists completed_at timestamptz;
alter table public.workout_sessions add column if not exists strength_plan jsonb not null default '[]'::jsonb;
alter table public.workout_sessions add column if not exists cardio_plan jsonb not null default '{}'::jsonb;

update public.workout_sessions
set
  session_status = case when completed then 'completed' else 'legacy' end,
  strength_status = case when completed then 'completed' else 'active' end
where session_status = 'active'
  and strength_status = 'active'
  and cardio_status = 'not_planned'
  and selection_kind = 'manual'
  and session_local_date is null
  and strength_completed_at is null
  and completed_at is null
  and strength_plan = '[]'::jsonb
  and cardio_plan = '{}'::jsonb;

-- Compatibilidade com o cliente anterior: ele podia inserir completed=true ou
-- criar a linha com os defaults e depois alterar somente completed para true.
-- Qualquer transição moderna fora dessa assinatura continua sob a constraint.
create or replace function public.normalize_legacy_workout_session_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.completed = true
      and new.session_status = 'active'
      and new.strength_status = 'active'
      and new.cardio_status = 'not_planned'
      and new.selection_kind = 'manual'
      and new.session_local_date is null
      and new.strength_completed_at is null
      and new.completed_at is null
      and new.strength_plan = '[]'::jsonb
      and new.cardio_plan = '{}'::jsonb then
      new.session_status := 'completed';
      new.strength_status := 'completed';
    end if;
  elsif tg_op = 'UPDATE' then
    if old.completed = false
      and new.completed = true
      and old.session_status = 'active'
      and old.strength_status = 'active'
      and old.cardio_status = 'not_planned'
      and old.selection_kind = 'manual'
      and old.session_local_date is null
      and old.strength_completed_at is null
      and old.completed_at is null
      and old.strength_plan = '[]'::jsonb
      and old.cardio_plan = '{}'::jsonb
      and (to_jsonb(new) - 'completed') = (to_jsonb(old) - 'completed') then
      new.session_status := 'completed';
      new.strength_status := 'completed';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_legacy_workout_session_lifecycle on public.workout_sessions;
create trigger normalize_legacy_workout_session_lifecycle
before insert or update on public.workout_sessions
for each row execute function public.normalize_legacy_workout_session_lifecycle();

do $$ begin
  alter table public.workout_sessions
    add constraint workout_sessions_session_status_check
    check (session_status in ('active', 'strength_completed', 'completed', 'legacy'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.workout_sessions
    add constraint workout_sessions_lifecycle_coherence_check
    check (
      (completed = false and session_status = 'legacy' and strength_status = 'active' and cardio_status = 'not_planned')
      or (completed = false and session_status = 'active' and strength_status = 'active' and cardio_status = 'not_planned')
      or (completed = false and session_status = 'strength_completed' and strength_status = 'completed'
        and cardio_status in ('not_planned', 'pending', 'awaiting_import', 'completed', 'skipped'))
      or (completed = true and session_status = 'completed' and strength_status = 'completed'
        and cardio_status in ('not_planned', 'awaiting_import', 'completed', 'skipped'))
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.workout_sessions
    add constraint workout_sessions_strength_status_check
    check (strength_status in ('active', 'completed'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.workout_sessions
    add constraint workout_sessions_cardio_status_check
    check (cardio_status in ('not_planned', 'pending', 'awaiting_import', 'completed', 'skipped'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.workout_sessions
    add constraint workout_sessions_selection_kind_check
    check (selection_kind in ('recommended', 'manual', 'extra'));
exception when duplicate_object then null;
end $$;

alter table public.cardio_sessions add column if not exists workout_session_id uuid;
alter table public.cardio_sessions add column if not exists distance_source text;

do $$ begin
  alter table public.cardio_sessions
    add constraint cardio_sessions_workout_session_fk
    foreign key (workout_session_id) references public.workout_sessions(id) on delete set null;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.cardio_sessions
    add constraint cardio_sessions_distance_source_check
    check (distance_source is null or distance_source in ('treadmill', 'wearable', 'manual'));
exception when duplicate_object then null;
end $$;

create index if not exists idx_workout_sessions_user_week
  on public.workout_sessions(user_id, session_local_date, training_day_id);
create index if not exists idx_workout_sessions_user_lifecycle
  on public.workout_sessions(user_id, session_status, cardio_status, performed_at desc);
create index if not exists idx_cardio_sessions_workout_session
  on public.cardio_sessions(workout_session_id);

-- A coluna do wearable já existia antes desta migration. Caso algum vínculo
-- legado tenha sido criado sem validação de usuário, preserve o import e apenas
-- remova a relação insegura antes de instalar o trigger.
update public.wearable_workout_sessions wearable
set workout_session_id = null
from public.workout_sessions workout
where wearable.workout_session_id = workout.id
  and wearable.user_id <> workout.user_id;

create or replace function public.validate_gym_session_link()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  linked_user_id uuid;
begin
  if new.workout_session_id is null then
    return new;
  end if;

  select user_id into linked_user_id
  from public.workout_sessions
  where id = new.workout_session_id;

  if linked_user_id is null or linked_user_id <> new.user_id then
    raise exception 'Vínculo inválido: a sessão e o registro importado devem pertencer ao mesmo usuário.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_cardio_gym_session_link on public.cardio_sessions;
create trigger validate_cardio_gym_session_link
before insert or update of workout_session_id, user_id on public.cardio_sessions
for each row execute function public.validate_gym_session_link();

drop trigger if exists validate_strength_gym_session_link on public.wearable_workout_sessions;
create trigger validate_strength_gym_session_link
before insert or update of workout_session_id, user_id on public.wearable_workout_sessions
for each row execute function public.validate_gym_session_link();

alter table public.workout_sessions enable row level security;
alter table public.cardio_sessions enable row level security;
alter table public.wearable_workout_sessions enable row level security;

comment on column public.training_days.weekday is
  'Dia preferencial da sessão. A fila semanal da Academia não trata este campo como obrigação.';
comment on column public.workout_sessions.strength_plan is
  'Snapshot mecânico planejado no início da sessão; não é sobrescrito pelo wearable.';
comment on column public.workout_sessions.cardio_plan is
  'Snapshot da prescrição de cardio. A execução real permanece em cardio_sessions.';
comment on column public.cardio_sessions.workout_session_id is
  'Relação opcional com a ida à Academia; o registro de cardio continua independente.';
