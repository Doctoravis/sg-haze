# NASA GIBS daily imagery + fire-pixel index. Older days are final and skipped; yesterday and today are refreshed.
$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System.Drawing;
public static class Px {
  // counts opaque pixels in lon/lat box; image covers lon 98..118, lat -6..4
  public static int Count(string path, double lon0, double lon1, double lat0, double lat1) {
    using (var b = new Bitmap(path)) {
      int w = b.Width, h = b.Height, n = 0;
      int x0 = (int)((lon0 - 98) / 20.0 * w), x1 = (int)((lon1 - 98) / 20.0 * w);
      int y0 = (int)((4 - lat1) / 10.0 * h), y1 = (int)((4 - lat0) / 10.0 * h);
      for (int y = y0; y < y1; y++) for (int x = x0; x < x1; x++) { if (b.GetPixel(x, y).A > 100) n++; }
      return n;
    }
  }
}
"@
$dir = Join-Path $PSScriptRoot 'sat'
New-Item -ItemType Directory -Force $dir | Out-Null
$out = Join-Path $PSScriptRoot 'data\firepx.json'
$known = @{}
if (Test-Path $out) { foreach ($c in (Get-Content $out -Raw | ConvertFrom-Json)) { $known[$c.d] = $c } }
$base = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&STYLES=&CRS=EPSG:4326&BBOX=-6,98,4,118'
$counts = @()
$nowSgt = [DateTime]::UtcNow.AddHours(8)
$todaySgt = $nowSgt.Date
for ($d = Get-Date '2026-09-01'; $d -le $todaySgt; $d = $d.AddDays(1)) {
  $ds = $d.ToString('yyyy-MM-dd')
  $age = ($todaySgt - $d.Date).TotalDays
  # the NOAA-20 afternoon pass over the region is only published from about 16:00 SGT
  if ($age -eq 0 -and $nowSgt.Hour -lt 16) { continue }
  $recent = $age -le 1
  if (-not $recent -and $known.ContainsKey($ds) -and (Test-Path (Join-Path $dir "tc_$ds.jpg"))) { $counts += $known[$ds]; continue }
  $jobs = @(
    @{ f = "tc_$ds.jpg"; u = "$base&LAYERS=VIIRS_NOAA20_CorrectedReflectance_TrueColor,Coastlines_15m&WIDTH=1200&HEIGHT=600&FORMAT=image/jpeg&TIME=$ds" },
    @{ f = "fire_$ds.png"; u = "$base&LAYERS=VIIRS_NOAA20_Thermal_Anomalies_375m_All,VIIRS_SNPP_Thermal_Anomalies_375m_All&WIDTH=1200&HEIGHT=600&FORMAT=image/png&TRANSPARENT=TRUE&TIME=$ds" },
    @{ f = "aod_$ds.png"; u = "$base&LAYERS=VIIRS_NOAA20_AOD_Deep_Blue_Land_Ocean&WIDTH=1200&HEIGHT=600&FORMAT=image/png&TRANSPARENT=TRUE&TIME=$ds" }
  )
  foreach ($j in $jobs) {
    $p = Join-Path $dir $j.f
    if ((Test-Path $p) -and -not $recent) { continue }
    for ($i = 0; $i -lt 3; $i++) { try { Invoke-WebRequest $j.u -OutFile $p -UseBasicParsing -TimeoutSec 90; break } catch { Start-Sleep 3 } }
  }
  $fp = Join-Path $dir "fire_$ds.png"
  if (-not (Test-Path $fp)) { continue }
  $s = [Px]::Count($fp, 99, 106.3, -6, 2.5)
  $k = [Px]::Count($fp, 108.5, 118, -4.5, 4)
  $counts += [pscustomobject]@{ d = $ds; sum = $s; kal = $k }
  Write-Output "SAT $ds sum=$s kal=$k"
}
ConvertTo-Json @($counts) -Compress | Out-File $out -Encoding utf8
