/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const variables = loadEnv(mode, process.cwd(), '');
  const urlApi = variables.VITE_URL_API || 'http://localhost:3000';

  return {
    plugins: [
      react(),
      // Tailwind CSS v4 — sin tailwind.config.js, detección automática de clases
      tailwindcss(),
    ],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      hmr: {
        host: 'localhost',
        port: 5173,
        clientPort: 5173,
      },
      proxy: {
        '/auth': {
          target: urlApi,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }

            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }

            if (id.includes('/node_modules/@tanstack/react-query/')) {
              return 'vendor-query';
            }

            if (
              id.includes('/node_modules/react-router/') ||
              id.includes('/node_modules/react-router-dom/')
            ) {
              return 'vendor-router';
            }

            if (
              id.includes('/node_modules/lucide-react/') ||
              id.includes('/node_modules/canvas-confetti/') ||
              id.includes('/node_modules/react-day-picker/')
            ) {
              return 'vendor-ui';
            }

            return 'vendor';
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: false,
      setupFiles: ['./src/test/setup.ts'],
      exclude: ['**/node_modules/**', '**/dist/**'],
      environmentMatchGlobs: [
        // Los tests del servidor (Node puro) no necesitan DOM
        ['server/src/**/*.test.ts', 'node'],
      ],
    },
  };
});
