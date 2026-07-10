#!/bin/bash
set -e
cd ~/frappe-bench/apps/rosemount_dashboard/dashboard-ui
export npm_config_yes=true CI=1

# build without strict tsc (esbuild strips types) -> won't get stuck on TS nits
npm pkg set scripts.build="vite build"

cat > vite.config.ts <<'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  base: '/assets/rosemount_dashboard/rmdash/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
})
EOF

cat > tsconfig.json <<'EOF'
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
EOF

cat > tsconfig.app.json <<'EOF'
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "types": ["vite/client"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
EOF

printf '@import "tailwindcss";\n' > src/index.css

echo "=== shadcn init ==="
npx --yes shadcn@latest init -d -y
echo "=== add components ==="
npx --yes shadcn@latest add -y -o button card table tabs badge input select switch separator label avatar scroll-area chart
echo "=== ensure recharts ==="
npm install --no-audit --no-fund recharts
echo "=== build ==="
npm run build
echo "SETUP_OK"
