-- Atleta Hib v4.1.1 — fundação da verdade diária
-- Proveniência alimentar, check-in manhã/noite e hidratação atômica.

alter table public.meal_entries add column if not exists source text not null default 'manual';
alter table public.meal_entries add column if not exists import_method text not null default 'manual';
alter table public.meal_entries add column if not exists confidence text not null default 'manual_review';
alter table public.meal_entries add column if not exists dedupe_key text;

do $$ begin
  alter table public.meal_entries add constraint meal_entries_confidence_check
    check (confidence in ('low','medium','high','manual_review'));
exception when duplicate_object then null;
end $$;

create unique index if not exists meal_entries_user_dedupe_uidx
  on public.meal_entries(user_id, dedupe_key)
  where dedupe_key is not null;

alter table public.daily_checkins add column if not exists morning_notes text;
alter table public.daily_checkins add column if not exists evening_notes text;
alter table public.daily_checkins add column if not exists morning_saved_at timestamptz;
alter table public.daily_checkins add column if not exists evening_saved_at timestamptz;

update public.daily_checkins
set morning_notes = notes,
    morning_saved_at = coalesce(updated_at, created_at)
where notes is not null and morning_notes is null and evening_notes is null;

create or replace function public.increment_daily_water(
  p_user_id uuid,
  p_log_date date,
  p_delta integer
)
returns public.daily_logs
language plpgsql
security invoker
set search_path = public
as $$
declare
  result public.daily_logs;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Acesso negado para hidratação.' using errcode = '42501';
  end if;

  insert into public.daily_logs (user_id, log_date, water_ml)
  values (p_user_id, p_log_date, greatest(0, p_delta))
  on conflict (user_id, log_date)
  do update set water_ml = greatest(0, public.daily_logs.water_ml + p_delta)
  returning * into result;

  return result;
end;
$$;
c
revoke all on function public.increment_daily_water(uuid, date, integer) from public;
grant execute on function public.increment_daily_water(uuid, date, integer) to authenticated;
