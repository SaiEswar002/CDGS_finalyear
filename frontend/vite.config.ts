import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // needed for Docker
    proxy: {
      '/api': {
        // In Docker: backend service. Locally: localhost.
        target: process.env.VITE_API_URL ?? 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})

