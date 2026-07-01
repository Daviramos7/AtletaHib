-- v1.4 — Onboarding multiusuário e remoção de defaults específicos de uma pessoa.
-- Execute no Supabase SQL Editor se já rodou versões anteriores.

alter table public.profiles
  add column if not exists starting_weight_kg numeric(6,2),
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists training_level text not null default 'iniciante',
  add column if not exists main_goal text not null default 'saude',
  add column if not exists weekly_strength_days integer not null default 3,
  add column if not exists weekly_cardio_days integer not null default 2,
  add column if not exists plays_football boolean not null default false,
  add column if not exists diet_style text not null default 'flexivel',
  add column if not exists wearable_provider text not null default 'none';

alter table public.profiles
  alter column name set default '',
  alter column height_cm set default 170,
  alter column current_weight_kg set default 80,
  alter column target_weight_kg set default 75,
  alter column kcal_goal set default 2200,
  alter column water_goal_ml set default 2500,
  alter column dietary_restriction set default 'Nenhuma restrição informada.',
  alter column lunch_time set default '12:30',
  alter column training_time set default '18:00',
  alter column routine_notes set default 'Rotina ainda não personalizada.',
  alter column objective set default 'Melhorar saúde, condicionamento e consistência.';

update public.profiles
set starting_weight_kg = coalesce(starting_weight_kg, current_weight_kg)
where starting_weight_kg is null;

alter table public.profiles
  alter column starting_weight_kg set not null,
  alter column starting_weight_kg set default 80;

alter table public.profiles
  drop constraint if exists profiles_weekly_strength_days_range,
  add constraint profiles_weekly_strength_days_range check (weekly_strength_days between 1 and 7),
  drop constraint if exists profiles_weekly_cardio_days_range,
  add constraint profiles_weekly_cardio_days_range check (weekly_cardio_days between 0 and 7);

-- Não força onboarding em perfis já existentes para não bloquear usuários antigos.
-- Usuários novos sem perfil entrarão na tela de onboarding antes do dashboard.
