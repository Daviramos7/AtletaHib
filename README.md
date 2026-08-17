<p align="center">
  <img src="logos/atleta-hib-logo-horizontal.png" alt="Atleta Hib" width="460" />
</p>

<p align="center">
  <strong>Atleta Hib v4.1.2</strong><br />
  Treino, alimentação, recuperação e progresso com uma única fonte de verdade.
</p>

## Visão geral

O Atleta Hib é uma aplicação web responsiva/PWA acompanhada por um aplicativo Android nativo que conecta o Health Connect ao Supabase. Cada usuário possui autenticação e dados isolados por RLS.

A versão 4.1.2 consolida a identidade visual, padroniza os componentes de interface e encerra a divisão entre `run_sessions` e `cardio_sessions` no produto.

## O que está disponível

- Painel diário orientado por treino, prontidão e qualidade dos dados.
- Registro de refeições com kcal e macros opcionais sem converter ausência em zero.
- Hidratação com atualização atômica no banco.
- Cardio manual, planejado ou importado em um único histórico.
- Treino de força por série, com carga, repetições, RPE, volume e estimativa de 1RM.
- Academia adaptativa: o treino-base é ajustado de forma determinística por check-in, sono, carga muscular real, dor, pausa e tempo disponível.
- Sono corrigido e dados de wearable com origem explícita.
- Check-in separado entre manhã e fechamento do dia.
- Peso, tendências semanais e revisão com janela temporal limitada.
- Central de importação JSON com validação de data, confiança e deduplicação.
- Android Health Connect Bridge para Mi Fitness e outras fontes compatíveis.

## Princípios de integridade

- Data de negócio usa o calendário local do usuário.
- Dado ausente permanece ausente; não vira `0` automaticamente.
- Sessões importadas de cardio não somam novamente nos totais diários.
- Calorias de uma sessão são detalhe e podem já existir no Health Connect.
- Recomendações de cardio respeitam o limite de 20 minutos, sem alterar o valor real registrado.
- Wearables apoiam o acompanhamento, mas não produzem diagnóstico.
- Painel, check-in e relatório semanal consomem a mesma camada de verdade diária.

## Stack

### Web

- React 19, TypeScript e Vite.
- Supabase Auth, PostgreSQL e Row Level Security.
- Vitest e ESLint.
- PWA com manifest e service worker.

### Android

- Kotlin e Jetpack Compose.
- Health Connect.
- Ktor e Kotlin Serialization.
- Supabase REST com sessão persistida localmente.

## Como executar o site

Requisitos: Node.js 20+ e um projeto Supabase.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configure:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

Comandos de validação:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Para executar tudo exceto os testes unitários:

```bash
npm run prod:check
```

## Banco de dados

Em uma instalação nova, execute primeiro:

```text
database/schema.sql
database/policies.sql
```

Depois aplique as migrations de `database/migrations` em ordem cronológica. Em uma instalação existente que já está na v4.1.1, a migration nova obrigatória é:

```text
database/migrations/2026_07_13_unify_cardio_sessions.sql
```

Ela copia de forma idempotente os registros antigos de `run_sessions` para `cardio_sessions`. A tabela antiga é preservada como reserva histórica, mas o aplicativo deixa de ler e gravar nela.

Para habilitar o treino adaptativo, aplique também:

```text
database/migrations/2026_08_16_adaptive_workout.sql
```

Essa migration adiciona campos opcionais de recuperação, tempo e localização de dor ao check-in, o papel explícito de cada exercício (`main`, `secondary` ou `accessory`) e um resumo compacto da recomendação na sessão executada. Registros antigos continuam válidos; nenhuma tabela ou policy RLS nova é criada.

## Academia adaptativa

- O check-in da manhã é exigido somente para gerar ou iniciar a recomendação de hoje; plano, histórico e editor continuam acessíveis.
- O usuário pode escolher explicitamente o treino-base.
- Painel e modo academia usam o mesmo cálculo canônico de prontidão, inclusive para sono corrigido, dor e carga recente.
- O motor usa apenas séries realmente concluídas nas últimas 48–72 horas e o contexto independente dos últimos 7 dias.
- Sono corrigido do dia de despertar tem prioridade e métrica ausente não vira zero.
- O tempo recomendado considera séries, descansos, preparação, transições e cardio; a sessão adaptada cabe no tempo informado, com teto operacional de 50 minutos e no máximo 20 minutos de cardio.
- A redução por tempo remove primeiro o cardio e depois volume/acessórios, preservando os exercícios principais enquanto houver espaço.
- O papel de cada exercício é persistido no plano; planos antigos usam uma compatibilidade determinística sem depender da posição na lista.
- A rotina padrão de quatro dias usa `Superior A`, `Inferior A`, `Superior B` e `Inferior B` na segunda, terça, quinta e sexta, sem repetir o mesmo grupo principal em dias consecutivos.
- Uma sessão iniciada mantém o mesmo identificador, data, recomendação e rascunho mesmo após recarregar a página ou atravessar a meia-noite.
- Sessões com volume restringido não são tratadas como regressão e não liberam progressão agressiva; a comparação volta à última sessão normal comparável.

## Aplicativo Android

O projeto nativo fica em `android_bridge`.

1. Copie `android_bridge/gradle.properties.example` para `android_bridge/gradle.properties`.
2. Preencha `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`.
3. Abra `android_bridge` no Android Studio ou compile pelo terminal:

```powershell
cd android_bridge
.\gradlew.bat :app:assembleDebug
```

O aplicativo usa a mesma conta do site. A senha não é armazenada; a sessão é renovada por refresh token. As permissões do Health Connect podem ser concedidas de forma completa ou básica.

## Identidade visual e design system

Os arquivos oficiais estão em `logos/`. As cópias usadas pelo site ficam em `public/branding` e pelo Android em `android_bridge/app/src/main/res/drawable-nodpi`.

A base compartilhada da interface web está em:

- `src/components/ui/index.tsx`
- `src/styles/design-system.css`

Ela contém padrões para cards, métricas, origem e qualidade do dado, alertas, estados vazios/carregamento/erro, confirmações, cabeçalhos, formulários, linhas estatísticas e timelines.

## Prompts de importação e análise

Os contratos usados para extrair ou interpretar dados ficam em `docs/`:

- `FOOD_IMAGE_READER_PROMPT.md`
- `CARDIO_IMAGE_READER_PROMPT.md`
- `SLEEP_IMAGE_READER_PROMPT.md`
- `STRENGTH_WEARABLE_IMAGE_READER_PROMPT.md`
- `WEEKLY_REPORT_ANALYST_PROMPT.md`

## Segurança

A chave pública/anon do Supabase pode estar no cliente. A proteção real depende das políticas RLS e do uso de `auth.uid()` em todas as tabelas do usuário. Não inclua a service role no site ou no aplicativo Android e não desative RLS em produção.

## Versão

Versão atual: **4.1.2**.

Consulte `docs/audits/` para os relatórios de implementação, testes e smoke tests de cada evolução.
