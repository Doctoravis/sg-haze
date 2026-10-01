# Resumable NEA fetcher. Every API page is cached to cache\; a day gets a done_DATE marker once it was
# fetched after it ended, and marked days are never requested again. Unmarked days (today, or days that
# were cached while still in progress) are re-fetched.
param([string]$From = '2026-09-01', [string]$To = '')
$ErrorActionPreference = 'Continue'
$cache = Join-Path $PSScriptRoot 'cache'
New-Item -ItemType Directory -Force $cache | Out-Null
$nowSgt = [DateTime]::UtcNow.AddHours(8)
if (-not $To) { $To = $nowSgt.ToString('yyyy-MM-dd') }
function Get-Page($name, $url) {
  $p = Join-Path $cache $name
  $wait = 4
  for ($i = 0; $i -lt 6; $i++) {
    try {
      $r = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 60
      [IO.File]::WriteAllText($p, $r.Content)
      Start-Sleep -Milliseconds 400
      return $r.Content | ConvertFrom-Json
    } catch { Start-Sleep -Seconds $wait; $wait = [Math]::Min($wait * 2, 40) }
  }
  Write-Output "FAILED $url"; return $null
}
for ($d = Get-Date $From; $d -le (Get-Date $To); $d = $d.AddDays(1)) {
  $ds = $d.ToString('yyyy-MM-dd')
  $marker = Join-Path $cache "done_$ds"
  if (Test-Path $marker) { continue }
  $ok = $true
  if (-not (Get-Page "psi_$ds.json" "https://api-open.data.gov.sg/v2/real-time/api/psi?date=$ds")) { $ok = $false }
  if (-not (Get-Page "pm_$ds.json" "https://api-open.data.gov.sg/v2/real-time/api/pm25?date=$ds")) { $ok = $false }
  $token = $null; $pg = 0
  do {
    $u = "https://api-open.data.gov.sg/v2/real-time/api/rainfall?date=$ds"
    if ($token) { $u += "&paginationToken=$token" }
    $rf = Get-Page "rain_${ds}_$pg.json" $u
    if (-not $rf) { $ok = $false; break }
    $token = $rf.data.paginationToken; $pg++
  } while ($token)
  # pages beyond what the API returned this time are leftovers from an older run
  Get-ChildItem $cache -Filter "rain_${ds}_*.json" | Where-Object { [int]($_.BaseName -split '_')[-1] -ge $pg -and $ok } | Remove-Item -Force
  if ($ok -and $nowSgt -ge $d.Date.AddDays(1).AddMinutes(30)) { New-Item -ItemType File -Force $marker | Out-Null }
  Write-Output "NEA $ds pages=$pg$(if (-not $ok) { ' (incomplete)' })"
}
