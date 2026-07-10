@echo off
REM ============================================================
REM  Rosemount HQ Dashboard - one-click launcher (Windows)
REM  Serves the Frappe "rosemount" site on PORT 8200.
REM  (Ports 8000/8080/8082/8090 are used by other apps on this
REM   machine, so we use 8200 to avoid conflicts.)
REM  Keep this window OPEN while you use the dashboard.
REM  Close it (or press Ctrl+C) to stop the server.
REM ============================================================

title Rosemount HQ Dashboard (port 8200)
echo.
echo   Starting Rosemount HQ Dashboard on port 8200...
echo   (Frappe is booting inside WSL - this can take ~15s)
echo.
echo   Login:  hq.admin@rosemount.local
echo   URL:    http://localhost:8200/rmdashboard
echo.
echo   Keep this window open. Close it to stop the server.
echo ------------------------------------------------------------

REM Open the browser shortly after, once the server has had time to boot
start "" cmd /c "timeout /t 15 >nul & start """" http://localhost:8200/rmdashboard"

REM Ensure the default site is set, redis is up, then serve the web process on 8200.
wsl -d Ubuntu-24.04 -- bash -lic "cd ~/frappe-bench && bench use rosemount >/dev/null 2>&1; (redis-cli -p 13000 ping >/dev/null 2>&1 || redis-server config/redis_cache.conf --daemonize yes) && (redis-cli -p 11000 ping >/dev/null 2>&1 || redis-server config/redis_queue.conf --daemonize yes) && bench serve --port 8200"

echo.
echo   Server stopped.
pause
