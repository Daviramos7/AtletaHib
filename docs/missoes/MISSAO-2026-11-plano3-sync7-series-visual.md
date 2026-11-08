# MISSÃO — Atleta Hib: plano de 3 treinos, sync de 7 dias, séries ajustáveis e correção visual

Executor: Claude Code, na raiz do repositório
(`C:\Users\davir\OneDrive\Documentos\GitHub\AtletaHib`).
Stack: React 19 + TS + Vite (Web/PWA), Kotlin/Compose (`android_bridge/`), Supabase com RLS.
Escrita em 07/11/2026.

## Achados já confirmados (não precisa reinvestigar)
- **O `main` local está 2 commits atrás do `origin/main`.** Falta a reformulação UX
  (`3ee9c92`) e o índice visual (`8dae673`). Rode `git pull` no `main` antes de criar a branch.
- **O sync de 7 dias foi removido na reformulação de outubro.** No `0ae9190`, a
  `MainActivity.kt` tinha `onSync(7)`. No `origin/main` só existe `onSync(1)`. O
  `SyncCoordinator.kt` ainda aceita `days.size in 1..7`, então a correção deve ser só
  de UI, sem mexer em sync.
- Os prompts de extração existem em `prompts/`: `food-image-reader.md`,
  `sleep-image-reader.md`, `cardio-image-reader.md` e `strength-wearable-image-reader.md`
  (mais o `README.md`).
- Existem worktrees antigas do AgentGrid em `.agent-grid/worktrees/`
  (`ux-ui-baseline`, `ux-ui-reformulation` e `ux-ui-v2`), todas marcadas como prunable.
  Não apague, não use e não faça prune sem o OK do Davi.
- `CARDIO_RECOMMENDED_CAP_SECONDS` aparece em `src/domain/cardioRules.ts` e em
  `src/domain/dataQualityRules.ts`.

## Skills e agentes desta rodada
A biblioteca fica em `C:\Users\davir\skills-biblioteca\` (veja `CATALOGO.md`). Siga a regra
do catálogo: só ative uma skill com o OK do Davi, usando
`powershell -File C:\Users\davir\skills-biblioteca\usar-skill.ps1 -Skill <pasta> -Projeto <raiz>`.
Já ativas globalmente (em `~/.agents/skills`), use sem pedir:
- `frontend-design` e `web-design-guidelines` na Fase 4.
- `code-review`, nativa, para revisão rápida ao fim de cada fase.
Ativação AUTORIZADA pelo Davi em 07/11/2026 (rode o `usar-skill.ps1` no início da Fase 0 e reabra a sessão se precisar):
- `ponta-a-ponta-com-personas`: Playwright para os screenshots antes/depois em 360, 390, 412
  e 1440 px na Fase 4 e para o fluxo de + e − série na Fase 2.
- `revisor-de-codigo`: revisão final antes do merge (código de outro agente, regra do catálogo).
- `migrations-sem-susto`: ativar SOMENTE se a Fase 1 exigir migration (autorizado nesse caso).
Não use: `nextjs-boas-praticas` (o projeto não é Next) nem as skills de vídeo.
Agentes: use no máximo um subagente `Explore` na Fase 0 para a varredura. Não abra
agentes em paralelo fazendo a mesma coisa. Não use o AgentGrid nesta rodada.

## Regras gerais (valem para todas as fases)
- Inspecione antes de mudar. Quando este documento divergir do código, vale o código.
- Comece com `git status`, `git pull` no `main` e só então crie a branch `feat/plano-3-treinos`.
- NÃO faça deploy, push para o `main`, migration em produção ou alteração remota no Supabase
  sem o OK do Davi.
- Preserve a separação de camadas: regras em `src/domain/`, persistência em `src/services/`
  e UI em `src/components/`.
- Preserve estes contratos:
  - planejado ≠ realizado;
  - ausência ≠ zero;
  - sem dupla contagem (`counts_toward_daily_totals`, `counts_toward_progression`);
  - RLS intacta.
- Não invente resultado de teste. Filtre a saída e mostre só as falhas e a contagem.
- Ao fim de CADA fase, PARE e informe: o que mudou, o que testou (resultado real) e o que
  ficou pendente. Só avance com o OK do Davi. Commit pequeno por fase.

## FASE 0 — Diagnóstico (sem alterar código)
1. Verifique se o Supabase está ativo. Em outubro ele pausou por inatividade (free tier). Se
   estiver pausado, avise e pare.
2. Mapeie onde vive cada parte:
   - template semanal de 4 sessões (Superior A, Inferior A, Superior B, Inferior B);
   - fila semanal (`weeklyGym.ts`, `gymSession.ts`, `adaptiveWorkout.ts`);
   - onde o plano é salvo por usuário (banco ou código);
   - registro de séries (`exerciseTracking.ts`, `workoutDraft.ts`, `GymModeView.tsx`).
3. Rode a baseline, depois do pull:
   - na raiz: `pnpm run lint`, `pnpm run typecheck`, `pnpm test` e `pnpm run build`;
   - em `android_bridge`: `.\gradlew.bat :app:testDebugUnitTest`.
Entregue um relatório curto. PARE.

## FASE 1 — Novo plano semanal (3 treinos)
O template de 4 sessões (Seg, Ter, Qui e Sex, de 40 a 50 min) sai do app e entra este:

**TERÇA — Inferior** (referência: 17h00 às 18h30)
- ~60 min de musculação de inferiores.
- Cardio LEVE de 15 a 20 min no final: bike ou esteira inclinada, sem tiro.

**QUARTA — Superior** (referência: 20h30 às 22h00)
- ~60 min de musculação de superiores.
- Cardio MODERADO de 20 a 25 min.

**SEXTA — Full body** (referência: 21h15 às 22h45; a academia fecha às 23h)
- Musculação + cardio.
- Marque cada exercício como principal ou acessório. Se o tempo apertar, corte acessórios e
  cardio, nunca os principais.

**Demais dias:** Seg, Qui, Sáb e Dom ficam sem treino.

Valem para todas as sessões:
- Duração alvo de até 90 min.
- Cardio é uma ETAPA FIXA da sessão, com duração e intensidade próprias de cada dia. Pode ser
  registrado como pulado, mas nunca inventado.
- Objetivo: emagrecer mantendo força.

**Regras da semana:**
- Treino perdido NÃO é compensado nem empilhado. A semana seguinte começa sem dívida.
- A meta base é de 3 treinos. Uma semana com 2 treinos (prova, doença, viagem, pouco sono) é
  válida e não aparece como atraso. Não programe exceções de datas no código.

**Exercícios:** NÃO invente listas. Monte o ponto de partida com o `exerciseCatalog.ts` e
garanta edição pelo app (`PlanEditorView`/`PlanBuilderView`). Relate o que colocou.

**Teto do cardio:** hoje `CARDIO_RECOMMENDED_CAP_SECONDS = 20 * 60`, e a quarta pede até
25 min. Proponha a mudança mínima, com os testes afetados, e só implemente com OK.

**Dados:** não apague histórico. Sessões antigas continuam válidas. Se precisar de migration,
mostre o SQL antes.

Teste o novo template e a regra de "sem dívida". PARE.

## FASE 2 — Botões de + série e − série durante o treino
Antes de tudo, veja se algo parecido já existe. Em `GymModeView`:
- "+ série" acrescenta uma série, sugerindo a carga e as reps da última série feita.
- "− série" remove uma série vazia. Se a série já tiver dados, peça confirmação.
- Vale também para exercício por tempo (duração em segundos).
- O botão altera o REALIZADO, não o plano base.
- Área de toque de pelo menos 44 px, acessível e funcionando em 360 px.
Teste: adicionar, remover e persistir. PARE.

## FASE 3 — Android: botão "Sincronizar últimos 7 dias"
1. Restaure, ao lado de "Sincronizar hoje", o botão que chama `onSync(7)`, no layout novo
   da reformulação. Atualize `BridgeScreenTest.kt` e `strings.xml`.
2. Confira no `git log` do `3ee9c92` se a remoção teve algum motivo técnico. Se teve, explique
   antes de reverter.
3. Mantenha: deduplicação, comparar antes de gravar, métrica ausente não apaga valor salvo,
   falha parcial informada como parcial e progresso visível.
4. Rode `.\gradlew.bat :app:testDebugUnitTest :app:lint :app:assembleDebug` e informe o
   caminho do APK. PARE.

## FASE 4 — Correção visual (cards cortados e sobrepostos)
**Problema real no celular:**
- cards batendo uns nos outros;
- cards cortados, sem o conteúdo aparecer inteiro;
- botões saindo dos limites;
- card dentro de card.

**Passos:**
1. Faça screenshots ANTES das telas Hoje, Registrar, Academia, Progresso, Saúde, Perfil e
   Onboarding, em 360, 390, 412 e 1440 px, com dados sintéticos e nunca dados reais.
2. Ache a causa estrutural. Suspeitos:
   - altura fixa;
   - `overflow: hidden`;
   - grid sem `minmax(0,1fr)`;
   - `min-width` em flex;
   - `position: absolute`;
   - padding acumulado de card aninhado.
   É proibido "resolver" escondendo conteúdo.
3. Reduza card dentro de card. Use seções abertas, títulos, divisórias e listas. Card só fica
   onde agrupar ajuda. Priorize a Academia, que muda com o plano novo.
4. Nada de domínio nem de Supabase nesta fase.
5. Faça screenshots DEPOIS nas mesmas larguras, lado a lado com o ANTES, em
   `evidence/ux-v3/`. Rode lint, typecheck, test e build.
NÃO publique. PARE para o Davi aprovar.

## Entrega final
Para cada fase, informe:
- arquivos alterados;
- testes rodados e o resultado real;
- pendências e riscos;
- commits.
Rode o `revisor-de-codigo` no diff inteiro. Nada vai para produção sem OK.
