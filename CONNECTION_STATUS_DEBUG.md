# 🔍 Connection Status Debug - "Always Unknown" Issue

## The Problem

**Connection status shows "Unknown"** even when:
- ✅ Calibration status shows "Calibrated ✓"
- ✅ Tracking status shows "Tracking Active"  
- ✅ Eye tracker is clearly working (gaze data flowing)

## 🕵️ Root Cause Analysis

### **Issue 1: Status Not Reset After Calibration**

The eye tracker sets status to `DeviceStatus.CALIBRATING` when calibration starts, but **never resets it back to `DeviceStatus.CONNECTED`** when calibration completes.

```typescript
// In EyeTracker.ts - calibration completion handler
if (jsonIris.cablicFinished) {
  this.isCalibrating = false
  this.calibrationFinished = true
  this.emit('calibrationComplete', result)
  
  // ❌ MISSING: this.setStatus(DeviceStatus.CONNECTED)
  // Status stays as CALIBRATING forever!
}
```

### **Issue 2: Calibration Timing (3-Second Delays)**

Each calibration point has a **3-second delay** from the original raw example:

```typescript
// In EyeTracker.ts - sendNextCalibrationPoint
case 1:
  setTimeout(() => {
    // Send second point
  }, 3000)  // ← 3 second delay for each point
```

**Calibration Index**: Starts at 0 (first point), then 1, 2, 3, 4 (five total points)

## ✅ **Fixes Applied**

### **Fix 1: Status Reset After Calibration**
```typescript
// In EyeTrackerManager
this.tracker.on('calibrationComplete', (result) => {
  this.isCalibrated = true
  this.isTracking = true
  
  // FIXED: Reset status back to CONNECTED after calibration
  this.deviceStatus = DeviceStatus.CONNECTED
  
  this.broadcastStatus() // Broadcast the corrected status
})
```

### **Fix 2: Proper Status Transitions**
```typescript
// Track calibration lifecycle properly
this.tracker.on('calibrationStarted', () => {
  this.deviceStatus = DeviceStatus.CALIBRATING
  this.broadcastStatus()
})

this.tracker.on('calibrationComplete', () => {
  this.deviceStatus = DeviceStatus.CONNECTED  // Reset to connected
  this.broadcastStatus()
})
```

## 🔍 Debug Commands

### **Check Background Script Status**
```javascript
// In browser console
chrome.runtime.sendMessage({ type: 'EYE_TRACKER_STATUS' }, console.log)
// Should show: {status: 'connected', isCalibrated: true, isTracking: true}
```

### **Check Storage Status**
```javascript
chrome.storage.local.get(['eyeTrackerStatus', 'eyeTrackerConnected', 'eyeTrackerCalibrated'], console.log)
// Should show: {eyeTrackerStatus: 'connected', eyeTrackerConnected: true, eyeTrackerCalibrated: true}
```

### **Check Status Sync Logs**
Look for these console messages:
```
✅ "Calibration complete: {success: true}"
✅ "Persistent eye tracker status: connected"  ← Should show after calibration
✅ "Status from storage: {eyeTrackerStatus: 'connected'}"
✅ "Fresh status from background: {status: 'connected'}"
```

## 📊 Status Transition Flow

### **Expected Status Lifecycle**
```
1. DISCONNECTED → (connect) → CONNECTED
2. CONNECTED → (start calibration) → CALIBRATING  
3. CALIBRATING → (calibration complete) → CONNECTED ← This was missing!
4. CONNECTED → (start tracking) → TRACKING (or stay CONNECTED)
```

### **Calibration Point Timing**
```
Point 1: Show immediately → Wait 3s → Send command
Point 2: Wait for response → Wait 3s → Send command  ← Long delay here
Point 3: Wait for response → Wait 3s → Send command
Point 4: Wait for response → Wait 3s → Send command
Point 5: Wait for response → Check calibration
```

## 🎯 Expected Behavior After Fix

### **Connection Status**
1. **Connect** → Shows "● Connected"
2. **Start calibration** → Shows "● Calibrating"
3. **Complete calibration** → Shows "● Connected" (not "Unknown")
4. **Reopen popup** → Still shows "● Connected"

### **Calibration Timing**
- **Point 1**: Immediate (0s)
- **Point 2**: After 3s delay (this is normal from hardware)
- **Point 3**: After another 3s delay
- **Point 4**: After another 3s delay  
- **Point 5**: After another 3s delay
- **Total time**: ~15 seconds for full calibration

## 🔧 Troubleshooting

### **If Status Still Shows "Unknown"**
1. **Check console logs** for status transition messages
2. **Use debug commands** to verify background script status
3. **Try manual refresh** button in popup
4. **Check browser console** for error messages

### **If Calibration Takes Too Long**
- **3-second delays are normal** - this matches the original hardware example
- **Don't interrupt** the calibration process
- **Use ESC or cancel button** if you need to exit

## 📋 Testing the Fix

1. **Connect eye tracker** → Should show "Connected"
2. **Start calibration** → Should show "Calibrating"  
3. **Complete calibration** → Should show "Connected" (not "Unknown")
4. **Close and reopen popup** → Should still show "Connected"
5. **Check calibration badges** → Should show "Calibrated ✓"

## Status: ✅ CONNECTION STATUS RESET FIXED

The connection status should now properly return to "Connected" after calibration instead of staying "Unknown"!
