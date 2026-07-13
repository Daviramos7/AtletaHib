param([switch]$SkipBuild, [switch]$SkipAndroid)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Run-Check([string]$label, [scriptblock]$command) {
  Write-Host "[v4.1.2] $label" -ForegroundColor Cyan
  & $command
  if ($LASTEXITCODE -ne 0) { throw "$label falhou com exit code $LASTEXITCODE." }
}

$required = @(
  'src/components/ui/index.tsx',
  'src/styles/design-system.css',
  'public/branding/atleta-hib-logo-horizontal.png',
  'public/branding/atleta-hib-simbolo.png',
  'database/migrations/2026_07_13_unify_cardio_sessions.sql',
  'android_bridge/app/src/main/java/com/daviramos/atletabridge/ui/AtletaHibTheme.kt'
)

foreach ($file in $required) {
  if (-not (Test-Path -LiteralPath $file)) { throw "Arquivo obrigatório ausente: $file" }
}

$legacyReferences = rg -n 'runService|from\(''run_sessions''\)' src 2>$null
if ($legacyReferences) {
  Write-Host $legacyReferences -ForegroundColor Red
  throw 'O front ainda contém referência ativa a run_sessions.'
}

Run-Check 'lint' { npm run lint }
Run-Check 'testes automatizados' { npm run test }
Run-Check 'typecheck' { npm run typecheck }
if (-not $SkipBuild) { Run-Check 'build web' { npm run build } }

if (-not $SkipAndroid) {
  Push-Location (Join-Path $root 'android_bridge')
  try {
    Run-Check 'compilação Android' { .\gradlew.bat :app:compileDebugKotlin }
  } finally {
    Pop-Location
  }
}

Write-Host '[v4.1.2] PASS — design system, cardio unificado e Android validados.' -ForegroundColor Green
