import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://host.docker.internal:8001',
    },
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
})
 
