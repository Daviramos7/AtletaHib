<p align="center"><img src="logos/atleta-hib-logo-horizontal.png" alt="Atleta Hib" width="420" /></p>

# Atleta Hib

Aplicação pessoal para registrar alimentação, hidratação, recuperação e treino de força com cardio. O objetivo é reunir registros manuais e dados do relógio sem misturar suas origens ou contar a mesma atividade duas vezes.

[Aplicação publicada](https://atleta-hib.vercel.app) · Versão do pacote: 4.1.2

## Organização do produto

- **Hoje:** estado do dia, prontidão, registros que faltam e atalhos.
- **Registrar:** comida, água, check-in, cardio manual e importação JSON.
- **Academia:** fila Upper/Lower flexível, recomendação, execução por série, cardio e histórico.
- **Progresso:** peso, sono, força, wearable, cardio e revisão semanal.
- **Saúde:** estado das integrações e indicadores atuais.
- **Perfil:** dados pessoais, metas e configurações.

## Arquitetura e stack

O cliente web usa React 19, TypeScript e Vite. Componentes consomem serviços Supabase; regras determinísticas ficam em `src/domain`, e os serviços preservam origem, data local e identificadores dos registros. PostgreSQL armazena os dados, Supabase Auth identifica o usuário e RLS controla o acesso. Não há servidor Node separado para iniciar localmente.

O Android Bridge usa Kotlin, Jetpack Compose, Health Connect e Ktor. O fluxo de dados é:

```text
Redmi Watch → Mi Fitness → Health Connect → Android Bridge → Supabase → Web
```

A sincronização depende das permissões e dos dados disponibilizados pelas fontes no Android. Importações JSON complementam esse fluxo, inclusive para corrigir sono divergente.

## Prompt-driven data extraction

Os contratos públicos em [`prompts/`](prompts/README.md) transformam imagens ou descrições de alimentação, sono, cardio e força do wearable em JSON para a Central JSON. O app valida estrutura, datas, limites e campos permitidos antes de persistir no Supabase; dados desconhecidos continuam ausentes e exemplos são exclusivamente sintéticos.

## Decisões técnicas

- **Prontidão determinística:** Hoje, check-in e Academia usam a camada canônica de dados; não há LLM tomando decisões de treino.
- **Fila semanal flexível:** Superior A, Inferior A, Superior B e Inferior B são acompanhados na semana de segunda a domingo. Sessões extras não aumentam a aderência-base.
- **Sessão persistente:** concluir força não significa finalizar a sessão. Cardio pode ser executado, registrado manualmente, pulado ou ficar aguardando importação. Sessões preservam início e data ao atravessar a meia-noite.
- **Planejado × realizado:** recomendação e execução permanecem separadas; séries, cargas e repetições do app não são substituídas pela fisiologia do relógio.
- **Ausência explícita:** dado ausente não vira zero, macro desconhecido continua desconhecido e alimento sem peso não ganha 100 g automaticamente.
- **Deduplicação:** sessões importadas mantêm flags de participação nos totais diários; calorias e passos já presentes no Health Connect não devem ser somados de novo.
- **Prescrição não é execução:** cardio recomendado tem teto de 20 minutos; um registro real pode ultrapassá-lo.
- **Isolamento:** consultas usam `user_id`, políticas usam `auth.uid()` e vínculos de sessões têm proteção contra referências entre usuários.

## Execução local

Requisitos: Node.js 22 LTS, pnpm e um projeto Supabase com banco compatível.

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm run dev
```

Preencha `.env.local` com a URL e a chave **pública** do seu projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publica
```

Variáveis `VITE_*` são incorporadas ao cliente. Nunca coloque chave `service_role`, chave secreta ou senha nessas variáveis.

## Banco e migrations

`database/schema.sql` e `database/policies.sql` descrevem a base consolidada. `database/migrations/` contém a evolução histórica, incluindo a Academia adaptativa (`2026_08_16_adaptive_workout.sql`) e as sessões flexíveis (`2026_08_30_flexible_gym_sessions.sql`).

Não execute todas as migrations indiscriminadamente sobre o schema consolidado: há scripts destinados a instalações antigas, inclusive à antiga tabela `run_sessions`. Confirme o histórico aplicado no projeto antes de qualquer atualização; teste o caminho escolhido em um banco descartável e mantenha backup. O replay completo em banco vazio não foi validado nesta rodada de interface. A migration histórica `2026_07_10_daily_truth_foundation.sql` contém um caractere isolado após a função e requer revisão antes de eventual replay; não foi alterada nem reaplicada.

**O polimento de interface não exige migration.** Nenhum SQL é aplicado automaticamente pelo frontend.

## Android

1. Copie `android_bridge/gradle.properties.example` para `android_bridge/gradle.properties`.
2. Configure `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`.
3. Abra `android_bridge` no Android Studio ou execute:

```powershell
cd android_bridge
.\gradlew.bat :app:assembleDebug
```

Use a mesma conta do site e conceda as permissões necessárias do Health Connect. Não versione configurações locais ou credenciais.

O companion Android está na versão 4.1.3 (o pacote Web permanece 4.1.2). Ele apresenta resultado por métrica, sincronização parcial, média diária de HR paginada e logout global. [Detalhes do Android](android_bridge/README.md).

Registro de séries por tempo usa a migration isolada `database/migrations/20260924204020_workout_set_duration.sql`, já presente no histórico remoto. Ela adiciona duração em segundos sem converter ou apagar o histórico.

## Validação

```powershell
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm test
git diff --check
```

Vitest cobre regras de domínio e contratos de persistência. `scripts/smoke-polish.mjs` verifica navegação e fluxos no navegador com dados sintéticos: intercepta as chamadas Supabase e não grava no banco real. Requer Playwright disponível (ou `PLAYWRIGHT_MODULE_PATH` apontando para uma instalação), servidor local iniciado e, opcionalmente, `SMOKE_BROWSER_PATH` para o executável do navegador. Capturas e resultados ficam no diretório temporário do sistema; `SMOKE_OUTPUT` permite escolher outro destino.

## Interface e documentação

O design system está em `src/styles/design-system.css` e `src/components/ui/index.tsx`: tokens, formulários, confirmações, estados e navegação responsiva. A identidade visual está em `logos/`, com cópias de uso em `public/branding` e no Android.

Os contratos de extração de comida, sono, cardio e força wearable ficam em [`prompts/`](prompts/README.md). Para screenshots públicos, use dados sintéticos; evite e-mail, identificadores, notas pessoais e dados de saúde reais.

## Segurança

Consulte [SECURITY.md](SECURITY.md). A chave pública não substitui RLS. Alterações de políticas e grants devem ser versionadas em `database/migrations/` e validadas com duas contas sintéticas antes de disponibilizar um novo banco.
