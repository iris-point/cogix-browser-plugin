/**
 * Fix ES6 imports in built files for Chrome Extension compatibility
 * Converts module imports to self-contained scripts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, '../dist');

function processFile(filePath) {
  console.log(`Processing ${path.basename(filePath)}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if file has ES6 imports (including minified)
  if (content.includes('import ') || content.includes('import{') || content.includes('from"../') || content.includes('from "../shared/')) {
    console.log('  Found ES6 imports, converting...');
    
    // Extract all imports
    const importRegex = /import\s*{([^}]+)}\s*from\s*["']([^"']+)["'];?/g;
    const imports = [];
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push({
        items: match[1],
        path: match[2]
      });
    }
    
    // Read and inline imported modules
    let inlinedCode = '';
    const processedPaths = new Set();
    
    for (const imp of imports) {
      if (!processedPaths.has(imp.path)) {
        const importPath = path.join(path.dirname(filePath), imp.path);
        if (fs.existsSync(importPath)) {
          console.log(`  Inlining ${imp.path}...`);
          let importedContent = fs.readFileSync(importPath, 'utf8');
          
          // Remove export statements from imported content
          importedContent = importedContent
            .replace(/^export\s*{[^}]*};?\s*$/gm, '')
            .replace(/^export\s+(default\s+)?/gm, 'const ')
            .replace(/^import\s+.*?from\s+["'][^"']+["'];?\s*$/gm, '');
          
          inlinedCode += `\n// Inlined from ${imp.path}\n${importedContent}\n`;
          processedPaths.add(imp.path);
        }
      }
    }
    
    // Remove import statements from main content
    content = content.replace(/^import\s+.*?from\s+["'][^"']+["'];?\s*$/gm, '');
    
    // Wrap everything in IIFE
    const wrappedContent = `(function() {
  'use strict';
  ${inlinedCode}
  ${content}
})();`;
    
    fs.writeFileSync(filePath, wrappedContent);
    console.log(`  ✅ Fixed ${path.basename(filePath)}`);
  } else {
    console.log(`  ✅ No imports found`);
  }
}

// Process content script and background script
const filesToProcess = [
  path.join(distDir, 'content/content-script.js'),
  path.join(distDir, 'background/service-worker.js')
];

console.log('🔧 Fixing ES6 imports in extension scripts...\n');

for (const file of filesToProcess) {
  if (fs.existsSync(file)) {
    processFile(file);
  } else {
    console.warn(`⚠️  File not found: ${file}`);
  }
}

console.log('\n✅ Import fixing complete!');