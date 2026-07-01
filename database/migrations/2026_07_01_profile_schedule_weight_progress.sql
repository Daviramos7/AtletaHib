-- Execute este arquivo se você já rodou uma versão anterior do schema.sql.
-- Ele adiciona os campos novos do perfil sem apagar dados existentes.

alter table public.profiles
  add column if not exists dietary_restriction text not null default 'Nenhuma restrição informada.',
  add column if not exists lunch_time time not null default '12:30',
  add column if not exists training_time time not null default '18:00',
  add column if not exists routine_notes text not null default 'Rotina ainda não personalizada.';

update public.profiles
set
  dietary_restriction = coalesce(nullif(dietary_restriction, ''), 'Nenhuma restrição informada.'),
  lunch_time = coalesce(lunch_time, '12:30'),
  training_time = coalesce(training_time, '18:00'),
  routine_notes = coalesce(nullif(routine_notes, ''), 'Rotina ainda não personalizada.')
where true;
