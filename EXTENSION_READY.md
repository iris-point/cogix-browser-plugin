# Cogix Browser Extension - Ready to Use! ✅

## Quick Start

### Load Extension in Chrome
1. Open Chrome and navigate to: `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **"Load unpacked"**
4. Select folder: `G:\TALEMONK\cogix\cogix-browser-plugin\dist-dev`
5. The extension is now loaded! Look for the eye icon in your toolbar

### Test the Extension
1. Click the extension icon on any webpage
2. The overlay will appear with options to:
   - Login with your Cogix account
   - Select a project
   - Choose eye tracking provider (HH hardware or WebGazer webcam)
   - Start recording

## Build Commands

### Development (with debugging)
```bash
# Build once for debugging
npm run dev

# Start watch mode (auto-rebuild on changes)
npm run dev:auto

# Or use the convenient batch file
./debug-extension.bat
```

### Production
```bash
# Build for production
npm run build

# Or use batch file
./build-extension.bat
```

## Folder Structure
- `dist-dev/` - Development build (with source maps, unminified)
- `dist/` - Production build (minified, optimized)
- `src/` - Source code
- `public/` - Static assets and manifest

## Key Features
✅ **No CSP errors** - Manifest V3 compliant
✅ **Icons generated** - All sizes (16, 32, 48, 128px)
✅ **Source maps** - Debug TypeScript directly in Chrome DevTools
✅ **Watch mode** - Auto-rebuild on file changes
✅ **Production ready** - Defaults to production backend URLs

## Debugging Tips
1. **Service Worker**: chrome://extensions → "service worker" link
2. **Content Script**: F12 on any webpage → Sources tab
3. **Popup**: Right-click extension icon → "Inspect popup"
4. **Storage**: DevTools → Application → Storage → Local Storage

## Backend Integration
The extension connects to:
- Production: `https://api.cogix.app` and `https://data.cogix.app`
- Development: Configure in options page if needed

## Session Management
The extension automatically syncs with your Cogix website login:
- If logged in at app.cogix.app, the extension detects your session
- Otherwise, use the extension's login form

## Ready to Go! 🚀
The extension is now fully functional and ready for:
- Eye tracking recording on any website
- Session data upload to Cogix workspace
- Real-time gaze visualization
- Project-based organization

For detailed debugging instructions, see `DEBUG.md`