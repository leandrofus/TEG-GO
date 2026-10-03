import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const isProduction = process.env.NODE_ENV === 'production'

// https://vite.dev/config/
export default defineConfig({
  base: isProduction ? '/' : '/',
  plugins: [react(), tailwindcss()],

  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
})
