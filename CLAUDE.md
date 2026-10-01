# 新加坡雾霾追踪 dashboard

Public site: https://doctoravis.github.io/sg-haze/ (repo `Doctoravis/sg-haze`, GitHub Pages).
Nothing in normal operation involves Claude. Keep replies and tool use minimal here.

## How it updates

- `.github/workflows/update.yml` runs four times a day on a Windows runner: `work\update.ps1`
  refreshes NEA readings, rainfall and satellite images, commits them, then deploys the site.
  Forecast inputs refresh on the first run of each Singapore day (`work\data\forecast_stamp.txt`).
- The page's 刷新数据 button fetches the hours since the last build straight from NEA in the
  visitor's browser (`liveRefresh` in `work\app.js`) and keeps them for that tab only.
- The outlook, scenario probabilities and status pills are computed in `app.js` from `data.js`.
  Only `work\notes.js` is hand-written.

## Common requests

- Change page text or code: edit under `work\`, then `git add -A; git commit -m "..."; git push`.
  The push redeploys in about a minute. `git pull --rebase` first: the workflow commits data.
- "更新背景说明": edit `work\notes.js` only (`hotspots`, `ensoPill`, `enso`, `days`, `updated`),
  in Simplified Chinese, keeping the structure. Sources: NEA daily haze advisory, asmc.asean.org/home, NOAA CPC.
- Force a data refresh now: `gh workflow run update.yml`. Check runs with `gh run list --limit 3`.
- Local preview: `Open-Haze-Dashboard.bat` (serves `work\` on localhost:8765).

## Notes

- `work\index.html` is a body fragment; the workflow and `serve.ps1` wrap it in a document.
- `.ps1` files must stay ASCII-only (Windows PowerShell 5.1 reads them as ANSI).
- `git` and `gh` were installed with winget; a new shell may need the PATH refreshed.
