# Screen Recording with Eye Tracking - Testing Guide

## Overview
This document provides step-by-step instructions for testing the complete screen recording and eye tracking workflow from browser extension to CogixStudio visualization.

## Prerequisites

### 1. Services Running
Ensure all required services are running:
```bash
# Start all services
./start-all.bat

# Or individually:
./start-backend.bat    # Backend + Data API (ports 8000 & 8001)  
./start-frontend.bat   # Frontend (port 3000)
```

### 2. Extension Setup
1. Build and load the browser extension:
```bash
cd cogix-browser-plugin
npm run build
```

2. Load extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select `cogix-browser-plugin/build/chrome-mv3-dev/`

### 3. Eye Tracker Setup
- Ensure eye tracking hardware is connected (or WebGazer is available)
- Eye tracker SDK should be running on `wss://127.0.0.1:8443` or `ws://127.0.0.1:9000`

## Step-by-Step Testing

### Phase 1: Authentication and Project Setup

1. **Sign in to Extension**
   - Click extension icon in Chrome toolbar
   - Sign in with Clerk authentication
   - Verify user info is displayed in popup

2. **Select Project**
   - In extension popup, go to "Projects" tab
   - Select an existing project or create a new one
   - Verify project is selected and displayed

### Phase 2: Eye Tracker Connection and Calibration

1. **Connect Eye Tracker**
   - In extension popup, go to "Eye Tracking" tab
   - Click "Connect" button
   - Verify connection status shows "Connected"
   - Check that camera feed is visible (if available)

2. **Calibrate Eye Tracker**
   - Click "Start Calibration" button
   - Follow calibration points (5 points)
   - Verify calibration completes successfully
   - Status should show "Calibrated and ready for recording"

3. **Verify Gaze Tracking**
   - Look around the screen
   - Verify red gaze point appears and follows your gaze
   - Check console for gaze data messages (should appear every ~16ms)

### Phase 3: Screen Recording

1. **Start Recording**
   - Navigate to a test website (e.g., `https://example.com`)
   - Click the recording button in the overlay (bottom-left corner)
   - Verify recording starts:
     - Recording indicator appears
     - Gaze point becomes visible during recording
     - Console shows "Screen recording started"

2. **Perform Test Actions**
   - Move cursor around the page
   - Click on different elements
   - Scroll up and down
   - Spend at least 10-15 seconds recording

3. **Stop Recording**
   - Click the recording button again to stop
   - Verify recording stops:
     - Recording indicator disappears
     - Console shows upload progress messages

### Phase 4: Data Upload and Submission

1. **Monitor Upload Process**
   - Check browser console for upload messages:
     ```
     Uploading video to: https://api.cogix.app/api/v1/project-files/{project_id}/upload
     Video uploaded successfully: {video_url}
     Getting API key from: https://api.cogix.app/api/v1/projects/{project_id}/default-api-key
     Submitting session data to: https://data-io.cogix.app/{user_id}/{project_id}/browser-extension/{session_id}
     Data-IO submission result: {result}
     ```

2. **Verify Success Messages**
   - Should see "Recording uploaded successfully!" alert
   - No error messages in console
   - Video file should appear in project files (backend)

### Phase 5: CogixStudio Visualization

1. **Open CogixStudio**
   - Navigate to: `http://localhost:3000/projects/{project_id}/eye-tracking/test?storage=dataio`
   - Replace `{project_id}` with your actual project ID
   - The `?storage=dataio` parameter enables DataIO mode

2. **Verify Data Loading**
   - CogixStudio should initialize with DataIOStorageProvider
   - Check for "DataIO Storage Mode" indicator in top-right corner
   - Sessions list should populate with recorded session

3. **Test Session Playback**
   - Select the recorded session from the list
   - Click play to start playback
   - Verify:
     - Video plays correctly
     - Gaze points appear synchronized with video
     - Timeline scrubbing works
     - Playback controls function properly

## Troubleshooting

### Common Issues and Solutions

#### 1. Recording Button Shows "Connect to eye tracker"
**Symptoms**: Button disabled despite being connected
**Solution**: 
- Refresh the page and try again
- Check extension popup to verify connection status
- Restart eye tracker SDK if needed

#### 2. Video Upload Fails
**Symptoms**: "Failed to upload recording" error
**Solutions**:
- Check authentication (sign out/in to extension)
- Verify backend is running on correct port
- Check network connectivity
- Look for CORS issues in browser console

#### 3. API Key Issues
**Symptoms**: "Failed to get API key" or 401/403 errors
**Solutions**:
- Verify user has access to the project
- Check backend API key generation endpoint
- Clear cached API keys: `localStorage.clear()`

#### 4. DataIO Submission Fails
**Symptoms**: Data submission errors in console
**Solutions**:
- Verify cogix-data-io service is running on port 8001
- Check API key permissions
- Verify user ID and project ID are correct

#### 5. CogixStudio Doesn't Load Sessions
**Symptoms**: Empty sessions list in DataIO mode
**Solutions**:
- Verify `?storage=dataio` parameter in URL
- Check browser console for API errors
- Verify session was submitted successfully
- Check DataIO service logs

### Debug Commands

#### Check Extension Storage
```javascript
// In browser console
chrome.storage.sync.get(null, console.log);
chrome.storage.local.get(null, console.log);
```

#### Check Local Storage
```javascript
// In browser console
console.log('Failed recordings:', localStorage.getItem('failedRecordings'));
console.log('API keys:', Object.keys(localStorage).filter(k => k.includes('dataio_api_key')));
```

#### Test API Endpoints
```bash
# Test backend health
curl http://localhost:8000/health

# Test data-io health  
curl http://localhost:8001/health

# Test project API key (replace with actual values)
curl -H "Authorization: Bearer {clerk_token}" \
     http://localhost:8000/api/v1/projects/{project_id}/default-api-key
```

## Performance Testing

### Large File Uploads
- Test with longer recordings (2-5 minutes)
- Monitor memory usage during upload
- Verify upload progress feedback

### Multiple Sessions
- Record multiple sessions in succession
- Verify each session uploads independently
- Check for memory leaks or performance degradation

### Network Conditions
- Test with slow network connections
- Verify retry mechanisms work
- Check offline/online behavior

## Expected Results

### Successful Workflow Indicators
1. ✅ Extension authenticates and connects to eye tracker
2. ✅ Calibration completes successfully  
3. ✅ Recording captures both video and gaze data
4. ✅ Video uploads to backend and returns CDN URL
5. ✅ Session data submits to data-io service
6. ✅ CogixStudio loads and displays session
7. ✅ Playback synchronizes video with gaze data

### Performance Benchmarks
- **Recording Start Time**: < 3 seconds
- **Upload Time**: < 30 seconds for 1-minute recording
- **CogixStudio Load Time**: < 5 seconds
- **Playback Latency**: < 1 second

### Data Quality Checks
- **Video Quality**: Clear, smooth playback at 30fps
- **Gaze Data**: Accurate positioning, 60Hz sampling rate
- **Synchronization**: Gaze points align with user actions
- **Completeness**: No missing data or gaps in timeline

## Reporting Issues

When reporting issues, please include:

1. **Environment Details**:
   - Browser version and OS
   - Extension version
   - Backend/frontend versions
   - Eye tracker hardware/software

2. **Console Logs**:
   - Browser console output
   - Extension popup console (if accessible)
   - Backend service logs

3. **Reproduction Steps**:
   - Exact steps to reproduce the issue
   - Expected vs. actual behavior
   - Screenshots or video if helpful

4. **Network Information**:
   - Network requests in browser DevTools
   - Any failed requests or unusual response times
   - CORS or authentication errors

## Future Enhancements

### Planned Features
- Real-time streaming to backend (reduce upload time)
- Multi-tab recording support
- Advanced compression algorithms
- Mobile browser compatibility
- Offline recording with sync capability

### Analytics Integration
- Recording usage metrics
- Performance monitoring dashboard
- User behavior insights
- A/B testing for different recording settings
