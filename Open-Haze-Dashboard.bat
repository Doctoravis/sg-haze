@echo off
rem Starts the local dashboard server if it is not running yet, then opens the dashboard in the default browser.
powershell -NoProfile -Command "try { (New-Object Net.Sockets.TcpClient('localhost',8765)).Close() } catch { Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0work\serve.ps1\"' }"
timeout /t 2 /nobreak >nul
start "" http://localhost:8765/
