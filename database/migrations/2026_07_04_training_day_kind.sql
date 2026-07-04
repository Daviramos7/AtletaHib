-- v3.2 — Plano explícito e estável
-- O frontend passa a usar day_kind/cardio_required/cardio_options em vez de tentar adivinhar por texto.

alter table public.training_days
  add column if not exists day_kind text,
  add column if not exists cardio_required boolean not null default false,
  add column if not exists cardio_options jsonb not null default '[]'::jsonb;

alter table public.training_days
  drop constraint if exists training_days_day_kind_check;

alter table public.training_days
  add constraint training_days_day_kind_check
  check (day_kind is null or day_kind in ('strength','cardio','strength_cardio','rest'));

update public.training_days
set day_kind = case
  when lower(coalesce(type, '')) in ('forca_corrida', 'forca_z2', 'strength_cardio') then 'strength_cardio'
  when lower(coalesce(type, '')) in ('corrida', 'futebol', 'cardio_leve', 'cardio') then 'cardio'
  when lower(coalesce(type, '')) in ('descanso', 'rest', 'recovery') then 'rest'
  else 'strength'
end
where day_kind is null;

update public.training_days
set cardio_required = day_kind in ('cardio', 'strength_cardio')
where true;

update public.training_days
set cardio_options = case
  when day_kind = 'cardio' and lower(coalesce(type, '')) = 'futebol' then
    '[{"label":"Futebol recreativo","description":"40-60min · Aqueça antes."},{"label":"Alternativa: caminhada/trote leve","description":"20-30min · Sem tiro forte se estiver cansado."}]'::jsonb
  when day_kind = 'cardio' then
    '[{"label":"Cardio planejado","description":"Faça de forma controlada."}]'::jsonb
  when day_kind = 'strength_cardio' then
    '[{"label":"Cardio pós-treino","description":"10-20min leve, se couber na rotina."}]'::jsonb
  else '[]'::jsonb
end
where cardio_options = '[]'::jsonb or cardio_options is null;

create index if not exists idx_training_days_user_day_kind on public.training_days(user_id, day_kind);
