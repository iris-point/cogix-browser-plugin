/**
 * Fix content script imports for Chrome extension
 * Converts ES6 module imports to Chrome extension compatible format
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const contentScriptPath = path.join(__dirname, '../dist/content/content-script.js');
const sharedDir = path.join(__dirname, '../dist/shared');

function fixContentScript() {
  console.log('🔧 Fixing content script imports...');
  
  if (!fs.existsSync(contentScriptPath)) {
    console.warn('⚠️  Content script not found');
    return;
  }

  // Read content script
  let content = fs.readFileSync(contentScriptPath, 'utf8');
  
  // Check if it has ES6 imports
  if (content.includes('import ') || content.includes('export ')) {
    console.log('📝 Found ES6 modules, converting to IIFE...');
    
    // Find all shared chunks that need to be bundled
    const sharedFiles = [];
    if (fs.existsSync(sharedDir)) {
      const files = fs.readdirSync(sharedDir);
      files.forEach(file => {
        if (file.endsWith('.js')) {
          sharedFiles.push(file);
        }
      });
    }
    
    // Create a wrapper that bundles everything
    let bundledContent = '(function() {\n';
    bundledContent += '  "use strict";\n\n';
    
    // Add shared modules first (if any)
    sharedFiles.forEach(file => {
      const sharedContent = fs.readFileSync(path.join(sharedDir, file), 'utf8');
      // Remove export statements
      const cleanedShared = sharedContent
        .replace(/^export\s+{[^}]*};?\s*$/gm, '')
        .replace(/^export\s+default\s+/gm, 'const __default__ = ')
        .replace(/^export\s+/gm, 'const ');
      bundledContent += `  // Shared module: ${file}\n`;
      bundledContent += cleanedShared + '\n\n';
    });
    
    // Process content script
    // Remove import statements and convert to inline
    const processedContent = content
      .replace(/^import\s+.*?from\s+["'][^"']+["'];?\s*$/gm, '')
      .replace(/^export\s+{[^}]*};?\s*$/gm, '')
      .replace(/^export\s+default\s+/gm, 'const __contentDefault__ = ')
      .replace(/^export\s+/gm, 'const ');
    
    bundledContent += '  // Main content script\n';
    bundledContent += processedContent;
    bundledContent += '\n})();\n';
    
    // Write the fixed content
    fs.writeFileSync(contentScriptPath, bundledContent);
    console.log('✅ Content script fixed');
  } else {
    console.log('✅ Content script already in correct format');
  }
}

// Run the fix
fixContentScript();