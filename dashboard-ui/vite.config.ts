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
