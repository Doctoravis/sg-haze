# Reduces 30-yr ERA5 series to weekly climatology for the 8 weeks starting today (SGT), matching the SEAS5 window
$c = Get-Content (Join-Path $PSScriptRoot 'data\clim.json') -Raw | ConvertFrom-Json
$w = Get-Content (Join-Path $PSScriptRoot 'data\clim_wind.json') -Raw | ConvertFrom-Json
$start = [DateTime]::UtcNow.AddHours(8).Date
$weeks = 0..7 | ForEach-Object { $start.AddDays(7 * $_) }
function WeekIdx($t) {
  # map a historic date to week index by month/day within the window, else -1
  $d = [datetime]::ParseExact($t, 'yyyy-MM-dd', $null)
  # place the historic month/day in the window's year (window may cross into the next year)
  try { $x = Get-Date -Year $start.Year -Month $d.Month -Day $d.Day } catch { return -1 }
  if ($x.Date -lt $start) { try { $x = $x.AddYears(1) } catch { return -1 } }
  $k = [math]::Floor(($x.Date - $start).TotalDays / 7)
  if ($k -ge 0 -and $k -lt 8) { return [int]$k } else { return -1 }
}
$times = $c[0].daily.time
$idx = @($times | ForEach-Object { WeekIdx $_ })
$rain = @()
foreach ($loc in $c) {
  $sum = New-Object double[] 8; $yrs = @{}
  $p = $loc.daily.precipitation_sum
  for ($i = 0; $i -lt $times.Count; $i++) {
    $k = $idx[$i]; if ($k -lt 0 -or $null -eq $p[$i]) { continue }
    $sum[$k] += $p[$i]; $yrs[$times[$i].Substring(0, 4)] = 1
  }
  $n = $yrs.Count
  $rain += , @($sum | ForEach-Object { [math]::Round($_ / $n, 1) })
}
# wind: share of days whose dominant 10 m wind blows from the southern half (SE-S-SW, 100-260 deg)
$nino = '1997','2002','2004','2006','2009','2015','2018','2023'
$wt = $w.daily.time; $wd = $w.daily.wind_direction_10m_dominant
$all = New-Object double[] 8; $allN = New-Object double[] 8; $en = New-Object double[] 8; $enN = New-Object double[] 8
for ($i = 0; $i -lt $wt.Count; $i++) {
  $k = WeekIdx $wt[$i]; if ($k -lt 0 -or $null -eq $wd[$i]) { continue }
  $s = if ($wd[$i] -ge 100 -and $wd[$i] -le 260) { 1 } else { 0 }
  $all[$k] += $s; $allN[$k]++
  if ($nino -contains $wt[$i].Substring(0, 4)) { $en[$k] += $s; $enN[$k]++ }
}
$out = [ordered]@{
  weeks = @($weeks | ForEach-Object { $_.ToString('yyyy-MM-dd') })
  rain = $rain
  southAll = @(0..7 | ForEach-Object { [math]::Round(100 * $all[$_] / $allN[$_]) })
  southNino = @(0..7 | ForEach-Object { [math]::Round(100 * $en[$_] / $enN[$_]) })
}
$out | ConvertTo-Json -Depth 4 -Compress | Out-File (Join-Path $PSScriptRoot 'data\climweekly.json') -Encoding utf8
Get-Content (Join-Path $PSScriptRoot 'data\climweekly.json')
