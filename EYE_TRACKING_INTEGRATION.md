# 🎯 Eye Tracking & Screen Recording Integration

This document describes the complete integration of eye tracking and screen recording functionality in the Cogix Browser Plugin.

## 📋 Overview

The browser plugin now supports:
- ✅ **Eye Tracking**: Real-time gaze data collection using WebSocket connection
- ✅ **Screen Recording**: Desktop/tab capture with synchronized gaze data
- ✅ **Visual Feedback**: Gaze point visualization during recording
- ✅ **Project Integration**: Recording sessions tied to specific projects
- ✅ **Data Synchronization**: Eye tracking data timestamped with video

## 🏗️ Architecture

### Components

1. **EyeTrackerContext** (`src/contexts/EyeTrackerContext.tsx`)
   - Manages eye tracker connection and state
   - Handles WebSocket communication with eye tracking hardware
   - Provides React context for eye tracking data

2. **Eye Tracking Page** (`src/popup/pages/eye-tracking.tsx`)
   - Connection management UI
   - Calibration controls
   - Real-time status display

3. **Content Script** (`src/contents/unified-overlay.ts`)
   - Screen recording functionality
   - Gaze data collection and synchronization
   - Visual overlays (recording indicator, gaze point)

4. **Background Script** (`src/background.ts`)
   - Screen capture permissions
   - Message routing between components

## 🔧 Setup Instructions

### 1. Prerequisites

- Eye tracking hardware (HH device or compatible)
- Cogix Eye Tracking SDK running on `ws://127.0.0.1:9000` or `wss://127.0.0.1:8443`
- Chrome browser with extension development enabled

### 2. Build and Install

```bash
# Build the extension
npm run build

# Or use the test build script
./test-build.bat
```

### 3. Load Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `build` folder
4. The extension should appear in your extensions list

### 4. Configure Eye Tracking

1. Start your eye tracking SDK/hardware
2. Click the extension icon in Chrome
3. Navigate to the "Eye Tracking" tab
4. Enter the WebSocket URL (default: `ws://127.0.0.1:9000`)
5. Click "Connect"
6. Complete the calibration process

### 5. Set Up Project

1. In the extension popup, go to "Home"
2. Select or create a project
3. The project name will appear in the overlay

## 🎮 Usage

### Starting a Recording Session

1. **Ensure Prerequisites**:
   - Eye tracker is connected and calibrated
   - Project is selected
   - You're on the page you want to record

2. **Start Recording**:
   - Look for the Cogix overlay in the bottom-left corner
   - Click the round record button
   - Grant screen capture permissions when prompted

3. **During Recording**:
   - Red "Recording" indicator appears in top-right
   - Red gaze point follows your eye movements
   - All gaze data is synchronized with video

4. **Stop Recording**:
   - Click the record button again (now square/red)
   - Recording data is processed and logged to console

### Visual Indicators

- **🔴 Recording Indicator**: Top-right corner shows recording status
- **👁️ Gaze Point**: Red dot follows your gaze during recording
- **🎯 Control Overlay**: Bottom-left panel for recording controls

## 📊 Data Output

### Recording Session Data Structure

```javascript
{
  id: "rec_1234567890_abc123",
  projectId: "project_uuid",
  startTime: 1234567890000,
  endTime: 1234567890000,
  gazeData: [
    {
      timestamp: 1500, // Relative to recording start (ms)
      x: 640,          // Screen coordinates
      y: 360,
      leftEye: { x: 635, y: 358 },
      rightEye: { x: 645, y: 362 }
    }
    // ... more gaze points
  ],
  metadata: {
    url: "https://example.com",
    title: "Page Title",
    userAgent: "Mozilla/5.0...",
    screenResolution: { width: 1920, height: 1080 }
  }
}
```

### Video Data

- Format: WebM (VP9/VP8) or MP4
- Resolution: Up to 1280x720 @ 30fps
- Bitrate: ~1.5 Mbps
- Audio: Disabled by default

## 🔍 Testing

### Using the Test Page

1. Open `test-integration.html` in Chrome
2. Follow the on-screen instructions
3. Test various eye tracking scenarios:
   - Text reading
   - Button clicking
   - Visual search
   - Scrolling content

### Console Debugging

Open browser DevTools (F12) to see:
- Eye tracking connection status
- Gaze data stream
- Recording session details
- Error messages and troubleshooting info

## 🐛 Troubleshooting

### Common Issues

**Eye Tracker Won't Connect**
- Check if SDK is running on correct port
- Try both `ws://127.0.0.1:9000` and `wss://127.0.0.1:8443`
- Verify firewall/antivirus isn't blocking connection
- Check browser console for WebSocket errors

**Screen Recording Fails**
- Ensure `desktopCapture` permission is granted
- Try selecting different capture sources (screen/window/tab)
- Check if other applications are using screen capture
- Verify browser supports MediaRecorder API

**Gaze Data Not Appearing**
- Complete calibration process first
- Check if eye tracker is actively tracking
- Verify gaze point is visible during recording
- Look for error messages in console

**Extension Not Loading**
- Refresh extension in `chrome://extensions/`
- Check for build errors in console
- Verify all dependencies are installed
- Try rebuilding with `npm run build`

### Debug Commands

```javascript
// In browser console
chrome.storage.sync.get(null, console.log)  // Check stored data
chrome.runtime.sendMessage({type: 'DEBUG_INFO'})  // Get debug info
```

## 📈 Performance Considerations

### Optimization Tips

- **Gaze Data Rate**: ~60Hz (16ms intervals)
- **Video Recording**: 30fps recommended for balance of quality/performance
- **Memory Usage**: Buffer limited to prevent memory leaks
- **CPU Impact**: Minimal when not recording

### Resource Management

- Automatic cleanup on page unload
- MediaStream tracks properly disposed
- WebSocket connections gracefully closed
- Storage usage monitored and limited

## 🔮 Future Enhancements

### Planned Features

- [ ] Audio recording support
- [ ] Multiple video quality options
- [ ] Real-time data upload to backend
- [ ] Heatmap generation
- [ ] AOI (Area of Interest) detection
- [ ] Export functionality (CSV, JSON)

### Integration Opportunities

- Backend API for data storage
- Real-time analytics dashboard
- Machine learning integration
- Multi-user session support

## 📝 API Reference

### EyeTracker Events

```javascript
eyeTracker.on('statusChanged', (status) => {})
eyeTracker.on('gazeData', (data) => {})
eyeTracker.on('calibrationComplete', (result) => {})
eyeTracker.on('connected', () => {})
eyeTracker.on('disconnected', () => {})
```

### Chrome Extension Messages

```javascript
// Start recording
chrome.runtime.sendMessage({
  type: 'TOGGLE_RECORDING',
  isRecording: true,
  projectId: 'project_uuid'
})

// Gaze data (sent automatically)
chrome.tabs.sendMessage(tabId, {
  type: 'GAZE_DATA',
  data: { timestamp, x, y, leftEye, rightEye }
})
```

## 📄 License

This integration is part of the Cogix platform and follows the same licensing terms as the main project.
