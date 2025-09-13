# GitHub Secrets Setup for Browser Plugin

## Overview

The GitHub Actions workflow requires several secrets to be configured in order to properly build the browser extension. These secrets provide the environment variables that Plasmo uses to replace placeholders in the manifest.json file.

## Required Secrets

You need to configure the following secrets in your GitHub repository settings:

### 1. PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY
- **Description**: Clerk publishable key for authentication
- **Format**: `pk_live_...` (production) or `pk_test_...` (development)
- **Example**: `pk_live_abcd1234...`

### 2. PLASMO_PUBLIC_CLERK_SYNC_HOST
- **Description**: The sync host URL for authentication synchronization
- **Format**: Full HTTPS URL
- **Example**: `https://cogix.app`

### 3. CLERK_FRONTEND_API
- **Description**: Clerk frontend API endpoint
- **Format**: Full HTTPS URL
- **Example**: `https://clerk.cogix.app` or `https://solid-moray-68.clerk.accounts.dev`

### 4. PLASMO_PUBLIC_API_URL
- **Description**: Main API endpoint for the Cogix backend
- **Format**: Full HTTPS URL
- **Example**: `https://api.cogix.app`

### 5. PLASMO_PUBLIC_DATA_IO_URL
- **Description**: Data collection API endpoint
- **Format**: Full HTTPS URL
- **Example**: `https://data-io.cogix.app`

### 6. CRX_PUBLIC_KEY
- **Description**: Public key for consistent Chrome extension ID
- **Format**: Base64 encoded key
- **Example**: `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...`

## How to Set Up GitHub Secrets

1. Go to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add each secret with the name and value from the list above

## Environment Variable Mapping

These secrets are used in the GitHub Actions workflow and map to the following manifest placeholders:

| GitHub Secret | Manifest Placeholder | Purpose |
|---------------|---------------------|---------|
| `PLASMO_PUBLIC_CLERK_SYNC_HOST` | `$PLASMO_PUBLIC_CLERK_SYNC_HOST/*` | Auth sync permissions |
| `CLERK_FRONTEND_API` | `$CLERK_FRONTEND_API/*` | Clerk API permissions |
| `PLASMO_PUBLIC_API_URL` | `$PLASMO_PUBLIC_API_URL/*` | Main API permissions |
| `CRX_PUBLIC_KEY` | `$CRX_PUBLIC_KEY` | Extension key for consistent ID |

## Development vs Production Values

### Development Values
```
PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_FRONTEND_API=https://solid-moray-68.clerk.accounts.dev
PLASMO_PUBLIC_CLERK_SYNC_HOST=http://localhost:3000
PLASMO_PUBLIC_API_URL=http://localhost:8000
PLASMO_PUBLIC_DATA_IO_URL=http://localhost:8001
```

### Production Values
```
PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_FRONTEND_API=https://clerk.cogix.app
PLASMO_PUBLIC_CLERK_SYNC_HOST=https://cogix.app
PLASMO_PUBLIC_API_URL=https://api.cogix.app
PLASMO_PUBLIC_DATA_IO_URL=https://data-io.cogix.app
```

## Troubleshooting

### Error: "URL pattern '$PLASMO_PUBLIC_*' is malformed"
This error occurs when the environment variables are not properly set during the build process. Make sure:

1. All required secrets are configured in GitHub
2. The secret names match exactly (case-sensitive)
3. The secret values are valid URLs (for URL-type secrets)

### Verifying Build Output
You can check the GitHub Actions logs to see if the environment variables are being used correctly:

1. Go to the **Actions** tab in your repository
2. Click on the failed workflow run
3. Expand the "Build extension" step
4. Look for any error messages about malformed URLs

### Testing Locally
To test if your environment variables work locally:

1. Create a `.env.production` file with your production values
2. Run `npm run build`
3. Check the generated `build/chrome-mv3-prod/manifest.json` file
4. Verify that all `$PLASMO_PUBLIC_*` placeholders have been replaced

## Security Notes

- Never commit actual secret values to your repository
- Use different keys for development and production
- Regularly rotate your API keys
- Monitor for any unauthorized usage of your keys

## Related Files

- `.github/workflows/release.yml` - GitHub Actions workflow
- `package.json` - Manifest configuration with placeholders
- `PRODUCTION_DEPLOYMENT.md` - Production deployment guide
