import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/',
  resolve: {
    alias: {
      '@game':    path.resolve(__dirname, 'src/game'),
      '@data':    path.resolve(__dirname, 'src/data'),
      '@ui':      path.resolve(__dirname, 'src/ui'),
      '@store':   path.resolve(__dirname, 'src/store'),
      '@systems': path.resolve(__dirname, 'src/systems'),
      '@gtypes':  path.resolve(__dirname, 'src/types'),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
});
