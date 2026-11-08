-- MIGRATION NECESSÁRIA — NÃO APLICADA. Revisar e aplicar no Supabase ANTES de publicar o frontend.
--
-- O quê: colunas opcionais em training_days para o plano de 3 treinos
--   (Ter Inferior, Qua Superior, Sex Full body), com cardio como etapa fixa da sessão.
-- Por quê:
--   1. A fila semanal reconhecia a sessão pelo título ("Superior A", "Inferior B").
--      Renomear um dia no editor mudava a ordem e a leitura de recuperação.
--      session_split e sequence_order passam a ser a identidade estável.
--   2. Cada dia tem duração-alvo (até 90 min) e prescrição de cardio própria
--      (Ter leve 15–20, Qua moderado 20–25). Antes isso só existia em texto livre.
-- Substitui: nada. Colunas novas, todas nullable, sem default e sem backfill.
--   Planos antigos ficam com null e o código deriva split/ordem dos exercícios e do weekday.
-- Compatibilidade:
--   - código antigo + banco novo: ignora as colunas. OK.
--   - código novo + banco antigo: o insert de plano novo falharia. Por isso o banco sobe primeiro.
-- Sem volta: nada destrutivo. Para desfazer, basta "drop column" das 6 colunas
--   (perde só a prescrição dos planos gerados depois desta migration).
-- RLS: training_days já tem RLS por user_id; nenhuma policy é criada ou alterada.

begin;

alter table public.training_days
  add column if not exists session_split text,
  add column if not exists sequence_order smallint,
  add column if not exists target_minutes smallint,
  add column if not exists cardio_min_minutes smallint,
  add column if not exists cardio_max_minutes smallint,
  add column if not exists cardio_intensity text;

do $$ begin
  alter table public.training_days
    add constraint training_days_session_split_check
    check (session_split is null or session_split in ('upper', 'lower', 'full_body'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.training_days
    add constraint training_days_sequence_order_check
    check (sequence_order is null or sequence_order between 1 and 14);
exception when duplicate_object then null;
end $$;

-- 90 é o teto da sessão inteira (força + cardio), não do cardio.
do $$ begin
  alter table public.training_days
    add constraint training_days_target_minutes_check
    check (target_minutes is null or target_minutes between 20 and 90);
exception when duplicate_object then null;
end $$;

-- O teto RECOMENDADO de cardio (25 min) vive no código (CARDIO_RECOMMENDED_CAP_SECONDS),
-- não aqui: o banco só barra valor absurdo, para não exigir migration a cada ajuste de regra.
do $$ begin
  alter table public.training_days
    add constraint training_days_cardio_minutes_check
    check (
      (cardio_min_minutes is null or cardio_min_minutes between 1 and 90)
      and (cardio_max_minutes is null or cardio_max_minutes between 1 and 90)
      and (cardio_min_minutes is null or cardio_max_minutes is null or cardio_min_minutes <= cardio_max_minutes)
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.training_days
    add constraint training_days_cardio_intensity_check
    check (cardio_intensity is null or cardio_intensity in ('leve', 'moderado'));
exception when duplicate_object then null;
end $$;

comment on column public.training_days.session_split is
  'Identidade estável da sessão: upper, lower ou full_body. Substitui a leitura pelo título.';
comment on column public.training_days.sequence_order is
  'Ordem lógica da sessão na semana. Null em planos antigos: o app usa o weekday.';
comment on column public.training_days.target_minutes is
  'Duração-alvo da sessão inteira (força + cardio), até 90 min.';
comment on column public.training_days.cardio_min_minutes is
  'Prescrição mínima do cardio fixo da sessão. A execução real fica em cardio_sessions.';
comment on column public.training_days.cardio_max_minutes is
  'Prescrição máxima do cardio fixo da sessão. A execução real fica em cardio_sessions.';
comment on column public.training_days.cardio_intensity is
  'Intensidade prescrita do cardio fixo: leve ou moderado.';

commit;
