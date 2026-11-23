import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(process.cwd(), 'src/client'),
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(process.cwd(), 'src/shared'),
      '@': path.resolve(process.cwd(), 'src/client'),
    },
  },
  build: {
    outDir: path.resolve(process.cwd(), 'dist/client'),
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    hmr: false,
  },
});
