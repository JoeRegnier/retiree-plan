import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // bind to 0.0.0.0 — accessible from any machine on the network
    port: 5173,
    allowedHosts: true, // allow LAN IP access (Vite 6 host-check bypass)
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('@mui') || id.includes('@emotion')) {
              return 'vendor-mui';
            }
            if (id.includes('/d3') || id.includes('/d3-')) {
              return 'vendor-d3';
            }
            if (id.includes('@tanstack')) {
              return 'vendor-query';
            }
          }
        },
      },
    },
  },
});
