# Atleta Híbrido 2.0 Patch

Este pacote transforma a versão atual em uma versão 2.0 Alpha.

## Web 2.0
Arquivos principais alterados:
- `package.json`
- `src/App.tsx`
- `src/components/Dashboard.tsx`
- `src/components/ProgressView.tsx`
- `src/components/IntegrationsView.tsx`
- `src/styles.css`

Mudanças:
- dashboard novo com resumo inteligente;
- navegação inferior no celular;
- design mobile-first;
- tela de Progresso sem arrastar para o lado;
- painel de confiabilidade dos dados;
- dados de wearable mais claros;
- resumo de saúde de 7 dias na tela de Integrações;
- warning de botão sem texto acessível corrigido;
- versão do app marcada como `2.0.0`.

## Depois de aplicar
Rode:

```bash
pnpm install
pnpm run lint
pnpm run typecheck
pnpm run build
```

Depois commit/push e redeploy na Vercel.
