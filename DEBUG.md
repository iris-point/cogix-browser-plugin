# Debugging the Cogix Browser Extension

## Quick Start - Development Mode

### Method 1: Watch Mode (Recommended for Active Development)

1. **Start development build with watch mode:**
   ```bash
   npm run dev
   ```
   This will:
   - Generate icons
   - Build the extension to `dist-dev/` folder
   - Watch for changes and auto-rebuild
   - Include inline source maps for debugging

2. **Load the extension in Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `dist-dev` folder

3. **Enable Chrome DevTools for debugging:**
   - Right-click the extension icon → "Inspect popup" (for popup debugging)
   - Open `chrome://extensions/` → Find your extension → "Inspect views: service worker" (for background script)
   - For content scripts: Open any webpage → F12 → Sources tab → Look for extension files

### Method 2: Direct Source Loading (No Build Required)

For quick testing without any build:

1. **Create a minimal manifest for source loading:**
   ```bash
   # Copy manifest.dev.json to src folder
   cp manifest.dev.json src/manifest.json
   ```

2. **Load source directly:**
   - Open `chrome://extensions/`
   - Load unpacked → Select the `src` folder
   - Note: This works for simple debugging but TypeScript files won't work

### Method 3: Using Chrome DevTools Workspaces

1. **Set up workspace:**
   - Open DevTools (F12)
   - Go to Sources → Filesystem → Add folder to workspace
   - Select `cogix-browser-plugin/src`
   - Allow access when prompted

2. **Live edit capability:**
   - You can now edit files directly in DevTools
   - Changes save back to your filesystem
   - Combined with watch mode for instant updates

## Debugging Features

### 1. Console Logging
All console.log statements are visible in:
- **Popup**: Right-click extension icon → Inspect popup → Console
- **Background**: chrome://extensions → Service worker link → Console
- **Content Script**: Regular webpage console (F12)

### 2. Breakpoints
Set breakpoints in Chrome DevTools:
- Sources tab → Find your extension files
- Click line numbers to set breakpoints
- With source maps, you can debug TypeScript directly

### 3. Chrome Extension APIs
Test APIs in console:
```javascript
// In service worker console
chrome.storage.local.get(null, (data) => console.log(data));
chrome.tabs.query({active: true}, (tabs) => console.log(tabs));

// Test message passing
chrome.runtime.sendMessage({action: 'test'}, response => console.log(response));
```

### 4. React DevTools
Install React DevTools extension for component debugging:
- Inspect popup/options page
- React tab shows component tree and state

### 5. Network Debugging
Monitor API calls:
- DevTools → Network tab
- Filter by domain (cogix.app, localhost)
- Check request/response headers and bodies

## Hot Reload Setup

### Using Extension Reloader
1. Install Chrome Extension Reloader extension
2. It auto-reloads your extension when files change

### Manual Reload
- chrome://extensions → Click reload button on your extension
- Or use Ctrl+R in extension pages

## Debugging Specific Features

### Eye Tracking Connection
```javascript
// In content script console
window.postMessage({action: 'checkConnection'}, '*');
```

### Session Management
```javascript
// In service worker console
chrome.runtime.sendMessage({action: 'getAuthState'}, r => console.log(r));
```

### Project Selection
```javascript
// Check stored project
chrome.storage.local.get('currentProjectId', data => console.log(data));
```

## Common Issues & Solutions

### 1. CORS Errors
- Check manifest.json has proper host_permissions
- Verify backend CORS configuration allows chrome-extension://

### 2. Module Not Found
- Ensure npm install completed
- Check import paths match tsconfig paths

### 3. Service Worker Not Updating
- Hard reload: chrome://extensions → Update button
- Clear service worker: DevTools → Application → Service Workers → Unregister

### 4. Content Script Not Injecting
- Check manifest matches patterns
- Verify tab URL matches content_scripts patterns
- Try manual injection:
  ```javascript
  chrome.scripting.executeScript({
    target: {tabId: tab.id},
    files: ['content/content-script.js']
  });
  ```

## Development Commands

```bash
# Start development with watch
npm run dev

# Build development version once
npm run dev:build

# Watch mode only (after initial build)
npm run dev:watch

# Clean development build
npm run clean:dev

# Production build
npm run build

# Generate icons only
npm run generate:icons
```

## VS Code Debugging

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome with Extension",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/src",
      "runtimeArgs": [
        "--load-extension=${workspaceFolder}/dist-dev"
      ]
    }
  ]
}
```

Then press F5 in VS Code to launch Chrome with your extension loaded.

## Tips

1. **Use conditional logging:**
   ```typescript
   const DEBUG = true; // Set false for production
   if (DEBUG) console.log('Debug info:', data);
   ```

2. **Mock API responses for testing:**
   ```typescript
   // In service worker
   if (MOCK_MODE) {
     return { success: true, data: mockData };
   }
   ```

3. **Test with different websites:**
   - Test on simple HTML pages first
   - Then complex SPAs (React, Angular)
   - Check iframe handling

4. **Monitor performance:**
   - DevTools → Performance tab
   - Check for memory leaks
   - Monitor event listener count