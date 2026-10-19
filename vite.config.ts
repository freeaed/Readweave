import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Configuration for serving static assets and potentially PDF.js workers
  base: '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Simple structure, no complex chunking for phase 1
      }
    }
  }
})
