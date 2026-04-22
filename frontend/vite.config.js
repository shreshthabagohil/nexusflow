import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',    // Bind to all interfaces (required for Docker)
    port: 5173,          // Explicit port
    strictPort: true,    // Fail if port is already taken (avoids silent fallback)
    watch: {
      usePolling: true,  // Required for hot-reload with Docker volume mounts
    },
  },
})