#!/bin/bash
# login shell so bench/PATH is available
source ~/.profile 2>/dev/null
source ~/.bashrc 2>/dev/null
cd ~/frappe-bench || exit 1

echo '--- ports currently in use (8000-8100) ---'
ss -ltn 2>/dev/null | awk '{print $4}' | grep -oE ':(80[0-9][0-9]|8100)$' | sort -u

# pick the first free port from a candidate list
for P in 8200 8201 8202 8210 8095 8099; do
  if ! ss -ltn 2>/dev/null | grep -q ":$P$"; then FREE=$P; break; fi
done
echo "--- chosen free port: $FREE ---"

# make sure redis is up
redis-cli -p 13000 ping >/dev/null 2>&1 || redis-server config/redis_cache.conf --daemonize yes
redis-cli -p 11000 ping >/dev/null 2>&1 || redis-server config/redis_queue.conf --daemonize yes

echo "--- starting bench serve on $FREE (background, 12s test) ---"
nohup bench serve --port "$FREE" >/tmp/rmserve.log 2>&1 &
SVPID=$!
sleep 9
echo "rmdashboard: $(curl -s -o /dev/null -w 'http %{http_code}' http://localhost:$FREE/rmdashboard)"
echo "login:       $(curl -s -o /dev/null -w 'http %{http_code}' http://localhost:$FREE/login)"
echo '--- serve log (tail) ---'
tail -n 8 /tmp/rmserve.log
kill $SVPID >/dev/null 2>&1
echo "FREE_PORT=$FREE"
