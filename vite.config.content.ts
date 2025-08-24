import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Config specifically for content script (IIFE format)
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/content/content-script.ts'),
      name: 'CogixContent',
      formats: ['iife'],
      fileName: () => 'content-script.js'
    },
    rollupOptions: {
      output: {
        dir: 'dist-dev/content',
        entryFileNames: 'content-script.js',
        format: 'iife'
      }
    },
    outDir: 'dist-dev/content',
    emptyOutDir: false,
    sourcemap: 'inline',
    minify: false
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@lib': resolve(__dirname, 'src/lib'),
    }
  }
});