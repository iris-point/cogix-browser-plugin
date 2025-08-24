/**
 * Cross-platform build script for Cogix Browser Extension
 * Handles icon generation and asset copying
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const distDir = path.join(rootDir, 'dist');
const iconsDir = path.join(publicDir, 'icons');
const distIconsDir = path.join(distDir, 'icons');

/**
 * Ensure directory exists
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
}

/**
 * Copy file
 */
function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
  console.log(`📄 Copied: ${path.basename(src)}`);
}

/**
 * Copy directory recursively
 */
function copyDir(src, dest) {
  ensureDir(dest);
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

/**
 * Clean build directory
 */
function cleanBuild() {
  console.log('🧹 Cleaning build directory...');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  ensureDir(distDir);
}

/**
 * Generate icons
 */
function generateIcons() {
  console.log('🎨 Generating icons...');
  
  try {
    execSync('node scripts/generate-icons.js', { 
      cwd: rootDir,
      stdio: 'inherit' 
    });
  } catch (error) {
    console.warn('⚠️  Icon generation had issues, continuing...');
  }
}

/**
 * Build TypeScript and Vite
 */
function buildApp() {
  console.log('🔨 Building application...');
  
  try {
    // TypeScript compilation
    console.log('📝 Compiling TypeScript...');
    execSync('npx tsc', { 
      cwd: rootDir,
      stdio: 'inherit' 
    });
    
    // Vite build
    console.log('⚡ Building with Vite...');
    execSync('npx vite build', { 
      cwd: rootDir,
      stdio: 'inherit' 
    });
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

/**
 * Fix content script imports
 */
function fixContentScript() {
  console.log('🔧 Fixing extension scripts...');
  try {
    // First try the new wrapper script
    execSync('node scripts/wrap-content-script.js', {
      cwd: rootDir,
      stdio: 'inherit'
    });
  } catch (error) {
    console.warn('⚠️  Could not wrap content script, trying fix-imports:', error.message);
    try {
      execSync('node scripts/fix-imports.js', {
        cwd: rootDir,
        stdio: 'inherit'
      });
    } catch (error2) {
      console.warn('⚠️  Could not fix scripts:', error2.message);
    }
  }
}

/**
 * Copy assets to dist
 */
function copyAssets() {
  console.log('📦 Copying assets...');
  
  // Copy manifest
  const manifestSrc = path.join(publicDir, 'manifest.json');
  const manifestDest = path.join(distDir, 'manifest.json');
  if (fs.existsSync(manifestSrc)) {
    copyFile(manifestSrc, manifestDest);
  }
  
  // Copy eye tracking SDK
  console.log('📦 Copying Eye Tracking SDK...');
  const sdkSrc = path.join(__dirname, '../../cogix-eye-tracking/dist/index.umd.js');
  const sdkDest = path.join(distDir, 'eye-tracking-sdk.js');
  if (fs.existsSync(sdkSrc)) {
    copyFile(sdkSrc, sdkDest);
    console.log('✅ Copied eye-tracking-sdk.js');
  } else {
    console.warn('⚠️  Eye tracking SDK not found at:', sdkSrc);
    console.warn('⚠️  Build cogix-eye-tracking first with: cd ../cogix-eye-tracking && npm run build');
  }
  
  // Copy icons
  if (fs.existsSync(iconsDir)) {
    console.log('🎨 Copying icons...');
    copyDir(iconsDir, distIconsDir);
  }
  
  // Copy any other public assets that might be needed
  const publicAssets = ['favicon.ico', 'robots.txt'];
  for (const asset of publicAssets) {
    const src = path.join(publicDir, asset);
    const dest = path.join(distDir, asset);
    if (fs.existsSync(src)) {
      copyFile(src, dest);
    }
  }
}

/**
 * Verify build
 */
function verifyBuild() {
  console.log('✅ Verifying build...');
  
  const requiredFiles = [
    'manifest.json',
    'background/service-worker.js',
    'content/content-script.js',
    'icons/icon-16.png',
    'icons/icon-32.png',
    'icons/icon-48.png',
    'icons/icon-128.png'
  ];
  
  let allGood = true;
  for (const file of requiredFiles) {
    const filePath = path.join(distDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Missing: ${file}`);
      allGood = false;
    }
  }
  
  if (allGood) {
    console.log('✅ Build verification passed!');
  } else {
    console.warn('⚠️  Some files are missing. Extension may not work properly.');
  }
}

/**
 * Main build process
 */
async function build() {
  console.log('🚀 Starting Cogix Browser Extension build...\n');
  
  const startTime = Date.now();
  
  try {
    // Step 1: Clean
    cleanBuild();
    
    // Step 2: Generate icons
    generateIcons();
    
    // Step 3: Build app
    buildApp();
    
    // Step 4: Fix content script
    fixContentScript();
    
    // Step 5: Copy assets
    copyAssets();
    
    // Step 6: Verify
    verifyBuild();
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✨ Build completed in ${elapsed}s`);
    console.log(`📁 Extension ready in: ${distDir}`);
    console.log('\n📋 Next steps:');
    console.log('1. Open chrome://extensions/');
    console.log('2. Enable Developer mode');
    console.log('3. Click "Load unpacked"');
    console.log(`4. Select: ${distDir}`);
    
  } catch (error) {
    console.error('\n❌ Build failed:', error);
    process.exit(1);
  }
}

// Run build if called directly
build();

export { build, cleanBuild, generateIcons, copyAssets };