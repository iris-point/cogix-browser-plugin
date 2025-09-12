#!/usr/bin/env node

/**
 * Release helper script for Cogix Eye Tracking Browser Extension
 * 
 * Usage:
 *   node scripts/release.js patch   # 1.0.0 -> 1.0.1
 *   node scripts/release.js minor   # 1.0.0 -> 1.1.0
 *   node scripts/release.js major   # 1.0.0 -> 2.0.0
 *   node scripts/release.js 1.2.3   # Set specific version
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');

function getCurrentVersion() {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

function updateVersion(newVersion) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  return newVersion;
}

function incrementVersion(currentVersion, type) {
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Invalid version type: ${type}`);
  }
}

function isValidVersion(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function run(command) {
  console.log(`Running: ${command}`);
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Failed to run: ${command}`);
    process.exit(1);
  }
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node scripts/release.js <patch|minor|major|version>');
    process.exit(1);
  }
  
  const versionArg = args[0];
  const currentVersion = getCurrentVersion();
  
  console.log(`Current version: ${currentVersion}`);
  
  let newVersion;
  
  if (['patch', 'minor', 'major'].includes(versionArg)) {
    newVersion = incrementVersion(currentVersion, versionArg);
  } else if (isValidVersion(versionArg)) {
    newVersion = versionArg;
  } else {
    console.error(`Invalid version argument: ${versionArg}`);
    console.error('Use: patch, minor, major, or a specific version like 1.2.3');
    process.exit(1);
  }
  
  console.log(`New version: ${newVersion}`);
  
  // Confirm with user
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  readline.question(`Release version ${newVersion}? (y/N) `, (answer) => {
    readline.close();
    
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('Release cancelled');
      process.exit(0);
    }
    
    try {
      // Update package.json
      updateVersion(newVersion);
      console.log('✓ Updated package.json');
      
      // Build the extension (this also creates the zip file)
      console.log('Building extension...');
      run('npm run build');
      console.log('✓ Extension built and packaged successfully');
      
      // Git operations
      console.log('Committing changes...');
      run('git add package.json');
      run(`git commit -m "chore: bump version to ${newVersion}"`);
      console.log('✓ Changes committed');
      
      // Create and push tag
      console.log('Creating and pushing tag...');
      run(`git tag v${newVersion}`);
      run('git push');
      run(`git push origin v${newVersion}`);
      console.log('✓ Tag created and pushed');
      
      console.log('');
      console.log('🎉 Release process completed!');
      console.log(`Version ${newVersion} has been released.`);
      console.log('The GitHub workflow will automatically create a release with the built extension.');
      console.log('');
      console.log('Next steps:');
      console.log('1. Check the GitHub Actions workflow for build status');
      console.log('2. Verify the release was created at: https://github.com/your-org/cogix-browser-plugin/releases');
      console.log('3. Test the released extension');
      
    } catch (error) {
      console.error('Release failed:', error.message);
      process.exit(1);
    }
  });
}

main();
