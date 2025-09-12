# 🔧 Content Script Connection Debug Guide

## The Issue
Getting error: `"Could not establish connection. Receiving end does not exist"`

This means the **content script is not loaded** or **not responding** on the current page.

## ✅ Enhanced Implementation

### **1. Full-Screen Calibration with Browser Control**
```typescript
// Now requests actual browser fullscreen mode before calibration
async function startCalibration() {
  // Request fullscreen first (like emotion experiment)
  const element = document.documentElement
  if (element.requestFullscreen) {
    await element.requestFullscreen()
  }
  
  // Create full-screen calibration overlay
  // ... calibration UI code
}
```

### **2. Connection Testing**
```typescript
// Popup now tests content script before starting calibration
try {
  const pingResponse = await chrome.tabs.sendMessage(tabId, { type: 'PING' })
  console.log('Content script available:', pingResponse)
} catch (error) {
  alert('Content script not loaded. Please refresh the page.')
}
```

### **3. Debug Logging**
```typescript
// Content script logs when it loads
console.log('Cogix content script loaded on:', window.location.href)

// Message handler logs all received messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message.type)
  // ... handle messages
})
```

## 🔍 Troubleshooting Steps

### **Step 1: Check Content Script Loading**
1. **Open any regular webpage** (not chrome:// pages)
2. **Open DevTools** (F12) → Console tab
3. **Look for**: `"Cogix content script loaded on: [URL]"`
4. **If missing**: Content script didn't load

### **Step 2: Test Content Script Connection**
1. **Open extension popup**
2. **Go to Eye Tracking tab**
3. **Click "Start Calibration"** (even if not connected to eye tracker)
4. **Check console** for ping test results
5. **If ping fails**: Content script not responding

### **Step 3: Check Page Compatibility**
Content scripts **DO NOT** work on:
- ❌ `chrome://` pages (extensions, settings, etc.)
- ❌ `chrome-extension://` pages
- ❌ `file://` pages (local files)
- ❌ Browser internal pages

Content scripts **DO** work on:
- ✅ `http://` websites
- ✅ `https://` websites  
- ✅ Regular web pages

### **Step 4: Force Reload Content Script**
If content script isn't loading:
1. **Refresh the webpage** (F5 or Ctrl+R)
2. **Reload the extension**:
   - Go to `chrome://extensions/`
   - Find "Cogix Eye Tracking"
   - Click the refresh icon 🔄
3. **Refresh the webpage again**
4. **Check console** for loading message

## 🎯 Expected Behavior After Fix

### **Successful Flow:**
1. **Load extension** → Content script logs loading
2. **Navigate to webpage** → Content script active
3. **Click "Start Calibration"** → Ping test passes
4. **Calibration starts** → Page goes fullscreen
5. **Calibration overlay appears** → Full-screen dark background
6. **Calibration points show** → Green animated points
7. **Calibration completes** → Exit fullscreen, overlay disappears

### **Debug Console Output:**
```
Cogix content script loaded on: https://example.com
Content script received message: PING
Content script ping received
Content script received message: START_CALIBRATION
Starting calibration from content script
Starting full-screen calibration...
Fullscreen mode activated
```

## 🛠️ Manual Testing Commands

### **Test Content Script in Console:**
```javascript
// In browser console on any webpage
chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
  console.log('Extension ping:', response)
})

// Test calibration message
chrome.runtime.sendMessage({ type: 'START_CALIBRATION' }, (response) => {
  console.log('Calibration response:', response)
})
```

### **Test from Extension:**
1. Open extension popup
2. Open browser DevTools (F12)
3. Try calibration and watch both:
   - **Popup console** (extension DevTools)
   - **Page console** (webpage DevTools)

## 🔧 Common Fixes

### **Fix 1: Page Refresh**
```bash
# Simple solution that works 90% of the time
F5 or Ctrl+R to refresh the page
```

### **Fix 2: Extension Reload**
```bash
1. Go to chrome://extensions/
2. Find "Cogix Eye Tracking"  
3. Click refresh button 🔄
4. Refresh your webpage
```

### **Fix 3: Check Page Type**
```bash
# Make sure you're on a regular website
✅ https://google.com
✅ https://github.com
❌ chrome://extensions/
❌ chrome://settings/
```

## 📋 Testing Checklist

- [ ] Content script loads (check console)
- [ ] Ping test passes (check popup response)
- [ ] Page goes fullscreen (check browser behavior)
- [ ] Calibration overlay appears (check visual)
- [ ] Calibration points show (check green dots)
- [ ] Eye tracker receives commands (check eye tracker logs)

## Status: 🔧 DEBUGGING TOOLS ADDED

The implementation now includes comprehensive debugging and testing tools to identify and resolve content script connection issues.
