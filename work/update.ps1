# Refresh pipeline behind the dashboard's refresh button (also runnable by hand):
#   powershell -ExecutionPolicy Bypass -File update.ps1
# Tracking data (NEA readings, rainfall, satellite images, Singapore wind) refreshes on every run.
# Forecast inputs (Open-Meteo 16-day, ECMWF ensemble, SEAS5, CAMS, climatology window) refresh at most
# once per Singapore calendar day, recorded in data\forecast_stamp.txt. -ForceForecast overrides that.
param([switch]$ForceForecast)
$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
Set-Location $root
$data = Join-Path $root 'data'
$log = Join-Path $data 'refresh.log'
$now = [DateTime]::UtcNow.AddHours(8)
$ds = $now.ToString('yyyy-MM-dd')
function Say($m) { $line = "$([DateTime]::UtcNow.AddHours(8).ToString('HH:mm:ss')) $m"; Add-Content $log $line -Encoding utf8; Write-Output $line }
function Get-File($name, $url) {
  for ($i = 0; $i -lt 3; $i++) {
    try { Invoke-WebRequest $url -OutFile (Join-Path $data "$name.tmp") -UseBasicParsing -TimeoutSec 120; Move-Item (Join-Path $data "$name.tmp") (Join-Path $data $name) -Force; return $true } catch { Start-Sleep 4 }
  }
  Say "FAIL $name" | Out-Null; return $false
}
Set-Content $log "" -Encoding utf8

Say 'STEP nea'
& (Join-Path $root 'fetch2.ps1') | Where-Object { $_ -match 'FAILED|incomplete' } | ForEach-Object { Say $_ }

Say 'STEP sat'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'sat.ps1') | Out-Null

Say 'STEP wind'
$null = Get-File 'sg_wx_hist.json' "https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=1.35&longitude=103.82&start_date=2026-09-01&end_date=$ds&hourly=wind_speed_10m,wind_direction_10m,precipitation,relative_humidity_2m,boundary_layer_height&timezone=Asia%2FSingapore"

$stampFile = Join-Path $data 'forecast_stamp.txt'
$stamp = if (Test-Path $stampFile) { (Get-Content $stampFile -Raw).Trim() } else { '' }
if ($ForceForecast -or -not $stamp.StartsWith($ds)) {
  Say 'STEP forecast'
  $lat = '1.35,-2.98,-1.6,0.5,-2.2,-0.03,-3.3'; $lon = '103.82,104.75,103.6,101.45,113.9,109.33,114.6'
  $past = [Math]::Min(92, [int]($now.Date - (Get-Date '2026-09-01')).TotalDays + 1)
  $ok = $true
  $ok = (Get-File 'fc16.json' "https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&daily=precipitation_sum,precipitation_probability_max,wind_direction_10m_dominant,wind_speed_10m_max&forecast_days=16&timezone=Asia%2FSingapore") -and $ok
  $ok = (Get-File 'cams.json' "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=1.35&longitude=103.82&hourly=pm2_5,pm10,aerosol_optical_depth&past_days=$past&forecast_days=5&timezone=Asia%2FSingapore") -and $ok
  $ok = (Get-File 'ens.json' "https://ensemble-api.open-meteo.com/v1/ensemble?latitude=1.35,-2.9,-2.2&longitude=103.82,104.4,113.9&models=ecmwf_ifs025&daily=precipitation_sum,wind_direction_10m_dominant&forecast_days=15&timezone=Asia%2FSingapore") -and $ok
  $ok = (Get-File 'seasonal.json' "https://seasonal-api.open-meteo.com/v1/seasonal?latitude=$lat&longitude=$lon&daily=precipitation_sum&forecast_days=60&timezone=Asia%2FSingapore") -and $ok
  & (Join-Path $root 'clim.ps1') | Out-Null
  # only stamp the day when everything arrived, so a failed attempt can be retried with another click
  if ($ok) { Set-Content $stampFile $now.ToString('yyyy-MM-dd HH:mm') -Encoding ascii }
} else {
  Say "STEP forecast-skip $stamp"
}

Say 'STEP build'
$r = & (Join-Path $root 'build.ps1')
Say "DONE $r"
