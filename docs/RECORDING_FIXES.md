# Eye Tracking Recording Fixes

## Issues Identified

1. **Calibration doesn't automatically start tracking**
   - After calibration completes, tracking state should be set to true
   - Gaze visualization should start automatically

2. **No screen recording permission prompt**
   - The screen capture permission dialog doesn't appear
   - Need to properly request permission through Chrome API

3. **Recording state not managed properly**
   - Recording state isn't synced across components
   - No visual feedback when recording is active

4. **Data not being collected/uploaded**
   - Gaze data not being buffered during recording
   - Upload to data-io worker not working

## Root Causes

### 1. Calibration → Tracking Flow
```javascript
// PROBLEM: After calibration, tracking isn't started
eyeTrackerManager.on('calibrationComplete', async (result) => {
  // Missing: Start tracking automatically
})
```

### 2. Screen Permission Issue
```javascript
// PROBLEM: Permission request not handled correctly
chrome.desktopCapture.chooseDesktopMedia(['screen'], (streamId) => {
  // This needs to be called from background script
})
```

### 3. State Management
- Recording state is local to content script
- Not using centralized state manager
- No persistence across reloads

### 4. Data Collection
- Gaze data listener not connected during recording
- Upload endpoint misconfigured

## Solutions Implemented

### 1. Auto-start Tracking After Calibration

**In eye-tracker-manager.ts:**
```javascript
this.tracker.on('calibrationComplete', async (result) => {
  // Set calibrated state
  await eyeTrackerState.setCalibrated(true)
  
  // Start tracking automatically
  if (this.tracker) {
    this.tracker.startTracking()
    this.isTracking = true
  }
  
  // Broadcast status
  this.broadcastStatus()
})
```

### 2. Proper Screen Recording Permission

**In unified-overlay.ts:**
```javascript
async function startRecording(projectId: string) {
  // Request permission through background script
  const response = await chrome.runtime.sendMessage({
    type: 'REQUEST_SCREEN_CAPTURE',
    sources: ['screen', 'window', 'tab']
  })
  
  if (!response.streamId) {
    alert('Screen recording permission required')
    return
  }
  
  // Use the streamId to get media stream
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: response.streamId
      }
    }
  })
}
```

### 3. Centralized Recording State

**Add to state/types.ts:**
```javascript
export interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  sessionId: string | null
  projectId: string | null
  startTime: number | null
  duration: number
  gazeDataCount: number
  videoSize: number
}
```

**In content script:**
```javascript
// Use centralized state
const [recording, updateRecording] = useRecordingState()

async function startRecording(projectId: string) {
  await updateRecording({
    isRecording: true,
    sessionId: generateSessionId(),
    projectId: projectId,
    startTime: Date.now()
  })
}
```

### 4. Gaze Data Collection

**In content script:**
```javascript
// Listen for gaze data during recording
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'GAZE_DATA' && isRecording) {
    gazeDataBuffer.push({
      timestamp: Date.now() - recordingStartTime,
      x: message.data.x,
      y: message.data.y,
      leftEye: message.data.leftEye,
      rightEye: message.data.rightEye
    })
  }
})
```

### 5. Data Upload to Worker

**In background.ts:**
```javascript
case 'DATA_IO_UPLOAD_SESSION':
  const result = await backgroundDataIOClient.submitEyeTrackingSession(
    request.projectId,
    request.sessionId,
    {
      videoFile: new File([request.videoBlob], 'recording.webm'),
      gazeDataFile: new File([JSON.stringify(request.gazeData)], 'gaze.json'),
      gazeData: request.gazeData,
      participantId: 'browser-extension',
      metadata: request.metadata
    }
  )
  sendResponse({ success: true, result })
  break
```

## Testing Checklist

- [ ] Connect eye tracker
- [ ] Start calibration
- [ ] Verify tracking starts automatically after calibration
- [ ] Verify gaze point appears on screen
- [ ] Click "Start Recording"
- [ ] Verify permission dialog appears
- [ ] Grant screen recording permission
- [ ] Verify recording indicator shows
- [ ] Move eyes around screen
- [ ] Stop recording
- [ ] Verify upload progress shows
- [ ] Check data-io for uploaded session

## Files to Update

1. **src/lib/eye-tracker-manager.ts**
   - Add auto-start tracking after calibration
   - Ensure state updates are broadcast

2. **src/contents/unified-overlay.ts**
   - Fix screen permission request
   - Add gaze data collection
   - Implement proper upload flow

3. **src/background.ts**
   - Ensure REQUEST_SCREEN_CAPTURE handler works
   - Fix DATA_IO_UPLOAD_SESSION handler

4. **src/lib/state/types.ts**
   - Add complete RecordingState interface

5. **src/lib/backgroundDataIOClient.ts**
   - Ensure upload endpoints are correct
   - Add proper error handling

## Expected Behavior

1. **Connection Flow:**
   - User connects eye tracker
   - Status shows "Connected"

2. **Calibration Flow:**
   - User starts calibration
   - Follows dots with eyes
   - Calibration completes
   - Tracking starts automatically
   - Gaze point appears on screen

3. **Recording Flow:**
   - User clicks "Start Recording"
   - Chrome shows permission dialog
   - User selects screen/window/tab
   - Recording starts
   - Gaze data is collected
   - User clicks "Stop Recording"
   - Video and gaze data upload to data-io
   - Success notification shows

## Implementation Priority

1. **High Priority:**
   - Fix calibration → tracking flow
   - Fix screen permission prompt
   - Ensure gaze data collection

2. **Medium Priority:**
   - Implement state management
   - Add upload progress UI

3. **Low Priority:**
   - Add pause/resume functionality
   - Add recording quality settings

## Notes

- Screen recording requires user permission each time (Chrome security)
- Gaze data should be synchronized with video timestamps
- Upload should handle large video files (chunked upload)
- Consider compression for video files
- Add retry mechanism for failed uploads