# Ponte Android — Health Connect → Supabase

Esta versão web/PWA já está pronta para receber dados do relógio, mas um site não consegue ler Health Connect diretamente. O caminho correto é criar um app Android companion pequeno.

## Fluxo alvo

```txt
Redmi Watch 5 Active
→ Mi Fitness
→ Health Connect
→ App Android companion
→ Supabase
→ Atleta Híbrido Cloud Web/PWA
```

## Dados alvo para sincronizar

- Passos do dia.
- Sono em minutos.
- Frequência cardíaca média.
- Frequência cardíaca de repouso.
- Calorias ativas.
- Minutos de treino.
- Distância em km.
- Sessões de exercício quando possível.

## Tabela destino

`public.wearable_daily_metrics`

Campos principais:

- `user_id`
- `metric_date`
- `provider`
- `source`
- `steps`
- `sleep_minutes`
- `avg_heart_rate`
- `resting_heart_rate`
- `active_kcal`
- `workout_minutes`
- `distance_km`
- `raw_payload`

## Estratégia de implementação

1. Criar app Android Kotlin mínimo.
2. Autenticar o usuário com Supabase Auth ou token temporário.
3. Solicitar permissões Health Connect.
4. Ler dados agregados por dia.
5. Enviar `upsert` para `wearable_daily_metrics`.
6. Registrar `last_sync_at` em `health_integrations`.

## Observação importante

O PWA continua sendo o produto principal. O app Android deve ser apenas uma ponte de sincronização, não uma reescrita do app inteiro.
