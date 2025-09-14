# Browser Plugin Troubleshooting Guide

## "Failed to fetch" Error on JWT Token Generation

### 🔍 **Diagnostic Steps**

1. **Run the Connection Test**: Click the test button (🔍) in the browser plugin overlay
2. **Check Browser Console**: Open DevTools → Console tab for detailed logs
3. **Review Test Results**: Look at the Configuration and URL Testing sections

---

## 🚨 **Common Issues & Solutions**

### **1. CORS Policy Error**
**Symptoms**: "Access to fetch ... has been blocked by CORS policy"

**Solution**: The backend CORS is configured correctly, but the extension might need:
```json
// In manifest.json
"host_permissions": [
  "https://api.cogix.app/*"
]
```

**Check**: Ensure the extension has permission to access the API domain.

---

### **2. Extension ID Mismatch**
**Symptoms**: CORS preflight fails or extension origin rejected

**Solution**: The extension needs a consistent ID for CORS to work properly.

**Check**: 
- Look for `Extension ID: <extension-id>` in the test results
- Ensure the backend allows `chrome-extension://<that-id>/*`

---

### **3. Authentication Issues**
**Symptoms**: "Not authenticated" or 401/403 errors

**Solutions**:
1. **Sign out and back in** to the browser extension
2. **Clear extension storage**: 
   ```javascript
   chrome.storage.sync.clear()
   chrome.storage.local.clear()
   ```
3. **Check Clerk token format**: Should be JWT format (starts with `eyJ`)

---

### **4. Network/Firewall Issues**
**Symptoms**: Network errors, timeouts, connection refused

**Solutions**:
1. **Check if API is reachable**: Try `https://api.cogix.app/health` in browser
2. **Corporate firewall**: May block extension requests
3. **VPN/Proxy**: Might interfere with requests

---

### **5. Development vs Production URLs**
**Symptoms**: Wrong URL being used

**Expected Configuration**:
- **Backend**: `https://api.cogix.app` (production)
- **Data-IO**: `https://data-io.cogix.app` (production)
- **Extension Environment**: Should use production URLs

**Check**: Look at "Configuration" section in test results.

---

## 🔧 **Advanced Debugging**

### **Browser Console Logs to Look For**:

```javascript
// Configuration
🔧 DataIO Client Configuration: { ... }

// Token request
🔑 Fetching JWT token from: https://api.cogix.app/api/v1/data-io/generate
🔑 Extension ID: <extension-id>

// CORS preflight
🔍 Testing CORS preflight for: https://api.cogix.app/api/v1/data-io/generate
🔍 CORS preflight response: { status: 200, headers: { ... } }

// Errors
🚨 Fetch request failed: TypeError: Failed to fetch
🚨 Token request failed: { status: 0, ... }
```

### **What Each Error Means**:

- **`TypeError: Failed to fetch`** → CORS or network issue
- **`Status: 0`** → Request blocked before reaching server (CORS/firewall)
- **`Status: 401`** → Authentication issue (bad/missing Clerk token)
- **`Status: 404`** → Endpoint not found (wrong URL)
- **`Status: 500`** → Server error (backend issue)

---

## 🎯 **Quick Fixes**

### **For Development**:
1. Ensure local backend is running: `./start-backend.bat`
2. Check if extension can reach localhost (might be blocked)

### **For Production**:
1. Verify extension is signed in to Clerk
2. Check extension permissions in `chrome://extensions/`
3. Try refreshing the page and testing again

### **Emergency Fallback**:
If production API is unreachable, the extension can fall back to:
1. Local storage for failed sessions
2. Manual retry when connection is restored
3. Export data for manual upload

---

## 📞 **Getting Help**

Include this information when reporting issues:

1. **Connection Test Results** (click "Copy Results" button)
2. **Browser Console Logs** (from DevTools)
3. **Extension ID** (from test results)
4. **Browser Version** and OS
5. **Network Environment** (corporate, VPN, etc.)

The enhanced connection test provides all the diagnostic information needed to identify and resolve the issue! 🔍
