# Atleta Hib v4.1.2 — design system, cardio unificado e identidade

Data: 2026-07-13

## Objetivo

Transformar a fundação de integridade da v4.1.1 em uma experiência visual coesa no site e no Android, encerrando ao mesmo tempo a divisão histórica entre corridas e sessões de cardio.

## Alterações web

- Nova identidade Atleta Hib aplicada ao login, shell, favicon, PWA e navegação.
- Design system em `src/components/ui/index.tsx` e `src/styles/design-system.css`.
- Padrões disponíveis: card, métrica, origem, qualidade, alerta, vazio, loading, erro, confirmação, cabeçalhos, formulário, linha estatística e timeline.
- Cabeçalhos e métricas principais migrados em Hoje, Registrar, Dieta, Cardio, Check-in, Progresso, Sono, Semana, Integrações e Perfil.
- Confirmação de saída e exclusão de cardio deixaram de depender do diálogo nativo do navegador.
- PWA passou a armazenar a identidade v4.1.2 no cache e a publicar o símbolo como ícone instalável.
- `Dashboard.tsx` legado removido; `TodayView` permanece como painel ativo.

## Cardio

- Registros manuais agora são gravados em `cardio_sessions`.
- `runService.ts` e todas as leituras ativas de `run_sessions` foram removidos.
- Progresso e relatório semanal usam somente o histórico unificado.
- A data da semana de peso deixou de usar `toISOString().slice(0, 10)`.
- Migration idempotente: `database/migrations/2026_07_13_unify_cardio_sessions.sql`.
- A tabela antiga continua no banco apenas como reserva histórica e perde as políticas de escrita.

## Android

- Versão alinhada para 4.1.2.
- Nova logo, ícone, tema escuro, tipografia, cores e cards por etapa.
- Estados de conta e conexão ganharam hierarquia visual.
- Fluxos de login, refresh token, permissões e sincronização não foram alterados.
- Métricas ausentes aparecem como “não informado”, nunca como zero inventado.

## Documentação

- README principal reescrito para a versão atual.
- README Android atualizado.
- Caminho do Health Connect corrigido nas telas e serviços que ainda diziam que a ponte não existia.

## Validação

Execute:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/audit-v412.ps1
```

## Migration obrigatória

Antes de publicar o front v4.1.2 em um banco existente, execute no SQL Editor do Supabase:

`database/migrations/2026_07_13_unify_cardio_sessions.sql`

## Próxima etapa

A v4.1.3 permanece dedicada à robustez do Android Bridge: retry, armazenamento criptografado e diagnóstico de sincronização por métrica.
