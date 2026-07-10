# Atleta Hib v4.1.1 — implementação da fundação diária

Data: 2026-07-10

## Objetivo

Reduzir divergências entre telas por meio de uma visão diária única, preservar ausência como ausência e registrar a origem dos dados usados nos totais.

## Alterações

- Criada a camada `src/domain` com `buildDailyTruth(userId, date)` e regras puras para nutrição, cardio, sono, força, check-in, qualidade e revisão semanal.
- A tela Hoje, o resumo diário, a qualidade dos dados, a prontidão e o autofill de check-in passam a aceitar/usar a mesma verdade diária.
- Macros alimentares ausentes permanecem `null` e aparecem como totais parciais, não como `0g` confirmado.
- Refeições passam a guardar `source`, `import_method`, `confidence` e `dedupe_key`.
- Check-in passa a guardar notas e horários separados para manhã e fechamento.
- Incrementos rápidos de água passam por função SQL atômica.
- O relatório semanal ganhou limite superior e deixou de escolher o maior valor arbitrário entre fontes wearable.
- O rótulo enganoso “Melhor 1 km” foi substituído por “Melhor ritmo médio”.
- Uma falha no cardio após salvar força agora aciona rollback compensatório da sessão recém-criada.
- Datas de calendário impossíveis são rejeitadas.

## Migration obrigatória

Aplicar antes de publicar o front:

`database/migrations/2026_07_10_daily_truth_foundation.sql`

Sem essa migration, os novos campos de refeição/check-in e a função `increment_daily_water` não estarão disponíveis.

## Testes automatizados

Vitest foi adicionado com cenários para:

- data local e datas impossíveis;
- duração ambígua e cardio 20:08;
- comida sem data e dedupe alimentar;
- macro ausente;
- cardio sem distância e kcal fora do total;
- sono cruzando meia-noite;
- check-in manhã/fechamento;
- recomendação conservadora;
- Health Connect e fonte manual no mesmo dia;
- médias com dias ausentes e limites da janela semanal;
- montagem da verdade diária sem converter ausência em zero.

Validação consolidada: `powershell -ExecutionPolicy Bypass -File scripts/audit-v411.ps1`.

## Limites desta etapa

- `run_sessions` continua disponível como legado; sua migração definitiva fica para v4.1.2.
- O design system completo e a limpeza do CSS versionado ficam para v4.1.2.
- Retry, armazenamento criptografado e diagnóstico por métrica do Android Bridge ficam para v4.1.3.
