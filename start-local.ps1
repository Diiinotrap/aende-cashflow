$ErrorActionPreference = "Stop"

$bundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$node = "node"

if (Test-Path $bundledNode) {
  $node = $bundledNode
}

Write-Host "Menjalankan AENDE CASHFLOW di http://localhost:4173"
& $node server.js
