$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeDir = Join-Path $repoRoot ".runtime"
$watchdogPidFile = Join-Path $runtimeDir "dev-stable-watchdog.pid"
$vitePidFile = Join-Path $runtimeDir "dev-stable-vite.pid"
$outLog = Join-Path $runtimeDir "dev-stable.out.log"
$errLog = Join-Path $runtimeDir "dev-stable.err.log"
$watchdogScript = Join-Path $PSScriptRoot "dev-watchdog.ps1"

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

if (Test-Path $watchdogPidFile) {
  $existingPidText = (Get-Content $watchdogPidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  if ($existingPidText -match "^\d+$") {
    $existingPid = [int]$existingPidText
    $existingProc = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
    if ($existingProc) {
      Write-Output ("Dev stable is already running. Watchdog PID: {0}" -f $existingPid)
      exit 0
    }
  }
}

if (Test-Path $outLog) { Remove-Item -LiteralPath $outLog -Force }
if (Test-Path $errLog) { Remove-Item -LiteralPath $errLog -Force }

$watchdogCommand = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$watchdogScript`""
$watchdogProc = Start-Process `
  -FilePath "cmd.exe" `
  -ArgumentList "/c $watchdogCommand" `
  -WorkingDirectory $repoRoot `
  -PassThru

Start-Sleep -Seconds 3

$watchdogRunning = Get-Process -Id $watchdogProc.Id -ErrorAction SilentlyContinue
if (-not $watchdogRunning) {
  Write-Error "Failed to start watchdog process."
}

$vitePidText = (Get-Content $vitePidFile -ErrorAction SilentlyContinue | Select-Object -First 1)

Write-Output ("Dev stable started. Watchdog PID: {0}" -f $watchdogProc.Id)
if ($vitePidText -match "^\d+$") {
  Write-Output ("Vite PID: {0}" -f $vitePidText)
}
Write-Output "URL: http://localhost:8080"
