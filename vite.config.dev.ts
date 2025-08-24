import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Development config
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        background: resolve(__dirname, 'src/background/service-worker.ts'),
        content: resolve(__dirname, 'src/content/content-bundled.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background/service-worker.js';
          }
          if (chunkInfo.name === 'content') {
            return 'content/content-script.js';
          }
          return '[name]/[name].js';
        },
        chunkFileNames: 'shared/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    },
    outDir: 'dist-dev',
    emptyOutDir: true,
    sourcemap: 'inline',
    minify: false,
    target: 'chrome90',
    watch: {
      include: 'src/**',
      exclude: 'node_modules/**'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@lib': resolve(__dirname, 'src/lib'),
    }
  },
  define: {
    'process.env.NODE_ENV': '"development"'
  }
});