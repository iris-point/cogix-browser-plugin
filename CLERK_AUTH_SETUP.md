# Clerk Authentication Setup for Cogix Browser Extension

## Overview
This Chrome extension syncs authentication with the main Cogix web application using Clerk's Sync Host feature.

## Setup Instructions

### 1. Load the Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `cogix-browser-plugin/build/chrome-mv3-dev` directory
4. Note the Extension ID that appears (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

### 2. Configure the Web App to Accept the Extension
The extension ID needs to be added to Clerk's allowed origins. Run this command with your Clerk secret key:

```bash
# Replace YOUR_SECRET_KEY with your Clerk secret (from cogix-frontend/.env.local)
# Replace EXTENSION_ID with the ID from step 1
curl -X PATCH https://api.clerk.com/v1/instance \
  -H "Authorization: Bearer YOUR_SECRET_KEY" \
  -H "Content-type: application/json" \
  -d '{"allowed_origins": ["chrome-extension://EXTENSION_ID"]}'
```

### 3. Test the Authentication Sync

#### Development Testing:
1. Start the Cogix frontend: `cd cogix-frontend && npm run dev`
2. Sign in to the web app at http://localhost:3000
3. Click the extension icon in Chrome
4. You should be automatically signed in to the extension

#### Production Testing:
1. Build for production: `cd cogix-browser-plugin && npm run build`
2. Load the production build from `build/chrome-mv3-prod`
3. Sign in at https://cogix.app
4. The extension should sync the authentication

## File Structure

```
cogix-browser-plugin/
├── src/
│   ├── popup/
│   │   ├── layouts/
│   │   │   └── root-layout.tsx    # ClerkProvider with sync host
│   │   └── pages/
│   │       ├── home.tsx           # Main authenticated view
│   │       ├── sign-in.tsx        # Sign in page
│   │       ├── sign-up.tsx        # Sign up page
│   │       └── settings.tsx       # Extension settings
│   └── popup.tsx                   # Router configuration
├── .env.development                # Dev environment variables
├── .env.production                 # Prod environment variables
└── package.json                    # Manifest configuration
```

## Key Features

1. **Authentication Sync**: Automatically syncs auth state with the web app
2. **Eye Tracking Control**: Start/stop eye tracking sessions
3. **Recording Management**: Control screen and event recording
4. **Settings**: Configure auto-start, webcam, and data endpoints

## Environment Variables

### Development (.env.development)
```env
PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_FRONTEND_API=https://solid-moray-68.clerk.accounts.dev
PLASMO_PUBLIC_CLERK_SYNC_HOST=http://localhost:3000
CRX_PUBLIC_KEY=... # For consistent extension ID
```

### Production (.env.production)
```env
PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_FRONTEND_API=https://solid-moray-68.clerk.accounts.dev
PLASMO_PUBLIC_CLERK_SYNC_HOST=https://cogix.app
CRX_PUBLIC_KEY=... # Same key for consistent ID
```

## Troubleshooting

1. **Extension not syncing auth**: 
   - Ensure the extension ID is added to Clerk's allowed origins
   - Check that sync host matches your web app URL
   - Verify cookies are enabled for the sync host domain

2. **Build errors**:
   - Run `npm install` to ensure all dependencies are installed
   - Check that environment files exist with correct values

3. **Authentication methods hidden**:
   - Social auth buttons are intentionally hidden in the extension
   - Only email/password authentication is supported

## Development Commands

```bash
# Install dependencies
npm install

# Development build with hot reload
npm run dev

# Production build
npm run build

# Package for distribution
npm run package
```