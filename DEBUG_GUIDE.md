# Chrome Extension Debugging Guide

## 🚀 Quick Start

### 1. Build the Extension
```bash
cd cogix-browser-plugin

# Development build (with hot reload and debugging)
npm run dev

# OR Production build
npm run build
```

### 2. Load in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the folder:
   - Development: `cogix-browser-plugin/build/chrome-mv3-dev`
   - Production: `cogix-browser-plugin/build/chrome-mv3-prod`
5. Note the Extension ID (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

### 3. Open Debug Tools

#### Extension Popup Debug
1. Click the extension icon in Chrome toolbar
2. Right-click on the popup
3. Select "Inspect" to open DevTools
4. Navigate to the Debug page (link in footer)

#### Background Script Debug
1. Go to `chrome://extensions/`
2. Find your extension
3. Click "background page" or "service worker"
4. This opens DevTools for the background script

## 🔍 Debug Features

### Built-in Debug Page
The extension includes a debug page accessible from the popup:
- Shows authentication status
- Displays extension information
- Shows debug logs
- Tests authentication flow

### Debug Utilities
Located in `src/utils/debug.ts`:
- `debugLog(category, message, data)` - Logs with timestamp and category
- `getDebugLogs()` - Retrieves stored debug logs
- `clearDebugLogs()` - Clears all debug logs

### Background Script Debugging
The background script (`src/background.ts`) provides:
- Message logging
- Auth status monitoring
- Storage change tracking
- Console commands:
  ```javascript
  // In background script console:
  cogixDebug.getLogs()       // Get all debug logs
  cogixDebug.clearLogs()     // Clear logs
  cogixDebug.getAuthStatus() // Check auth status
  ```

### Test Page
Open `test-extension.html` in Chrome to:
- Check if extension is loaded
- Test authentication
- View debug logs
- Send test messages

## 🔐 Authentication Debugging

### Check Clerk Configuration
1. Verify environment variables in `.env.development`:
   ```env
   PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_FRONTEND_API=https://solid-moray-68.clerk.accounts.dev
   PLASMO_PUBLIC_CLERK_SYNC_HOST=https://cogix.app
   ```

2. Ensure the extension ID is added to Clerk's allowed origins:
   ```bash
   curl -X PATCH https://api.clerk.com/v1/instance \
     -H "Authorization: Bearer sk_test_..." \
     -H "Content-type: application/json" \
     -d '{"allowed_origins": ["chrome-extension://YOUR_EXTENSION_ID"]}'
   ```

### Authentication Flow
1. **Sign in to web app** at the sync host URL (e.g., https://cogix.app)
2. **Open extension popup** - should automatically sync auth
3. **Check debug page** for auth status and tokens

### Common Auth Issues

#### "Not authenticated" in extension
- **Cause**: Extension ID not in Clerk's allowed origins
- **Fix**: Add extension ID using the curl command above

#### "Sync host not responding"
- **Cause**: Incorrect sync host URL or CORS issues
- **Fix**: Verify sync host matches your web app URL

#### "Token expired"
- **Cause**: Session timeout
- **Fix**: Re-authenticate in the web app

## 📊 Monitoring & Logs

### Console Logs
All debug logs appear in:
1. **Popup DevTools Console** - for popup scripts
2. **Background Script Console** - for background processes
3. **Debug Page** - consolidated view
4. **Test Page** - external testing

### Storage Inspector
1. Open DevTools in popup or background
2. Go to Application tab
3. Check Storage > Local Storage for debug logs
4. Check Storage > Sync Storage for auth data

### Network Monitoring
1. Open DevTools Network tab
2. Look for:
   - Clerk API calls
   - WebSocket connections
   - Data API requests

## 🐛 Troubleshooting

### Extension Not Loading
```bash
# Check for build errors
npm run build

# Look for syntax errors in manifest
cat build/chrome-mv3-dev/manifest.json
```

### Popup Not Opening
- Check Chrome toolbar for extension icon
- Try pinning the extension
- Check for JavaScript errors in background script

### Authentication Issues
1. Clear extension storage:
   ```javascript
   // In background console
   chrome.storage.sync.clear()
   chrome.storage.local.clear()
   ```

2. Re-authenticate:
   - Sign out from web app
   - Clear cookies for sync host
   - Sign in again

### Message Passing Issues
```javascript
// Test from console
chrome.runtime.sendMessage(
  'EXTENSION_ID',
  { type: 'PING' },
  response => console.log(response)
)
```

## 🛠️ Development Tips

### Hot Reload
When using `npm run dev`, most changes auto-reload except:
- Manifest changes - manually reload extension
- Background script changes - click reload button
- Content script changes - refresh the page

### Debug Mode Toggle
Edit `src/utils/debug.ts`:
```typescript
export const DEBUG = true;  // Enable debug logs
export const DEBUG = false; // Disable for production
```

### Testing Different Environments
```bash
# Development (localhost)
PLASMO_PUBLIC_CLERK_SYNC_HOST=http://localhost:3000 npm run dev

# Production
PLASMO_PUBLIC_CLERK_SYNC_HOST=https://cogix.app npm run build
```

## 📝 Debug Checklist

When debugging issues, check:

- [ ] Extension is loaded in Chrome
- [ ] Extension ID is noted
- [ ] Environment variables are correct
- [ ] Extension ID is in Clerk's allowed origins
- [ ] User is signed in to web app
- [ ] Cookies are enabled for sync host
- [ ] No errors in background script console
- [ ] No errors in popup console
- [ ] Debug logs show expected flow
- [ ] Network requests are successful

## 🔗 Useful Links

- [Chrome Extension DevTools](https://developer.chrome.com/docs/extensions/mv3/devtools/)
- [Clerk Chrome Extension Docs](https://clerk.com/docs/references/chrome-extension/overview)
- [Plasmo Framework Docs](https://docs.plasmo.com/)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/)

## 💡 Pro Tips

1. **Use conditional breakpoints** in DevTools for specific scenarios
2. **Export debug logs** as JSON for analysis
3. **Use Chrome Profiles** to test different auth states
4. **Monitor performance** with Chrome Task Manager
5. **Test in Incognito** to check permission handling