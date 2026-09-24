# Atleta Hib Android — v4.1.3

Aplicativo nativo em Kotlin/Jetpack Compose que lê métricas autorizadas do Health Connect e as sincroniza com o Supabase do Atleta Hib.

## Configuração

Copie `gradle.properties.example` para `gradle.properties` e informe:

```properties
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_PUBLISHABLE_KEY=sua-chave-publica
```

## Compilar

```powershell
.\gradlew.bat :app:testDebugUnitTest :app:lint :app:assembleDebug
```

O APK de debug será gerado em `app/build/outputs/apk/debug/app-debug.apk`. O build não instala nem substitui o app no celular.

## Fluxo

1. Entre com a mesma conta usada no site.
2. Autorize as métricas desejadas no Health Connect.
3. Sincronize o dia atual ou os últimos sete dias.

Métricas não retornadas são exibidas como “não informado”. O aplicativo não interpreta os dados como diagnóstico.

## Garantias e limites

- HR: todas as páginas e amostras reais do dia local, de todas as origens, produzem a média diária do contrato existente. Duplicatas exatas da mesma origem não contam duas vezes.
- Batimentos em repouso: somente `RestingHeartRateRecord`; não são estimados a partir do sono.
- A sincronização compara o resumo existente e só grava quando houver alteração. Métricas ausentes ou sem permissão não apagam valores existentes.
- Falhas de leitura ou envio geram resultado parcial, sem promessa de fila offline ou sincronização automática.
- Sessões locais são cifradas com Android Keystore; senha não é persistida e backups de dados privados estão desativados.
- “Sair de todos os dispositivos” usa Supabase Auth global. Outras sessões perdem a capacidade de renovar o acesso; JWTs já emitidos podem durar até expirar. Falha de rede não é apresentada como revogação concluída.

Veja [como a ponte funciona](docs/how-it-works.md) e o [relatório final da rodada](../docs/audits/2026-09-24-android-and-training-final.md).
