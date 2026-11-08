import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies to the app's port, which comes from the environment like everywhere else (BR11.5).
const apiTarget = `http://localhost:${process.env.PORT ?? 3000}`;

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/sse': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
