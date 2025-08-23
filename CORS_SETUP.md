# CORS Setup for Cogix Browser Extension

## The CORS Issue

Chrome extensions have unique origins in the format `chrome-extension://[extension-id]` which need to be explicitly allowed by backend servers. Without proper CORS configuration, the extension will receive errors like:

```
Access to fetch at 'http://localhost:8000/api/v1/projects' from origin 
'chrome-extension://abcdefghijk' has been blocked by CORS policy
```

## Solution

### 1. Backend Services Updated

Both backend services have been updated to support Chrome extension origins:

#### cogix-backend (Port 8000)
```python
# app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS + ["chrome-extension://*"],
    allow_origin_regex=r"^(chrome-extension|moz-extension|edge-extension)://.*",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600
)
```

#### cogix-data-api (Port 8001)
```python
# app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_origin_regex=r"^(chrome-extension|moz-extension|edge-extension)://.*",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600
)
```

### 2. Key Changes

1. **Allow Origin Regex**: Added regex pattern to match any Chrome/Firefox/Edge extension ID
   ```python
   allow_origin_regex=r"^(chrome-extension|moz-extension|edge-extension)://.*"
   ```

2. **Explicit Methods**: Added all HTTP methods including OPTIONS for preflight requests
   ```python
   allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"]
   ```

3. **Credentials Support**: Enabled for cookie/token authentication
   ```python
   allow_credentials=True
   ```

4. **Headers**: Allow all headers for flexibility
   ```python
   allow_headers=["*"]
   expose_headers=["*"]
   ```

5. **Preflight Caching**: Cache OPTIONS requests for 1 hour
   ```python
   max_age=3600
   ```

## Testing CORS

### 1. Start Backend Services
```bash
# Terminal 1 - Main backend
cd cogix-backend
uvicorn app.main:app --reload --port 8000

# Terminal 2 - Data API
cd cogix-data-api
python start-server.py
```

### 2. Load Extension
1. Build the extension: `npm run build`
2. Load in Chrome: `chrome://extensions/` → Load unpacked
3. Note the extension ID (e.g., `abcdefghijklmnopqrstuvwxyz`)

### 3. Test API Calls
Open the extension popup and try:
- Login
- Fetch projects
- Start recording

### 4. Check Console
If CORS issues occur, you'll see them in:
- Extension popup DevTools (right-click popup → Inspect)
- Background script console (chrome://extensions/ → Service Worker)

## Alternative Solutions

### Option 1: Proxy Through Background Script
Instead of direct API calls from content scripts, proxy through the background script which doesn't have CORS restrictions:

```javascript
// content-script.js
chrome.runtime.sendMessage({ 
  action: 'apiCall',
  endpoint: '/api/v1/projects'
});

// background-script.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'apiCall') {
    fetch(`http://localhost:8000${request.endpoint}`)
      .then(response => response.json())
      .then(sendResponse);
    return true;
  }
});
```

### Option 2: Use Manifest Permissions
Add specific host permissions in manifest.json:

```json
{
  "host_permissions": [
    "http://localhost:8000/*",
    "http://localhost:8001/*",
    "https://api.cogix.app/*"
  ]
}
```

### Option 3: Development Mode
For development only, you can disable CORS in Chrome:

```bash
# Windows
chrome.exe --user-data-dir="C:/Chrome dev session" --disable-web-security

# Mac
open -n -a /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --args --user-data-dir="/tmp/chrome_dev_test" --disable-web-security

# Linux
google-chrome --disable-web-security --user-data-dir="/tmp/chrome_dev_test"
```

⚠️ **Warning**: Never browse the regular web with CORS disabled!

## Production Considerations

### 1. Specific Extension IDs
In production, instead of allowing all extensions, whitelist specific IDs:

```python
ALLOWED_EXTENSION_IDS = [
    "chrome-extension://your-production-extension-id",
    "chrome-extension://your-dev-extension-id"
]

def is_allowed_origin(origin):
    return origin in ALLOWED_EXTENSION_IDS or origin in CORS_ORIGINS
```

### 2. Environment-Based Configuration
```python
if settings.IS_PRODUCTION:
    # Only allow specific extension IDs in production
    allow_origin_regex = r"^chrome-extension://(abcdef123456|ghijkl789012)$"
else:
    # Allow any extension in development
    allow_origin_regex = r"^(chrome-extension|moz-extension|edge-extension)://.*"
```

### 3. Security Headers
Add additional security headers for production:

```python
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response
```

## Troubleshooting

### Issue: "CORS preflight request failed"
**Solution**: Ensure OPTIONS method is allowed and backend handles preflight requests

### Issue: "Credentials flag is true but Access-Control-Allow-Credentials header is not present"
**Solution**: Set `allow_credentials=True` in CORS middleware

### Issue: "Origin header is null"
**Solution**: This happens with file:// URLs or some iframe contexts. Use background script proxy.

### Issue: Works in development but not production
**Solution**: Check that production CORS settings include the extension's production ID

## Summary

With these CORS configurations:
✅ Chrome extension can authenticate with backend
✅ Extension can fetch projects and upload sessions
✅ Cookie-based auth works across extension and website
✅ Supports Chrome, Firefox, and Edge browsers
✅ Development and production environments supported

The extension should now work seamlessly with both backend services without CORS issues!