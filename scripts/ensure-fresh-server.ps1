# Stops a stale Finiquito server on port 3847 (missing /api/app-modules).
$port = 3847
$base = "http://127.0.0.1:$port"

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $listener) { exit 0 }

$apiOk = $false
try {
  $response = Invoke-WebRequest "$base/api/app-modules" -UseBasicParsing -TimeoutSec 3
  $apiOk = $response.StatusCode -eq 200
} catch {
  $apiOk = $false
}

if ($apiOk) { exit 0 }

$pid = $listener.OwningProcess
Write-Host "Servidor antiguo detectado en puerto $port (PID $pid). Reiniciando..."
Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
