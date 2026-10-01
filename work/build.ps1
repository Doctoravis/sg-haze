# Turns cached NEA pages + Open-Meteo files into data.js (window.HAZE).
# Finished days (cache\done_DATE) are reduced once into cache\agg_DATE.json and reused, so a refresh only
# re-reads the days still in progress.
$root = $PSScriptRoot
$cache = Join-Path $root 'cache'
$regions = 'north','south','east','west','central'
function Get-DayAgg($ds) {
  $air = @(); $rainH = @{}
  $pf = Join-Path $cache "psi_$ds.json"
  if (Test-Path $pf) {
    $M = @{}
    $mf = Join-Path $cache "pm_$ds.json"
    if (Test-Path $mf) { foreach ($it in (Get-Content $mf -Raw | ConvertFrom-Json).data.items) { $M[$it.timestamp.Substring(0, 16)] = $it.readings.pm25_one_hourly } }
    $seen = @{}
    foreach ($it in ((Get-Content $pf -Raw | ConvertFrom-Json).data.items | Sort-Object timestamp)) {
      $k = $it.timestamp.Substring(0, 16)
      if ($seen[$k]) { continue }; $seen[$k] = $true
      $r = $it.readings; $h = $M[$k]
      $air += , @($k, @($regions | ForEach-Object { $r.psi_twenty_four_hourly.$_ }), @($regions | ForEach-Object { if ($h) { $h.$_ } else { $null } }), @($regions | ForEach-Object { $r.pm25_twenty_four_hourly.$_ }))
    }
  }
  foreach ($f in Get-ChildItem $cache -Filter "rain_${ds}_*.json") {
    foreach ($rd in (Get-Content $f.FullName -Raw | ConvertFrom-Json).data.readings) {
      $hr = $rd.timestamp.Substring(0, 13)
      $n = 0; $sum = 0.0; $wet = 0
      foreach ($x in $rd.data) { $n++; $sum += [double]$x.value; if ([double]$x.value -gt 0) { $wet++ } }
      if ($n -eq 0) { continue }
      if (-not $rainH.ContainsKey($hr)) { $rainH[$hr] = @(0.0, 0.0, 0) }
      $rainH[$hr][0] += $sum / $n
      if ($wet / $n -gt $rainH[$hr][1]) { $rainH[$hr][1] = $wet / $n }
      $rainH[$hr][2]++
    }
  }
  $rain = @($rainH.Keys | Sort-Object | ForEach-Object { , @($_, [math]::Round($rainH[$_][0], 2), [math]::Round($rainH[$_][1], 2), $rainH[$_][2]) })
  return [ordered]@{ air = $air; rain = $rain }
}
$t = New-Object System.Collections.Generic.List[object]
$psi = @{}; $pm1 = @{}; $pm24 = @{}
foreach ($g in $regions) { $psi[$g] = New-Object System.Collections.Generic.List[object]; $pm1[$g] = New-Object System.Collections.Generic.List[object]; $pm24[$g] = New-Object System.Collections.Generic.List[object] }
$rt = New-Object System.Collections.Generic.List[object]; $rmm = New-Object System.Collections.Generic.List[object]; $rwet = New-Object System.Collections.Generic.List[object]; $rn = New-Object System.Collections.Generic.List[object]
$todaySgt = [DateTime]::UtcNow.AddHours(8).Date
for ($d = Get-Date '2026-09-01'; $d -le $todaySgt; $d = $d.AddDays(1)) {
  $ds = $d.ToString('yyyy-MM-dd')
  $af = Join-Path $cache "agg_$ds.json"
  $final = Test-Path (Join-Path $cache "done_$ds")
  if ($final -and (Test-Path $af)) { $A = Get-Content $af -Raw | ConvertFrom-Json }
  else {
    $A = Get-DayAgg $ds
    $json = ConvertTo-Json $A -Depth 5 -Compress
    if ($final) { [IO.File]::WriteAllText($af, $json) }
    $A = $json | ConvertFrom-Json
  }
  foreach ($row in $A.air) {
    $t.Add($row[0])
    for ($i = 0; $i -lt 5; $i++) { $psi[$regions[$i]].Add($row[1][$i]); $pm1[$regions[$i]].Add($row[2][$i]); $pm24[$regions[$i]].Add($row[3][$i]) }
  }
  foreach ($row in $A.rain) { $rt.Add($row[0]); $rmm.Add($row[1]); $rwet.Add($row[2]); $rn.Add($row[3]) }
}
$air = [ordered]@{ t = $t; psi = $psi; pm1 = $pm1; pm24 = $pm24 }
$rain = [ordered]@{ t = $rt; mm = $rmm; wet = $rwet; n = $rn }
$stampFile = Join-Path $root 'data\forecast_stamp.txt'
$stamp = if (Test-Path $stampFile) { (Get-Content $stampFile -Raw).Trim() } else { '' }
$js = New-Object System.Text.StringBuilder
[void]$js.Append('window.HAZE={')
[void]$js.Append('"air":' + ($air | ConvertTo-Json -Depth 4 -Compress) + ',')
[void]$js.Append('"rain":' + ($rain | ConvertTo-Json -Depth 3 -Compress) + ',')
foreach ($pair in @(@('wx','sg_wx_hist'),@('cams','cams'),@('fc16','fc16'),@('ens','ens'),@('seas','seasonal'),@('clim','climweekly'),@('fire','firepx'))) {
  [void]$js.Append('"' + $pair[0] + '":' + (Get-Content (Join-Path $root "data\$($pair[1]).json") -Raw).Trim() + ',')
}
[void]$js.Append('"fcBuilt":"' + $stamp + '",')
[void]$js.Append('"built":"' + [DateTime]::UtcNow.AddHours(8).ToString('yyyy-MM-dd HH:mm') + '"};')
[IO.File]::WriteAllText((Join-Path $root 'data.js'), $js.ToString())
"hours=$($t.Count) rainHours=$($rt.Count)"
