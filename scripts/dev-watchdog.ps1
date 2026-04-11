$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeDir = Join-Path $repoRoot ".runtime"
$watchdogPidFile = Join-Path $runtimeDir "dev-stable-watchdog.pid"
$vitePidFile = Join-Path $runtimeDir "dev-stable-vite.pid"
$outLog = Join-Path $runtimeDir "dev-stable.out.log"
$errLog = Join-Path $runtimeDir "dev-stable.err.log"

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
Set-Content -Path $watchdogPidFile -Value $PID -NoNewline

while ($true) {
  try {
    Add-Content -Path $outLog -Value ("[{0}] Starting Vite dev server..." -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
    $viteProc = Start-Process `
      -FilePath "cmd.exe" `
      -ArgumentList "/c npm run dev -- --host --port 8080 --clearScreen false" `
      -WorkingDirectory $repoRoot `
      -RedirectStandardOutput $outLog `
      -RedirectStandardError $errLog `
      -PassThru

    Set-Content -Path $vitePidFile -Value $viteProc.Id -NoNewline
    Wait-Process -Id $viteProc.Id

    $exitCode = $viteProc.ExitCode
    Add-Content -Path $outLog -Value ("[{0}] Vite exited with code {1}. Restarting in 2s..." -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $exitCode)
    Start-Sleep -Seconds 2
  } catch {
    Add-Content -Path $errLog -Value ("[{0}] Watchdog error: {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $_.Exception.Message)
    Start-Sleep -Seconds 2
  }
}
