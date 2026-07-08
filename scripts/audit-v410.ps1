param(
  [switch]$StartDevServer,
  [switch]$OpenAuditFolder,
  [switch]$Strict
)

$ErrorActionPreference = "Continue"

# ============================================================
# AUDITORIA v4.1.0 — ATLETA HIB
# Executar na raiz do projeto:
# .\scripts\audit-v410.ps1
# .\scripts\audit-v410.ps1 -StartDevServer -OpenAuditFolder
# ============================================================

$Root = (Get-Location).Path
$AuditDir = Join-Path $Root "docs\audits\v4.1.0"
$PayloadDir = Join-Path $AuditDir "test_payloads"
$LogsDir = Join-Path $AuditDir "logs"
$ReportPath = Join-Path $AuditDir "AUDIT_v4_1_0_VALIDATION.md"
$SummaryPath = Join-Path $AuditDir "audit-summary.json"

New-Item -ItemType Directory -Force -Path $AuditDir | Out-Null
New-Item -ItemType Directory -Force -Path $PayloadDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

$Results = New-Object System.Collections.Generic.List[object]

function Add-Result {
  param(
    [string]$Category,
    [string]$Check,
    [string]$Status,
    [string]$Details = "",
    [string]$Evidence = ""
  )

  $Results.Add([PSCustomObject]@{
    category = $Category
    check = $Check
    status = $Status
    details = $Details
    evidence = $Evidence
  }) | Out-Null
}

function Write-Section {
  param([string]$Text)
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor DarkGray
  Write-Host $Text -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor DarkGray
}

function Run-Cmd {
  param(
    [string]$Name,
    [string]$Command,
    [string]$LogName
  )

  Write-Host "Rodando: $Name" -ForegroundColor Yellow

  $logPath = Join-Path $LogsDir $LogName
  $output = cmd.exe /c $Command 2>&1
  $exitCode = $LASTEXITCODE

  $output | Out-File -FilePath $logPath -Encoding utf8

  if ($exitCode -eq 0) {
    Add-Result "Build" $Name "PASS" "Comando executado com sucesso." $logPath
    Write-Host "PASS: $Name" -ForegroundColor Green
  } else {
    Add-Result "Build" $Name "FAIL" "Comando falhou com exit code $exitCode." $logPath
    Write-Host "FAIL: $Name" -ForegroundColor Red
  }
}

function Test-Exists {
  param(
    [string]$Category,
    [string]$Label,
    [string]$RelativePath,
    [string]$Severity = "FAIL"
  )

  $fullPath = Join-Path $Root $RelativePath

  if (Test-Path $fullPath) {
    Add-Result $Category $Label "PASS" "Arquivo encontrado." $RelativePath
  } else {
    Add-Result $Category $Label $Severity "Arquivo não encontrado." $RelativePath
  }
}

function Test-FileContains {
  param(
    [string]$Category,
    [string]$Label,
    [string]$RelativePath,
    [string]$Pattern,
    [string]$ExpectedStatusIfMissing = "WARN"
  )

  $fullPath = Join-Path $Root $RelativePath

  if (!(Test-Path $fullPath)) {
    Add-Result $Category $Label "FAIL" "Arquivo não encontrado." $RelativePath
    return
  }

  $match = Select-String -Path $fullPath -Pattern $Pattern -SimpleMatch -ErrorAction SilentlyContinue

  if ($match) {
    Add-Result $Category $Label "PASS" "Padrão encontrado." "$RelativePath"
  } else {
    Add-Result $Category $Label $ExpectedStatusIfMissing "Padrão não encontrado: $Pattern" "$RelativePath"
  }
}

function Search-Code {
  param(
    [string]$Category,
    [string]$Label,
    [string]$Pattern,
    [string]$StatusIfFound = "WARN",
    [string]$StatusIfNotFound = "PASS"
  )

  $safeName = ($Label -replace '[^a-zA-Z0-9_-]', '_')
  $logPath = Join-Path $LogsDir "$safeName.txt"

  $files = Get-ChildItem -Path $Root -Recurse -Include *.ts,*.tsx,*.js,*.jsx,*.kt,*.sql `
    | Where-Object {
      $_.FullName -notmatch "\\node_modules\\" -and
      $_.FullName -notmatch "\\dist\\" -and
      $_.FullName -notmatch "\\.git\\" -and
      $_.FullName -notmatch "\\build\\"
    }

  $matches = $files | Select-String -Pattern $Pattern -ErrorAction SilentlyContinue

  if ($matches) {
    $matches | ForEach-Object {
      "$($_.Path):$($_.LineNumber): $($_.Line.Trim())"
    } | Out-File -FilePath $logPath -Encoding utf8

    Add-Result $Category $Label $StatusIfFound "Foram encontrados $($matches.Count) pontos. Revisar log." $logPath
  } else {
    "" | Out-File -FilePath $logPath -Encoding utf8
    Add-Result $Category $Label $StatusIfNotFound "Nenhuma ocorrência encontrada." $logPath
  }
}

function Write-JsonPayload {
  param(
    [string]$FileName,
    [object]$Object
  )

  $path = Join-Path $PayloadDir $FileName
  $Object | ConvertTo-Json -Depth 20 | Out-File -FilePath $path -Encoding utf8
  return $path
}

function Escape-Md {
  param([string]$Text)
  if ($null -eq $Text) { return "" }
  return ($Text -replace "\|", "\/")
}

Write-Section "1. Checagem de ambiente"

# Run-Cmd "npm install --include=dev" "npm install --include=dev" "01_npm_install.log"
Run-Cmd "npm run typecheck" "npm run typecheck" "02_typecheck.log"
Run-Cmd "npm run build" "npm run build" "03_build.log"

Write-Section "2. Checagem de arquivos obrigatórios"

Test-Exists "Arquitetura" "dates.ts existe" "src\utils\dates.ts"
Test-Exists "Arquitetura" "durations.ts existe" "src\utils\durations.ts"
Test-Exists "Supabase" "migration v4.1.0 existe" "database\migrations\2026_07_08_data_integrity_v410.sql"

Test-Exists "Componentes" "ImportJsonView existe" "src\components\ImportJsonView.tsx"
Test-Exists "Componentes" "GymModeView existe" "src\components\GymModeView.tsx"
Test-Exists "Componentes" "CardioDataHistoryView existe" "src\components\CardioDataHistoryView.tsx"
Test-Exists "Componentes" "DietView existe" "src\components\DietView.tsx"
Test-Exists "Componentes" "Dashboard existe" "src\components\Dashboard.tsx"

Test-Exists "Services" "cardioService existe" "src\services\cardioService.ts"
Test-Exists "Services" "mealService existe" "src\services\mealService.ts"
Test-Exists "Services" "sleepService existe" "src\services\sleepService.ts"
Test-Exists "Services" "workoutService existe" "src\services\workoutService.ts"
Test-Exists "Services" "wearableService existe" "src\services\wearableService.ts"
Test-Exists "Services" "strengthWearableService existe" "src\services\strengthWearableService.ts"
Test-Exists "Services" "checkinService existe" "src\services\checkinService.ts"
Test-Exists "Services" "analyticsService existe" "src\services\analyticsService.ts"

Write-Section "3. Checagem de padrões esperados da v4.1.0"

Test-FileContains "Datas" "cardioService usa dates.ts" "src\services\cardioService.ts" "utils/dates"
Test-FileContains "Datas" "sleepService usa dates.ts" "src\services\sleepService.ts" "utils/dates"
Test-FileContains "Duração" "cardioService usa durations.ts" "src\services\cardioService.ts" "utils/durations"
Test-FileContains "Duração" "strengthWearableService usa durations.ts" "src\services\strengthWearableService.ts" "utils/durations"

Test-FileContains "JSON" "ImportJsonView considera training_effect" "src\components\ImportJsonView.tsx" "training_effect"
Test-FileContains "JSON" "ImportJsonView considera distance_km" "src\components\ImportJsonView.tsx" "distance_km"
Test-FileContains "JSON" "ImportJsonView considera duration_minutes" "src\components\ImportJsonView.tsx" "duration_minutes"

Test-FileContains "Comida" "mealService tem proteção de duplicidade" "src\services\mealService.ts" "duplicate"
Test-FileContains "Comida" "mealService exige data explícita" "src\services\mealService.ts" "date"
Test-FileContains "Cardio" "cardioService usa dedupe_key" "src\services\cardioService.ts" "dedupe_key"
Test-FileContains "Treino" "workoutService tem rollback/delete em falha" "src\services\workoutService.ts" "delete"

Test-FileContains "Supabase" "Migration tem wearable_daily_metrics" "database\migrations\2026_07_08_data_integrity_v410.sql" "wearable_daily_metrics"
Test-FileContains "Supabase" "Migration tem user_id, metric_date, source" "database\migrations\2026_07_08_data_integrity_v410.sql" "user_id, metric_date, source"
Test-FileContains "Android" "Android Bridge usa on_conflict com source" "android_bridge\app\src\main\java\com\daviramos\atletabridge\data\SupabaseRestClient.kt" "on_conflict=user_id,metric_date,source"

Write-Section "4. Varredura estática de riscos"

Search-Code "Data/Hora" "Uso de toISOString().slice" "toISOString\(\)\.slice" "WARN" "PASS"
Search-Code "Data/Hora" "Uso de new Date().toISOString" "new Date\(\)\.toISOString" "WARN" "PASS"
Search-Code "Nulos" "Uso de || 0" "\|\| 0" "WARN" "PASS"
Search-Code "Nulos" "Uso de ?? 0" "\?\? 0" "WARN" "PASS"
Search-Code "Supabase" "Uso de maybeSingle" "maybeSingle" "WARN" "PASS"
Search-Code "Cardio legado" "Uso de run_sessions" "run_sessions" "WARN" "PASS"
Search-Code "Cardio novo" "Uso de cardio_sessions" "cardio_sessions" "PASS" "WARN"
Search-Code "JSON" "Uso de training_effect" "training_effect" "PASS" "WARN"
Search-Code "Dedupe" "Uso de dedupe_key" "dedupe_key" "PASS" "WARN"
Search-Code "Saúde/UX" "Texto agressivo: aumente cardio" "aumente cardio" "WARN" "PASS"
Search-Code "Saúde/UX" "Texto agressivo: coma menos" "coma menos" "WARN" "PASS"
Search-Code "Saúde/UX" "Texto de diagnóstico" "diagnóstico|diagnostico|doença|doenca|medicamento|remédio|remedio|SpO2" "WARN" "PASS"

Write-Section "5. Checagem de arquivos sensíveis no Git"

$trackedSensitive = git ls-files ".env" ".env.local" "android_bridge/local.properties" "android_bridge/gradle.properties" "tsconfig.tsbuildinfo" 2>$null

$trackedSensitiveLog = Join-Path $LogsDir "tracked_sensitive_files.txt"
$trackedSensitive | Out-File -FilePath $trackedSensitiveLog -Encoding utf8

if ($trackedSensitive) {
  Add-Result "Segurança" "Arquivos sensíveis rastreados pelo Git" "FAIL" "Existem arquivos que não deveriam estar rastreados." $trackedSensitiveLog
} else {
  Add-Result "Segurança" "Arquivos sensíveis rastreados pelo Git" "PASS" "Nenhum arquivo sensível rastreado." $trackedSensitiveLog
}

Test-FileContains "Gitignore" ".gitignore ignora .env.local" ".gitignore" ".env.local" "WARN"
Test-FileContains "Gitignore" ".gitignore ignora local.properties" ".gitignore" "local.properties" "WARN"
Test-FileContains "Gitignore" ".gitignore ignora gradle.properties" ".gitignore" "gradle.properties" "WARN"
Test-FileContains "Gitignore" ".gitignore ignora tsbuildinfo" ".gitignore" "tsbuildinfo" "WARN"

Write-Section "6. Criação de payloads JSON de teste"

$Today = Get-Date -Format "yyyy-MM-dd"
$OldDate = (Get-Date).AddDays(-7).ToString("yyyy-MM-dd")

$payloads = @()

$payloads += Write-JsonPayload "01_cardio_hoje_com_training_effect.json" ([ordered]@{
  type = "cardio"
  date = $Today
  activity_type = "treadmill"
  duration_minutes = 20
  distance_km = 1.6
  active_kcal = 140
  training_effect = 2.1
  source = "json_test"
})

$payloads += Write-JsonPayload "02_cardio_antigo.json" ([ordered]@{
  type = "cardio"
  date = $OldDate
  activity_type = "treadmill"
  duration_minutes = 20
  distance_km = 1.5
  active_kcal = 130
  source = "json_test"
})

$payloads += Write-JsonPayload "03_comida_sem_date_deve_bloquear.json" ([ordered]@{
  type = "meal"
  meal_type = "lunch"
  items = @(
    [ordered]@{
      name = "arroz"
      grams = 150
      kcal = 190
      protein_g = 4
    }
  )
})

$payloads += Write-JsonPayload "04_comida_duplicada_teste.json" ([ordered]@{
  type = "meal"
  date = $Today
  meal_type = "lunch"
  items = @(
    [ordered]@{
      name = "arroz"
      grams = 150
      kcal = 190
      protein_g = 4
      carbs_g = 42
      fat_g = 1
    }
  )
})

$payloads += Write-JsonPayload "05_cardio_20min08s.json" ([ordered]@{
  type = "cardio"
  date = $Today
  activity_type = "treadmill"
  duration_seconds = 1208
  distance_km = 1.6
  active_kcal = 140
  source = "json_test"
})

$payloads += Write-JsonPayload "06_cardio_duration_ambiguo_deve_bloquear.json" ([ordered]@{
  type = "cardio"
  date = $Today
  activity_type = "treadmill"
  duration = 20
  distance_km = 1.6
  active_kcal = 140
  source = "json_test"
})

$payloads += Write-JsonPayload "07_comida_macro_ausente.json" ([ordered]@{
  type = "meal"
  date = $Today
  meal_type = "dinner"
  items = @(
    [ordered]@{
      name = "peixe"
      grams = 150
      kcal = 210
    }
  )
})

$payloads += Write-JsonPayload "08_sono_cruzando_meia_noite.json" ([ordered]@{
  type = "sleep"
  date = $Today
  start_time = "22:57"
  end_time = "06:20"
  total_minutes = 443
  source = "json_test"
})

$payloadListPath = Join-Path $LogsDir "payloads_created.txt"
$payloads | Out-File -FilePath $payloadListPath -Encoding utf8
Add-Result "Payloads" "JSONs de teste criados" "PASS" "Foram criados $($payloads.Count) payloads de teste." $payloadListPath

Write-Section "7. Geração do relatório Markdown"

$passCount = ($Results | Where-Object { $_.status -eq "PASS" }).Count
$warnCount = ($Results | Where-Object { $_.status -eq "WARN" }).Count
$failCount = ($Results | Where-Object { $_.status -eq "FAIL" }).Count

$resultsRows = $Results | ForEach-Object {
  "| $(Escape-Md $_.category) | $(Escape-Md $_.check) | $(Escape-Md $_.status) | $(Escape-Md $_.details) | $(Escape-Md $_.evidence) |"
}

$manualChecklist = @"
## Testes manuais obrigatórios

Use os JSONs gerados em:

`docs/audits/v4.1.0/test_payloads`

### 1. JSON cardio hoje com training_effect

Arquivo:

`01_cardio_hoje_com_training_effect.json`

Resultado esperado:

- Deve salvar como cardio.
- Não deve salvar como força do relógio.
- Deve aparecer em histórico de cardio.

### 2. JSON cardio antigo

Arquivo:

`02_cardio_antigo.json`

Resultado esperado:

- Deve alertar que a data é diferente de hoje.
- Deve salvar no dia antigo.
- Não deve aparecer como treino de hoje.

### 3. JSON comida sem date

Arquivo:

`03_comida_sem_date_deve_bloquear.json`

Resultado esperado:

- Deve bloquear.
- Não pode salvar automaticamente em hoje.

### 4. Comida duplicada

Arquivo:

`04_comida_duplicada_teste.json`

Resultado esperado:

- Primeira importação salva.
- Segunda importação deve bloquear ou avisar duplicidade.
- Total calórico não pode dobrar.

### 5. Cardio 20:08

Arquivo:

`05_cardio_20min08s.json`

Resultado esperado:

- Deve exibir 20:08 ou equivalente.
- Não deve mascarar como 20 min seco.

### 6. Cardio com duration ambíguo

Arquivo:

`06_cardio_duration_ambiguo_deve_bloquear.json`

Resultado esperado:

- Deve bloquear ou pedir unidade.
- Não deve interpretar como 20 segundos.

### 7. Comida com macro ausente

Arquivo:

`07_comida_macro_ausente.json`

Resultado esperado:

- Kcal deve aparecer.
- Macro ausente não deve ser tratada visualmente como certeza de 0g, se a tela tiver distinção.

### 8. Sono cruzando meia-noite

Arquivo:

`08_sono_cruzando_meia_noite.json`

Resultado esperado:

- Deve salvar no dia correto conforme regra definida.
- Se a regra ainda estiver ambígua, marcar como pendência.

### 9. Cardio manual sem distância

Teste pela UI.

Resultado esperado:

- Deve mostrar "sem distância".
- Não deve mostrar 0.00 km.

### 10. Dieta manual sem kcal/100g

Teste pela UI.

Resultado esperado:

- Deve bloquear.
- Não pode salvar alimento com 0 kcal por campo vazio.

### 11. Treino força + cardio acima de 20 min recusado

Teste pela UI.

Resultado esperado:

- Se recusar o cardio, não deve salvar força parcialmente.
- Não deve duplicar treino.

### 12. Relatório semanal

Depois dos testes, abrir relatório semanal.

Resultado esperado:

- Não deve contar cardio duplicado.
- Não deve somar kcal de sessão importada como total diário sem regra explícita.
- Não deve misturar força do relógio com força do app sem distinção.
"@

$matrix = @"
## Matriz de validação dos riscos originais

| ID | Categoria | Risco original | Status manual | Evidência | Teste feito | Resultado | Próximo ajuste |
|---|---|---|---|---|---|---|---|
| 1 | JSON/Cardio | JSON de cardio com training_effect cair como força |  |  |  |  |  |
| 2 | Comida | Reimportar comida duplicar kcal |  |  |  |  |  |
| 3 | Comida | Alimento manual sem kcal virar 0 kcal |  |  |  |  |  |
| 4 | Wearable | Android Bridge e Supabase discordarem sobre chave única |  |  |  |  |  |
| 5 | Treino | Finalizar treino com cardio >20 min salvar força parcialmente |  |  |  |  |  |
| 6 | Data/Hora | Treino cruzando meia-noite cair em dias diferentes |  |  |  |  |  |
| 7 | Data/Hora | toISOString/slice mudar data local |  |  |  |  |  |
| 8 | Cardio | Dedupe sobrescrever duas sessões reais iguais |  |  |  |  |  |
| 9 | JSON/Comida | JSON sem date cair em hoje |  |  |  |  |  |
| 10 | JSON/Duração | duration: 20 ser interpretado como 20 segundos |  |  |  |  |  |
| 11 | Wearable | maybeSingle falhar com múltiplas fontes |  |  |  |  |  |
| 12 | Relatório | run_sessions + cardio_sessions dupla contagem |  |  |  |  |  |
| 13 | Check-in | Nota da manhã ser sobrescrita pelo fechamento |  |  |  |  |  |
| 14 | Peso | Relatório dizer "na janela" usando peso fora da janela |  |  |  |  |  |
| 15 | Saúde/UX | Kcal muito baixa receber feedback positivo |  |  |  |  |  |
| 16 | Força | Workout session salva sem séries em falha parcial |  |  |  |  |  |
| 17 | Segurança | .env/local.properties/gradle.properties no pacote |  |  |  |  |  |
| 18 | Cardio | 20:08 aparecer como 20 min |  |  |  |  |  |
| 19 | Check-in | Readiness tratar dado ausente como 0 confiável |  |  |  |  |  |
| 20 | Comida | Macro ausente aparecer como 0g real |  |  |  |  |  |
| 21 | Cardio | Cardio sem distância aparecer como 0.00 km |  |  |  |  |  |
| 22 | Corrida | "Melhor 1 km" ser apenas pace médio |  |  |  |  |  |
| 23 | Cardio | JSON antigo avançar progressão do plano |  |  |  |  |  |
| 24 | Sono | Sono cruzando meia-noite cair no dia errado |  |  |  |  |  |
| 25 | Água | Cliques rápidos perderem incremento |  |  |  |  |  |
"@

$report = @"
# Auditoria de fechamento — Atleta Hib v4.1.0

Gerado em: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

## Resumo automático

| Status | Quantidade |
|---|---:|
| PASS | $passCount |
| WARN | $warnCount |
| FAIL | $failCount |

## Resultado automático

| Categoria | Checagem | Status | Detalhes | Evidência |
|---|---|---|---|---|
$($resultsRows -join "`n")

$matrix

$manualChecklist

## Interpretação

- PASS: passou na checagem automática.
- WARN: precisa de revisão humana. Nem todo WARN é bug.
- FAIL: precisa corrigir antes de considerar a v4.1.0 fechada.

## Critério para liberar v4.1.0

- `npm run typecheck` precisa passar.
- `npm run build` precisa passar.
- Nenhum FAIL de segurança/migration.
- Testes manuais de JSON, comida, cardio e treino precisam passar.
- Relatório semanal não pode duplicar cardio/comida.
"@

$report | Out-File -FilePath $ReportPath -Encoding utf8

$Results | ConvertTo-Json -Depth 10 | Out-File -FilePath $SummaryPath -Encoding utf8

Write-Section "8. Resultado"

Write-Host "PASS: $passCount" -ForegroundColor Green
Write-Host "WARN: $warnCount" -ForegroundColor Yellow
Write-Host "FAIL: $failCount" -ForegroundColor Red

Write-Host ""
Write-Host "Relatório gerado em:" -ForegroundColor Cyan
Write-Host $ReportPath

Write-Host ""
Write-Host "Payloads gerados em:" -ForegroundColor Cyan
Write-Host $PayloadDir

if ($failCount -gt 0) {
  Write-Host ""
  Write-Host "Existem FAILs. Abra o relatório antes de commitar/pushar." -ForegroundColor Red
}

if ($warnCount -gt 0) {
  Write-Host ""
  Write-Host "Existem WARNs. Eles precisam de revisão manual, mas nem todos são bugs." -ForegroundColor Yellow
}

if ($StartDevServer) {
  Write-Host ""
  Write-Host "Abrindo npm run dev em nova janela..." -ForegroundColor Cyan
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$Root`"; npm run dev"
}

if ($OpenAuditFolder) {
  Start-Process explorer.exe $AuditDir
}

if ($Strict -and $failCount -gt 0) {
  exit 1
}

exit 0