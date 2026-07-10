#!/bin/bash
cd ~/frappe-bench || exit 1
echo '--- listeners ---'
ss -ltn 2>/dev/null | grep -E ':8000|:8090' || echo none
echo '--- route codes on 8090 ---'
for r in / /login /app /rmdashboard; do
  printf '%-14s ' "$r"
  curl -s -o /dev/null -w 'http %{http_code}\n' "http://localhost:8090$r"
done
echo '--- apps installed ON SITE rosemount ---'
bench --site rosemount list-apps 2>&1 | head -30
echo '--- bench apps.txt ---'
cat sites/apps.txt
echo '--- rmdashboard body (first 400 chars on 8090) ---'
curl -s "http://localhost:8090/rmdashboard" | head -c 400
echo
