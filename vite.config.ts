/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    // Tailwind CSS v4 — sin tailwind.config.js, detección automática de clases
    tailwindcss(),
  ],
  test: {
    environment: 'jsdom',
    globals: false,
  },
});
