# Atleta Híbrido Cloud OS — v1.5 Multiusuário

Aplicação full stack/PWA para acompanhar dieta, água, peso, corrida, check-in diário, revisão semanal e evolução de força, com autenticação e dados isolados por usuário.

## Stack

- React + Vite
- TypeScript
- Supabase Auth
- PostgreSQL/Supabase
- Row Level Security por usuário
- PWA com manifest + service worker

## O que há nesta versão

### Produto

- Login/cadastro via Supabase Auth.
- Dados sincronizados entre celular e PC pelo mesmo usuário.
- Onboarding obrigatório para usuário novo criar o próprio perfil.
- Nenhum perfil pessoal é copiado para novas contas.
- Cada pessoa define nome, peso, meta, horários, objetivo, restrições alimentares, frequência de musculação/cardio e preferência de integração com relógio.
- Criador de rotina para regenerar plano de treino a partir das preferências do usuário.
- Dieta flexível com refeições, macros, alimentos personalizados e restrições alimentares.
- Água diária.
- Peso com gráfico semanal.
- Corrida/esteira para o primeiro 1 km.
- Check-in diário de sono, fome, energia, estresse, dor, passos e sintomas alimentares.
- Revisão semanal com decisão prioritária.
- Campo de preferência para integração futura com relógios/plataformas de saúde.

### Força de verdade

- TypeScript.
- Registro real de execução do treino.
- Registro por série: reps, carga, RPE e exercício.
- Volume de treino: carga x reps.
- Aba Força com evolução semanal por exercício.
- Estimativa de 1RM pela fórmula de Epley: `carga x (1 + reps / 30)`.
- Histórico dos últimos treinos salvos.

## Fluxo multiusuário

Usuário novo não recebe dados de outra pessoa. Depois do login, se não houver perfil ou se o onboarding não estiver completo, o app abre a tela de configuração inicial. Só depois disso o dashboard é liberado.

Contas antigas continuam com seus próprios dados; para regenerar um plano, use a aba Criador.

## Como rodar

```bash
npm install
cp .env.example .env
npm run dev
```

Preencha o `.env`:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

## Banco de dados

Para uma instalação nova, execute no Supabase SQL Editor:

```txt
database/schema.sql
database/policies.sql
```

Se você já estava usando uma versão anterior, execute a migration nova:

```txt
database/migrations/2026_07_01_multiuser_onboarding.sql
```

Se você pulou versões, execute também as migrations anteriores na ordem:

```txt
database/migrations/2026_07_01_profile_schedule_weight_progress.sql
database/migrations/2026_07_01_production_readiness.sql
database/migrations/2026_07_01_typescript_strength_tracking.sql
database/migrations/2026_07_01_multiuser_onboarding.sql
```

## Checks de produção

```bash
npm run lint
npm run typecheck
npm run build
```

Atalho:

```bash
npm run prod:check
```

## Deploy

Recomendado: Vercel.

1. Suba o repositório no GitHub.
2. Importe na Vercel.
3. Configure as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Rode o deploy.

## Observações de segurança

A anon key do Supabase pode ficar no front-end. A proteção real dos dados vem das políticas RLS. Não desative RLS em produção.


## v1.5 — Integrações de relógio e saúde

Esta versão adiciona uma aba **Integrações** para preparar o app para relógios e plataformas de saúde.

Funcionalidades novas:

- Configuração de dispositivo/fonte de saúde por usuário.
- Preset para **Redmi Watch 5 Active + Mi Fitness**.
- Fluxo técnico recomendado: relógio → Mi Fitness → Health Connect → app Android ponte → Supabase.
- Registro manual de dados do relógio enquanto a ponte Android não existe.
- Importação experimental de CSV/JSON exportado, usando campos como `date`, `steps`, `sleep_minutes`, `avg_heart_rate`, `resting_heart_rate`, `active_kcal`, `workout_minutes` e `distance_km`.
- Nova tabela `health_integrations`.
- Nova tabela `wearable_daily_metrics`.
- RLS aplicado para cada usuário acessar apenas suas integrações e métricas.
- Dashboard passa a exibir métricas do relógio quando houver registro do dia.

Se você já rodou versões anteriores, execute também:

```sql
database/migrations/2026_07_01_wearable_integrations.sql
```


## v1.6 — correção de onboarding e fonte

- Troca a fonte principal para Inter, com títulos menos condensados e campos mais legíveis.
- Corrige criação simultânea do `daily_logs` usando `upsert`, evitando erro de chave duplicada no onboarding/dashboard em modo dev.

Se você já configurou `.env`, mantenha seu `.env` local. Ao atualizar a versão, copie seu `.env` para a nova pasta ou substitua apenas `src/styles.css` e `src/services/dailyService.ts`.
