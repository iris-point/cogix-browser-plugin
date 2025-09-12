# GitHub Actions Troubleshooting Guide

This guide helps resolve common issues with the Cogix Browser Plugin GitHub Actions workflows.

## Common Issues and Solutions

### 1. Release Creation Fails with 403 Error

**Error Message:**
```
⚠️ GitHub release failed with status: 403
❌ Too many retries. Aborting...
```

**Cause:** Insufficient permissions for the GitHub Actions workflow to create releases.

**Solution:** ✅ **FIXED** - The workflow now includes the required permissions:
```yaml
permissions:
  contents: write
  releases: write
```

**Additional Steps:**
1. Ensure the repository settings allow GitHub Actions to create releases:
   - Go to Settings → Actions → General
   - Under "Workflow permissions", select "Read and write permissions"
   - Check "Allow GitHub Actions to create and approve pull requests"

2. If using a personal access token, ensure it has the `repo` scope.

### 2. Build Artifacts Upload Fails

**Error Message:**
```
Error: Artifact upload failed
```

**Cause:** Missing permissions to write artifacts.

**Solution:** ✅ **FIXED** - The build workflow includes:
```yaml
permissions:
  contents: read
  actions: write
```

### 3. Tag Creation Fails

**Error Message:**
```
Permission denied (publickey)
fatal: Could not read from remote repository
```

**Cause:** SSH key or authentication issues.

**Solutions:**
1. Use HTTPS instead of SSH for git operations
2. Ensure the repository has proper access tokens
3. Check that the workflow has `contents: write` permission

### 4. Extension Build Fails

**Error Message:**
```
npm ERR! code ENOENT
npm ERR! syscall open
npm ERR! path /path/to/package.json
```

**Solutions:**
1. Verify `package.json` exists and is valid
2. Check Node.js version compatibility (workflow uses Node 18)
3. Clear npm cache: add step with `npm cache clean --force`

### 5. Environment Variables Missing

**Error Message:**
```
Environment variable PLASMO_PUBLIC_* is not defined
```

**Solutions:**
1. Add required environment variables to repository secrets:
   - Go to Settings → Secrets and variables → Actions
   - Add the missing environment variables
2. Update the workflow to include the secrets:
```yaml
env:
  PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.CLERK_PUBLISHABLE_KEY }}
  PLASMO_PUBLIC_CLERK_SYNC_HOST: ${{ secrets.CLERK_SYNC_HOST }}
```

### 6. Workflow Not Triggering

**Possible Causes:**
- Tag format doesn't match pattern (`v*.*.*`)
- Workflow file has syntax errors
- Repository doesn't have Actions enabled

**Solutions:**
1. Check tag format: `git tag v1.0.0` (not `1.0.0`)
2. Validate YAML syntax using online validators
3. Enable Actions in repository settings

## Testing the Workflows

### Test Build Workflow
```bash
# Push to main branch to trigger build
git push origin main
```

### Test Release Workflow
```bash
# Create and push a tag
git tag v1.0.1
git push origin v1.0.1
```

### Manual Trigger
1. Go to Actions tab in GitHub
2. Select "Build and Release Plugin" workflow
3. Click "Run workflow"
4. Choose branch and click "Run workflow"

## Debugging Steps

### 1. Check Workflow Logs
1. Go to Actions tab in GitHub repository
2. Click on the failed workflow run
3. Expand the failed step to see detailed logs

### 2. Verify Repository Settings
- Settings → Actions → General → Workflow permissions
- Settings → Secrets and variables → Actions

### 3. Test Locally
```bash
# Test build locally
npm install
npm run build  # This automatically creates the zip file

# Verify output
ls -la build/  # Should show chrome-mv3-prod.zip
```

### 4. Check File Permissions
```bash
# In the workflow, add debugging step
- name: Debug permissions
  run: |
    ls -la
    pwd
    whoami
```

## Repository Settings Checklist

- [ ] Actions are enabled
- [ ] Workflow permissions set to "Read and write permissions"
- [ ] Required secrets are configured
- [ ] Branch protection rules don't block the workflow
- [ ] Repository visibility allows Actions (private repos need billing)

## Support

If issues persist:
1. Check the specific error in GitHub Actions logs
2. Verify all repository settings match the requirements
3. Test the build process locally
4. Create an issue with the full error logs

## Workflow Files Location

- Release workflow: `.github/workflows/release.yml`
- Build workflow: `.github/workflows/build.yml`
- Submit workflow: `.github/workflows/submit.yml` (existing)

## Required Permissions Summary

**Release Workflow:**
- `contents: write` - Create releases and tags
- `releases: write` - Publish releases

**Build Workflow:**
- `contents: read` - Read repository content
- `actions: write` - Upload artifacts
