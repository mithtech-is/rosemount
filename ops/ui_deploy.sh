#!/bin/bash
set -e
UI=~/frappe-bench/apps/rosemount_dashboard/dashboard-ui
APP=~/frappe-bench/apps/rosemount_dashboard/rosemount_dashboard
SRC=/mnt/c/Users/supari_k/ayush/HRMS/build/ui/src

# --- final vite config: Frappe base path + stable asset filenames ---
cat > "$UI/vite.config.ts" <<'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  base: '/assets/rosemount_dashboard/rmdash/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (info) => {
          const n = (info.names && info.names[0]) || info.name || ''
          return n.endsWith('.css') ? 'assets/app.css' : 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
})
EOF

# --- copy source ---
mkdir -p "$UI/src/lib"
cp "$SRC/lib/api.ts"     "$UI/src/lib/api.ts"
cp "$SRC/lib/static.ts"  "$UI/src/lib/static.ts"
cp "$SRC/lib/table.ts"   "$UI/src/lib/table.ts"
cp "$SRC/lib/forms.tsx"  "$UI/src/lib/forms.tsx"
cp "$SRC/lib/ui.tsx"     "$UI/src/lib/ui.tsx"
cp "$SRC/screens.tsx"    "$UI/src/screens.tsx"
cp "$SRC/App.tsx"        "$UI/src/App.tsx"
cp "$SRC/main.tsx"       "$UI/src/main.tsx"
cp "$SRC/brand.css"      "$UI/src/brand.css"

# --- ensure extra shadcn components exist ---
cd "$UI"
npx --yes shadcn@latest add -y -o textarea dialog sonner label >/dev/null 2>&1 || true
# shadcn's sonner pulls in next-themes (not present in Vite) -> use a minimal Toaster
cat > "$UI/src/components/ui/sonner.tsx" <<'EOF'
import { Toaster as Sonner } from "sonner";
export function Toaster(props: React.ComponentProps<typeof Sonner>) {
  return <Sonner theme="light" className="toaster group" {...props} />;
}
EOF

# --- build ---
npm run build

# --- publish into app public/ (served at /assets/rosemount_dashboard/rmdash/) ---
rm -rf "$APP/public/rmdash"
mkdir -p "$APP/public/rmdash"
cp -r dist/* "$APP/public/rmdash/"

# --- login + HQ-gate controller (provides csrf_token to the shell) ---
cp /mnt/c/Users/supari_k/ayush/HRMS/build/www/rmdashboard.py "$APP/www/rmdashboard.py"

# --- SPA shell as a login-gated Frappe www page at /rmdashboard ---
cat > "$APP/www/rmdashboard.html" <<'EOF'
{% extends "templates/base.html" %}
{% block title %}Rosemount HQ Dashboard{% endblock %}
{% block navbar %}{% endblock %}
{% block footer %}{% endblock %}
{% block style %}<link rel="stylesheet" href="/assets/rosemount_dashboard/rmdash/assets/app.css">{% endblock %}
{% block content %}<div id="root"></div>{% endblock %}
{% block script %}<script>window.csrf_token = "{{ csrf_token }}";</script><script type="module" src="/assets/rosemount_dashboard/rmdash/assets/app.js"></script>{% endblock %}
EOF

cd ~/frappe-bench
bench --site rosemount clear-cache >/dev/null 2>&1 || true
echo "=== published assets ==="
ls "$APP/public/rmdash/assets" | head
echo "DEPLOY_OK"
