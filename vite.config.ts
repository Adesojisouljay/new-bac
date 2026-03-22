import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import wasm from 'vite-plugin-wasm'


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    wasm(),

    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    allowedHosts: true,
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      cache: false,
    },
    chunkSizeWarningLimit: 2000,
  }
})
