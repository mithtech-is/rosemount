#!/bin/bash
set -e
cd ~/frappe-bench/apps/rosemount_dashboard
rm -rf dashboard-ui
export npm_config_yes=true CI=1
echo "=== create vite app ==="
npm create vite@latest dashboard-ui -- --template react-ts
cd dashboard-ui
echo "=== npm install (base) ==="
npm install --no-audit --no-fund
echo "=== add deps: tailwind, shadcn prereqs, next-icons, recharts ==="
npm install --no-audit --no-fund tailwindcss @tailwindcss/vite @deemlol/next-icons
npm install --no-audit --no-fund -D @types/node
echo "=== baseline build ==="
npm run build
echo "=== node/vite versions ==="
node -v; npx vite --version
echo "SCAFFOLD_OK"
