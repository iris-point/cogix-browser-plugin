/**
 * Copy development manifest and icons to dist-dev folder
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const distDev = path.join(rootDir, 'dist-dev');
const iconsSource = path.join(rootDir, 'public', 'icons');
const iconsDest = path.join(distDev, 'icons');

// Create dist-dev directory if it doesn't exist
if (!fs.existsSync(distDev)) {
  fs.mkdirSync(distDev, { recursive: true });
  console.log('✅ Created dist-dev directory');
}

// Copy manifest
const manifestSource = path.join(rootDir, 'manifest.dev.json');
const manifestDest = path.join(distDev, 'manifest.json');
fs.copyFileSync(manifestSource, manifestDest);
console.log('📄 Copied development manifest');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconsDest)) {
  fs.mkdirSync(iconsDest, { recursive: true });
}

// Copy icons
if (fs.existsSync(iconsSource)) {
  const iconFiles = fs.readdirSync(iconsSource);
  iconFiles.forEach(file => {
    const sourcePath = path.join(iconsSource, file);
    const destPath = path.join(iconsDest, file);
    fs.copyFileSync(sourcePath, destPath);
  });
  console.log(`🎨 Copied ${iconFiles.length} icon files`);
} else {
  console.warn('⚠️  Icons directory not found. Run npm run generate:icons first');
}

console.log('✅ Development manifest and assets copied successfully');