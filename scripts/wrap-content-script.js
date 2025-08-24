/**
 * Properly wrap content script for Chrome Extension compatibility
 * This script creates a self-contained content script without ES6 modules
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

async function buildContentScript() {
  console.log('🔨 Building content script with proper bundling...');
  
  // Build content script as IIFE using Vite
  await build({
    root: rootDir,
    build: {
      lib: {
        entry: path.join(rootDir, 'src/content/content-script.ts'),
        name: 'CogixContent',
        formats: ['iife'],
        fileName: () => 'content-script.js'
      },
      rollupOptions: {
        output: {
          dir: path.join(distDir, 'content'),
          entryFileNames: 'content-script.js',
          format: 'iife'
        },
        // Bundle all external dependencies
        external: []
      },
      outDir: path.join(distDir, 'content'),
      emptyOutDir: false,
      sourcemap: false,
      minify: true
    },
    resolve: {
      alias: {
        '@': path.join(rootDir, 'src'),
        '@components': path.join(rootDir, 'src/components'),
        '@lib': path.join(rootDir, 'src/lib'),
      }
    }
  });
  
  // Read the built file
  const contentScriptPath = path.join(distDir, 'content/content-script.js');
  if (!fs.existsSync(contentScriptPath)) {
    throw new Error('Content script not found after build');
  }
  
  let content = fs.readFileSync(contentScriptPath, 'utf8');
  
  // Ensure it's wrapped in IIFE if not already
  if (!content.startsWith('(function()') && !content.startsWith('(()=>')) {
    content = `(function() {
  'use strict';
  ${content}
})();`;
  }
  
  // Write back the wrapped content
  fs.writeFileSync(contentScriptPath, content);
  console.log('✅ Content script properly bundled');
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildContentScript().catch(console.error);
}

export { buildContentScript };