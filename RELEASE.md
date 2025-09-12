# Release Process for Cogix Eye Tracking Browser Extension

This document outlines the automated release process for the Cogix Eye Tracking browser extension.

## Overview

The release process is fully automated using GitHub Actions and includes:
- Building the extension for production
- Creating a versioned ZIP file
- Creating a GitHub release with installation instructions
- Uploading the extension as a release asset

## Release Workflows

### 1. Continuous Integration (`build.yml`)
- **Triggers**: Push to `main` or `develop`, Pull requests to `main`
- **Purpose**: Ensures the extension builds successfully on every change
- **Artifacts**: Creates build artifacts for testing (retained for 30 days)

### 2. Release Workflow (`release.yml`)
- **Triggers**: 
  - Git tags matching `v*.*.*` pattern (e.g., `v1.0.0`, `v1.2.3`)
  - Manual workflow dispatch
  - GitHub releases
- **Purpose**: Creates official releases with downloadable extension files
- **Artifacts**: Creates GitHub releases with ZIP files (retained for 90 days)

## How to Create a Release

### Method 1: Using the Release Script (Recommended)

The easiest way to create a release is using the included release script:

```bash
# Patch version (1.0.0 -> 1.0.1)
npm run release:patch

# Minor version (1.0.0 -> 1.1.0)
npm run release:minor

# Major version (1.0.0 -> 2.0.0)
npm run release:major

# Specific version
npm run release 1.2.3
```

The script will:
1. Update the version in `package.json`
2. Build and package the extension
3. Commit the version change
4. Create and push a Git tag
5. Trigger the GitHub Actions release workflow

### Method 2: Manual Release

If you prefer manual control:

1. **Update the version** in `package.json`:
   ```json
   {
     "version": "1.2.3"
   }
   ```

2. **Commit the version change**:
   ```bash
   git add package.json
   git commit -m "chore: bump version to 1.2.3"
   ```

3. **Create and push a tag**:
   ```bash
   git tag v1.2.3
   git push
   git push origin v1.2.3
   ```

4. **GitHub Actions will automatically**:
   - Build the extension
   - Create a release
   - Upload the ZIP file

### Method 3: GitHub UI

1. Go to the GitHub repository
2. Click "Releases" → "Create a new release"
3. Create a new tag (e.g., `v1.2.3`)
4. Fill in the release title and description
5. Publish the release
6. GitHub Actions will build and attach the extension ZIP

## Release Assets

Each release includes:
- `cogix-browser-plugin-chrome-v{version}.zip` - The packaged extension ready for installation

## Installation Instructions (Included in Release)

Each GitHub release includes detailed installation instructions:

1. Download the ZIP file from the release
2. Extract to a local folder
3. Open Chrome → `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the extracted folder

## File Structure

The release workflow creates the following structure:

```
build/
├── chrome-mv3-prod/          # Production build directory
│   ├── manifest.json         # Extension manifest
│   ├── popup.html           # Extension popup
│   ├── popup.*.js           # Popup JavaScript
│   ├── popup.*.css          # Popup styles
│   ├── unified-overlay.*.js # Content script
│   ├── static/              # Static assets
│   └── icon*.png            # Extension icons
└── cogix-browser-plugin-chrome-v{version}.zip  # Packaged extension
```

## Environment Variables

The workflows use the following environment variables:
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions
- `NODE_NO_WARNINGS` - Suppresses Node.js warnings during build

## Troubleshooting

### Build Fails
- Check the GitHub Actions logs for detailed error messages
- Ensure all dependencies are properly declared in `package.json`
- Verify the build works locally: `npm run build && npm run package`

### Release Not Created
- Ensure the tag follows the `v*.*.*` pattern (e.g., `v1.0.0`)
- Check that the tag was pushed to the repository
- Verify GitHub Actions has permission to create releases

### Extension Doesn't Load
- Verify the manifest.json is valid
- Check Chrome's extension developer tools for error messages
- Ensure all required permissions are declared

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes

## Security Notes

- The extension uses environment variables for API keys and secrets
- Production builds exclude development-only code
- All releases are publicly available on GitHub

## Support

For issues with the release process:
1. Check the [GitHub Actions Troubleshooting Guide](./GITHUB_ACTIONS_TROUBLESHOOTING.md)
2. Check the GitHub Actions logs
3. Verify local build works: `npm run build` (this creates the zip file automatically)
4. Create an issue in the repository with build logs
