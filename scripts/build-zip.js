#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read package.json to get version
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;
const name = packageJson.name;

console.log(`🚀 Building ${name} v${version}...`);

try {
  // Run build
  console.log('📦 Building extension...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Run package (creates zip)
  console.log('🗜️ Creating zip package...');
  execSync('npm run package', { stdio: 'inherit' });
  
  // Copy zip with versioned name
  const sourceZip = path.join('build', 'chrome-mv3-prod.zip');
  const destZip = path.join('build', `${name}-v${version}.zip`);
  
  if (fs.existsSync(sourceZip)) {
    fs.copyFileSync(sourceZip, destZip);
    console.log(`✅ Extension packaged successfully!`);
    console.log(`📁 Output files:`);
    console.log(`   - build/chrome-mv3-prod.zip (for Chrome Web Store)`);
    console.log(`   - build/${name}-v${version}.zip (versioned backup)`);
    
    // Show file size
    const stats = fs.statSync(sourceZip);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 Package size: ${fileSizeInMB} MB`);
  } else {
    console.error('❌ Build failed: zip file not found');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}