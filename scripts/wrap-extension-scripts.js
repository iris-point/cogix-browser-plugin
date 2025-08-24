/**
 * Wrap extension scripts to fix import issues
 * Creates self-contained scripts without ES6 imports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, '../dist');

function wrapScript(filePath) {
  const fileName = path.basename(filePath);
  console.log(`🔧 Processing ${fileName}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if the script uses ES6 imports
  if (content.includes('import') && content.includes('from')) {
    console.log('  ⚠️  Found ES6 module syntax');
    
    // Read all shared modules that might be imported
    const sharedDir = path.join(distDir, 'shared');
    let sharedCode = '';
    
    if (fs.existsSync(sharedDir)) {
      const sharedFiles = fs.readdirSync(sharedDir).filter(f => f.endsWith('.js'));
      
      for (const file of sharedFiles) {
        const sharedPath = path.join(sharedDir, file);
        let sharedContent = fs.readFileSync(sharedPath, 'utf8');
        
        // Remove all export statements
        sharedContent = sharedContent
          .replace(/^export\s*{[^}]*};?\s*$/gm, '')
          .replace(/export\s+(default\s+)?/g, '')
          .replace(/export\s*{[^}]*}\s*from\s*["'][^"']+["'];?/g, '');
        
        sharedCode += `\n// === Shared module: ${file} ===\n${sharedContent}\n`;
      }
    }
    
    // Remove all import statements from the main content
    content = content.replace(/import\s*{[^}]*}\s*from\s*["'][^"']+["'];?/g, '');
    content = content.replace(/import\s+.*?\s+from\s+["'][^"']+["'];?/g, '');
    
    // Wrap everything in an IIFE
    const wrapped = `(function() {
  'use strict';
  
  // === Shared modules ===
  ${sharedCode}
  
  // === Main script ===
  ${content}
})();`;
    
    // Write the wrapped content back
    fs.writeFileSync(filePath, wrapped);
    console.log(`  ✅ Wrapped ${fileName}`);
  } else {
    console.log(`  ✅ No ES6 imports found`);
  }
}

// Process content and background scripts
console.log('🚀 Wrapping extension scripts...\n');

const contentScript = path.join(distDir, 'content/content-script.js');
const backgroundScript = path.join(distDir, 'background/service-worker.js');

if (fs.existsSync(contentScript)) {
  wrapScript(contentScript);
}

if (fs.existsSync(backgroundScript)) {
  wrapScript(backgroundScript);
}

console.log('\n✅ Script wrapping complete!');