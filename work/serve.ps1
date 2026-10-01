# Local preview server (localhost only): serves the dashboard files from this folder.
$root = $PSScriptRoot
$port = 8765
$l = New-Object Net.HttpListener
$l.Prefixes.Add("http://localhost:$port/")
$l.Start()
$types = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.jpg' = 'image/jpeg'; '.png' = 'image/png' }
while ($l.IsListening) {
  $ctx = $l.GetContext()
  try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($path -eq '') { $path = 'index.html' }
    $f = [IO.Path]::GetFullPath((Join-Path $root $path))
    $ext = [IO.Path]::GetExtension($f)
    if ($f.StartsWith($root + '\') -and $types.ContainsKey($ext) -and (Test-Path $f -PathType Leaf)) {
      $b = [IO.File]::ReadAllBytes($f)
      if ($path -eq 'index.html') {
        # index.html is a body fragment; wrap it the same way the deploy workflow does
        $html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + [Text.Encoding]::UTF8.GetString($b) + '</body></html>'
        $b = [Text.Encoding]::UTF8.GetBytes($html)
      }
      $ctx.Response.ContentType = $types[$ext]
      $ctx.Response.Headers['Cache-Control'] = 'no-store'
      $ctx.Response.OutputStream.Write($b, 0, $b.Length)
    } else { $ctx.Response.StatusCode = 404 }
  } catch { try { $ctx.Response.StatusCode = 500 } catch {} }
  try { $ctx.Response.Close() } catch {}
}
