# Screen Recording with Eye Tracking - Implementation Specification

## Overview
This specification outlines the implementation of simultaneous screen recording and eye tracking data collection in the browser extension, with data submission to cogix-data-io for visualization in CogixStudio.

## Current State Analysis

### Working Components
1. **Eye Tracking Connection**: ✅ Working via WebSocket to hardware/WebGazer
2. **Calibration**: ✅ Working with full-screen calibration UI
3. **Real-time Gaze Visualization**: ✅ Working with overlay points
4. **Screen Recording Infrastructure**: ✅ Basic recording setup exists

### Issues Identified
1. **Recording Button Bug**: Shows "connect to eye tracker" despite being connected
2. **Incomplete Upload Workflow**: Video recording exists but no upload to backend
3. **Missing Data Submission**: No integration with cogix-data-io
4. **No End-to-End Testing**: Recording → Upload → Visualization chain incomplete

## Architecture Overview

### Data Flow
```
Browser Extension → Screen Recording + Eye Tracking
                 ↓
Video Upload to cogix-backend (get CDN URL)
                 ↓
Session Data + Video URL → cogix-data-io
                 ↓
CogixStudio reads from DataIOStorageProvider
```

### Key Components

1. **Browser Extension (cogix-browser-plugin)**
   - Screen recording with MediaRecorder API
   - Eye tracking data collection (60Hz)
   - Video upload to cogix-backend
   - Session data submission to cogix-data-io

2. **Backend Services**
   - **cogix-backend**: Video file storage and CDN URL generation
   - **cogix-data-io**: Session data storage and retrieval

3. **Frontend Visualization (cogix-frontend)**
   - CogixStudioAdapter with DataIOStorageProvider
   - Session playback and analysis

## Implementation Plan

### Phase 1: Fix Recording Button Issue
**Problem**: Eye tracker status not properly synchronized between background script and content script

**Root Cause**: The recording button checks `chrome.storage.local` for eye tracker status, but this may not be properly updated when the connection state changes.

**Solution**:
- Add real-time status synchronization
- Improve error messaging
- Add visual connection indicators

### Phase 2: Implement Video Upload Workflow
**Endpoint**: `POST /api/v1/project-files/{project_id}/upload`

**Process**:
1. Convert recorded video Blob to File
2. Upload via FormData to cogix-backend
3. Get back signed URL for CDN access
4. Store URL for session data submission

### Phase 3: Implement Session Data Submission
**Endpoint**: `PUT /{user_id}/{project_id}/{participant_id}/{session_id}` (cogix-data-io)

**Session Data Format**:
```json
{
  "data": {
    "id": "session_id",
    "startTime": 1234567890,
    "endTime": 1234567900,
    "duration": 10000,
    "videoUrl": "https://cdn.cogix.app/video.webm",
    "gazeData": [
      {
        "timestamp": 0,
        "x": 500,
        "y": 300,
        "leftEye": {...},
        "rightEye": {...}
      }
    ],
    "metadata": {
      "url": "https://example.com",
      "title": "Page Title",
      "userAgent": "...",
      "screenResolution": {"width": 1920, "height": 1080},
      "recordingSettings": {
        "fps": 30,
        "resolution": "1280x720",
        "codec": "vp9"
      }
    }
  },
  "metadata": {
    "device": "browser-extension",
    "version": "1.0.0",
    "eyeTrackerType": "hardware|webgazer"
  }
}
```

### Phase 4: Integration and Testing
**Components to Test**:
1. Recording workflow (start/stop)
2. Video upload and URL retrieval
3. Session data submission
4. CogixStudio data retrieval and playback

## Technical Implementation Details

### 1. Recording Button Fix

**File**: `cogix-browser-plugin/src/contents/unified-overlay.ts`

**Changes Needed**:
- Improve status checking logic
- Add real-time status updates
- Better error messaging

### 2. Video Upload Implementation

**New Function**: `uploadVideoToBackend(videoBlob, projectId, authToken)`

**Process**:
```typescript
async function uploadVideoToBackend(
  videoBlob: Blob, 
  projectId: string, 
  authToken: string
): Promise<string> {
  const formData = new FormData();
  const filename = `recording_${Date.now()}.webm`;
  formData.append('file', videoBlob, filename);
  formData.append('folder_path', 'recordings');

  const response = await fetch(
    `${BACKEND_URL}/api/v1/project-files/${projectId}/upload`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    }
  );

  const result = await response.json();
  return result.signed_url; // CDN URL for the video
}
```

### 3. Session Data Submission

**New Function**: `submitSessionToDataIO(sessionData, apiKey, userId, projectId)`

**Process**:
```typescript
async function submitSessionToDataIO(
  sessionData: SessionData,
  apiKey: string,
  userId: string,
  projectId: string,
  participantId: string = 'anonymous'
): Promise<void> {
  const sessionId = sessionData.id;
  const url = `${DATA_IO_URL}/${userId}/${projectId}/${participantId}/${sessionId}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      data: sessionData,
      metadata: {
        device: 'browser-extension',
        version: '1.0.0',
        submitted_at: new Date().toISOString()
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to submit session: ${response.statusText}`);
  }
}
```

### 4. Updated Recording Workflow

**Modified Function**: `finalizeRecording(projectId: string)`

**New Process**:
1. Create video blob from recorded chunks
2. Upload video to cogix-backend → get CDN URL
3. Prepare session data with video URL
4. Submit session data to cogix-data-io
5. Show success/error feedback

## Configuration Requirements

### Environment Variables
- `NEXT_PUBLIC_API_URL`: cogix-backend URL
- `NEXT_PUBLIC_DATA_IO_URL`: cogix-data-io URL

### API Keys
- Project-specific API key for cogix-data-io (generated via backend)
- User authentication token for cogix-backend

## Error Handling Strategy

### Upload Failures
- Retry mechanism for video uploads
- Fallback to local storage if upload fails
- User notification of upload status

### Network Issues
- Queue sessions for later upload
- Offline support with sync when online
- Progress indicators for large uploads

### Data Validation
- Validate session data before submission
- Check video file integrity
- Verify API key permissions

## Testing Strategy

### Unit Tests
- Video recording functionality
- Data format validation
- Upload error handling

### Integration Tests
- End-to-end recording workflow
- Backend API integration
- Data-IO submission flow

### User Acceptance Tests
- Record session in browser
- Verify data in CogixStudio
- Test various websites and scenarios

## Performance Considerations

### Video Compression
- Use efficient codecs (VP9/H.264)
- Optimize recording settings for file size
- Consider chunked uploads for large files

### Memory Management
- Stream video data during recording
- Clear buffers after upload
- Monitor memory usage during long recordings

### Network Optimization
- Compress session data
- Use CDN for video delivery
- Implement upload progress tracking

## Security Considerations

### API Key Management
- Secure storage of API keys
- Key rotation support
- Scope-limited permissions

### Data Privacy
- User consent for recording
- Secure transmission (HTTPS)
- Data retention policies

### Cross-Origin Security
- CORS configuration
- Content Security Policy
- Secure cookie handling

## Deployment Strategy

### Development Testing
1. Local development environment
2. Test with sample websites
3. Verify data flow end-to-end

### Staging Deployment
1. Deploy to staging environment
2. Integration testing with real APIs
3. Performance testing with larger files

### Production Release
1. Gradual rollout to users
2. Monitor error rates and performance
3. User feedback collection

## Success Metrics

### Technical Metrics
- Recording success rate > 95%
- Upload completion rate > 90%
- Data integrity validation 100%

### User Experience Metrics
- Recording start time < 3 seconds
- Upload completion feedback within 30 seconds
- Error recovery success rate > 80%

### Business Metrics
- User adoption of recording feature
- Session data quality and completeness
- Integration with analysis workflows

## Future Enhancements

### Advanced Features
- Real-time streaming to backend
- Multi-tab recording support
- Advanced compression algorithms

### Analytics Integration
- Recording usage analytics
- Performance metrics dashboard
- User behavior insights

### Platform Expansion
- Mobile browser support
- Standalone application version
- API for third-party integrations
