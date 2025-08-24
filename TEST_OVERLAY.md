# Testing the Overlay

## Steps to Test

1. **Reload the Extension**
   - Go to `chrome://extensions/`
   - Find "Cogix Eye Tracking Extension (Dev)"
   - Click the refresh/reload button

2. **Open Developer Console**
   - Go to any website (e.g., google.com)
   - Press F12 to open DevTools
   - Go to Console tab

3. **Click Extension Icon**
   - Click the Cogix extension icon in the toolbar
   - You should see console logs:
     ```
     [Cogix Content] Received message: toggleOverlay
     [Cogix Content] Toggle overlay called
     ```

4. **Check for Overlay**
   - A full-screen overlay should appear with:
     - Login form (if not authenticated)
     - Project selector (if authenticated)
     - Recording options

## Troubleshooting

### If overlay doesn't appear:

1. **Check Console for Errors**
   - Look for any red error messages
   - Common issues:
     - React not loaded
     - Import errors
     - Permission denied

2. **Verify Content Script Loaded**
   - In Console, type:
     ```javascript
     chrome.runtime.sendMessage({action: 'getAuthState'}, r => console.log(r))
     ```
   - Should return auth status

3. **Check Background Service Worker**
   - Go to `chrome://extensions/`
   - Click "service worker" link
   - Check console for errors

4. **Manual Test**
   - In webpage console, inject overlay manually:
   ```javascript
   // Create test overlay
   const div = document.createElement('div');
   div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:999999;color:white;display:flex;align-items:center;justify-content:center;font-size:24px;';
   div.innerHTML = 'Overlay Test - Click to close';
   div.onclick = () => div.remove();
   document.body.appendChild(div);
   ```

## Expected Behavior

When clicking the extension icon:

1. **First time**: Overlay appears with login form
2. **After login**: Overlay shows project selector
3. **After selecting project**: Recording controls appear
4. **Click X or ESC**: Overlay closes

## Debug Commands

Run these in the webpage console:

```javascript
// Check if content script is loaded
console.log(typeof CogixContentManager !== 'undefined');

// Send test message
chrome.runtime.sendMessage({action: 'getAuthState'}, response => {
  console.log('Auth state:', response);
});

// Force show overlay (authenticated)
chrome.runtime.sendMessage({
  action: 'toggleOverlay',
  isAuthenticated: true,
  user: {email: 'test@example.com'},
  currentProjectId: null
});
```