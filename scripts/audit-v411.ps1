param([switch]$SkipBuild)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Run-Check([string]$label, [scriptblock]$command) {
  Write-Host "[v4.1.1] $label" -ForegroundColor Cyan
  & $command
  if ($LASTEXITCODE -ne 0) { throw "$label falhou com exit code $LASTEXITCODE." }
}

$required = @(
  'src/domain/buildDailyTruth.ts',
  'src/domain/dailyTypes.ts',
  'database/migrations/2026_07_10_daily_truth_foundation.sql'
)

foreach ($file in $required) {
  if (-not (Test-Path -LiteralPath $file)) { throw "Arquivo obrigatório ausente: $file" }
}

Run-Check 'lint' { npm run lint }
Run-Check 'testes automatizados' { npm run test }
Run-Check 'typecheck' { npm run typecheck }
if (-not $SkipBuild) { Run-Check 'build' { npm run build } }

Write-Host '[v4.1.1] PASS — fundação diária validada.' -ForegroundColor Green
