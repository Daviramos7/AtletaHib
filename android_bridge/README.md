# Atleta Hib Android — v4.1.2

Aplicativo nativo em Kotlin/Jetpack Compose que lê métricas autorizadas do Health Connect e as sincroniza com o Supabase do Atleta Hib.

## Configuração

Copie `gradle.properties.example` para `gradle.properties` e informe:

```properties
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_PUBLISHABLE_KEY=sua-chave-publica
```

## Compilar

```powershell
.\gradlew.bat :app:assembleDebug
```

O APK de debug será gerado em `app/build/outputs/apk/debug/`.

## Fluxo

1. Entre com a mesma conta usada no site.
2. Autorize as métricas desejadas no Health Connect.
3. Sincronize o dia atual ou os últimos sete dias.

Métricas não retornadas são exibidas como “não informado”. O aplicativo não interpreta os dados como diagnóstico.
