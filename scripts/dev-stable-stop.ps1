$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeDir = Join-Path $repoRoot ".runtime"
$watchdogPidFile = Join-Path $runtimeDir "dev-stable-watchdog.pid"
$vitePidFile = Join-Path $runtimeDir "dev-stable-vite.pid"

function Stop-IfRunning([string]$pidFile, [string]$label) {
  if (-not (Test-Path $pidFile)) { return }

  $pidText = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  if ($pidText -match "^\d+$") {
    $targetPid = [int]$pidText
    $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
    if ($proc) {
      Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue
      Write-Output ("Stopped {0} PID: {1}" -f $label, $targetPid)
    }
  }

  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

Stop-IfRunning -pidFile $vitePidFile -label "Vite"
Stop-IfRunning -pidFile $watchdogPidFile -label "Watchdog"

Write-Output "Dev stable stopped."
