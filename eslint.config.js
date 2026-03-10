// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Archivos excluidos de la revisión de código
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      // Archivos legacy en la raíz — se migran progresivamente
      'app.tsx',
      'main.tsx',
      'firebaseClient.ts',
      '*.config.js',
      '*.config.ts',
    ],
  },

  // Reglas base de JS
  js.configs.recommended,

  // Reglas de TypeScript con configuración estricta
  ...tseslint.configs.recommended,

  {
    rules: {
      // Advertencia en lugar de error para facilitar la migración progresiva
      '@typescript-eslint/no-explicit-any': 'warn',
      // Desactivar la regla base en favor de la versión TypeScript
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
