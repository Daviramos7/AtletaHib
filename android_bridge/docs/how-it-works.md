# Como a ponte funciona

Fluxo:

```txt
Redmi Watch 5 Active
→ Mi Fitness
→ Health Connect
→ Atleta Híbrido Bridge Android
→ Supabase
→ Atleta Híbrido Cloud Web/PWA
```

O app Android não fala diretamente com o relógio Xiaomi. Ele lê os dados que o Mi Fitness conseguir gravar no Health Connect.

## Dados lidos na v0.1

- passos do dia
- sono em minutos
- frequência cardíaca média
- frequência cardíaca de repouso
- calorias ativas
- minutos de treino
- distância em km

## Limites reais

1. Se o Mi Fitness não enviar um dado ao Health Connect, a ponte não consegue inventar esse dado.
2. O app web/PWA não consegue ler Health Connect diretamente; por isso existe este app Android.
3. A sincronização automática em background ainda não foi implementada na v0.1. A v0.1 sincroniza manualmente: Hoje ou últimos 7 dias.
4. A chave `service_role` do Supabase nunca deve ser colocada no APK.

## Próxima versão recomendada

- WorkManager para sincronizar 1x por dia.
- Login persistente com armazenamento seguro.
- Tela de histórico de sincronizações.
- Detecção de dados ausentes do Mi Fitness.
