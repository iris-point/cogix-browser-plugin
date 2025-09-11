# Cogix Chrome Extension - Recording & Eye Tracking Implementation Specification

## Overview
Implement screen recording with eye tracking capabilities in the Chrome extension, allowing users to select a project and submit recording data to the Cogix platform for later viewing.

## Architecture

### 1. Project Selection Flow
- User signs in via Clerk sync host authentication (already implemented)
- Fetch user's projects from Cogix API
- Display project list with selection UI
- Persist selected project in Chrome storage
- Require project selection before recording

### 2. Recording System Architecture

#### Components:
1. **Screen Recording**: Chrome Screen Capture API
2. **Eye Tracking**: WebGazer.js (webcam-based) from cogix-eye-tracking-core
3. **Data Buffer**: Temporary storage for eye tracking data
4. **Upload Manager**: Handle video and data submission to Cloudflare

#### Data Flow:
```
User starts recording → 
  → Screen capture starts
  → Eye tracking initializes (webcam)
  → Data collection buffer
  → Stop recording
  → Upload video to R2
  → Submit session data to worker
  → View on Cogix platform
```

## Technical Implementation

### Phase 1: Project Selection UI

#### API Integration
```typescript
// Fetch projects using cogixAPIClient pattern
const fetchProjects = async (token: string) => {
  const response = await fetch(`${API_URL}/api/v1/projects/`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return response.json()
}
```

#### UI Components
- Project selector dropdown/modal
- Project card with name and description
- "No project selected" warning state
- Project persistence in chrome.storage.sync

### Phase 2: Recording Implementation

#### Screen Recording
```typescript
// Use Chrome Screen Capture API
chrome.desktopCapture.chooseDesktopMedia(
  ['screen', 'window', 'tab'],
  (streamId) => {
    navigator.mediaDevices.getUserMedia({
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: streamId
        }
      }
    })
  }
)
```

#### Eye Tracking Integration
```typescript
// Use cogix-eye-tracking-core SDK
import { createEyeTracker } from '@iris-point/eye-tracking-core'

const tracker = createEyeTracker({
  wsUrl: 'wss://eye-tracker.local',
  bufferSize: 1000,
  sampleRate: 60
})

// Fallback to WebGazer for webcam tracking
if (!tracker.isConnected) {
  // Initialize WebGazer
}
```

#### Data Collection
```typescript
interface SessionData {
  projectId: string
  participantId: string
  sessionId: string
  startTime: number
  endTime: number
  videoUrl: string
  eyeTrackingData: GazeData[]
  metadata: {
    screenResolution: { width: number, height: number }
    browserInfo: string
    extensionVersion: string
  }
}
```

### Phase 3: Data Submission

#### Video Upload to R2
```typescript
// Upload video blob to Cloudflare R2
const uploadVideo = async (blob: Blob, sessionId: string) => {
  const formData = new FormData()
  formData.append('video', blob, `${sessionId}.webm`)
  
  // Get presigned URL from backend
  const { uploadUrl } = await getPresignedUrl(sessionId)
  
  // Direct upload to R2
  await fetch(uploadUrl, {
    method: 'PUT',
    body: blob
  })
  
  return `https://r2.cogix.app/${sessionId}.webm`
}
```

#### Session Data Submission
```typescript
// Submit to cogix-data-io worker
const submitSession = async (data: SessionData) => {
  const endpoint = `https://data-io.cogix.app/${userId}/${projectId}/${participantId}/${sessionId}`
  
  await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
}
```

## UI/UX Design

### Color Theme (from cogix-frontend)
```css
:root {
  --primary: oklch(0.205 0 0);           /* Dark gray/black */
  --primary-foreground: oklch(0.985 0 0); /* Near white */
  --accent: oklch(0.646 0.222 41.116);   /* Orange accent */
  --destructive: oklch(0.577 0.245 27.325); /* Red for recording */
  --success: #059669;                     /* Green for ready state */
  --border: oklch(0.922 0 0);            /* Light gray borders */
}
```

### Component Styling
- Match Shadcn UI components from frontend
- Use consistent border radius (0.625rem)
- Implement hover states with subtle transitions
- Recording button: Large, prominent with pulsing animation
- Status indicators: Clear visual feedback

## Security & Permissions

### Required Permissions
```json
{
  "permissions": [
    "storage",
    "cookies",
    "tabs",
    "activeTab",
    "scripting",
    "desktopCapture"
  ],
  "host_permissions": [
    "https://cogix.app/*",
    "https://clerk.cogix.app/*",
    "https://data-io.cogix.app/*",
    "https://r2.cogix.app/*"
  ]
}
```

### API Key Management
- Store API keys encrypted in chrome.storage.local
- Use project-specific API keys when available
- Fallback to user's default API key
- Never expose keys in console or UI

## Implementation Phases

### Phase 1: Project Selection (Day 1)
1. Add project API client
2. Create project selector UI
3. Implement project persistence
4. Add selection validation

### Phase 2: Basic Recording (Day 2-3)
1. Implement screen capture
2. Add MediaRecorder for video
3. Create recording controls UI
4. Handle recording state management

### Phase 3: Eye Tracking (Day 4-5)
1. Integrate cogix-eye-tracking-core
2. Add WebGazer fallback
3. Implement calibration UI
4. Sync eye data with video timestamps

### Phase 4: Data Upload (Day 6)
1. Implement video upload to R2
2. Create session data structure
3. Submit to data-io worker
4. Add upload progress UI

### Phase 5: Polish & Testing (Day 7)
1. Error handling and retries
2. Offline capability
3. Performance optimization
4. User testing

## Error Handling

### Recording Errors
- Screen capture denied: Show permission instructions
- Webcam access denied: Offer to continue without eye tracking
- Storage quota exceeded: Prompt to clear old recordings

### Upload Errors
- Network failure: Queue for retry
- API key invalid: Prompt for re-authentication
- Project not found: Reset project selection

## Performance Considerations

- Limit recording to 30 minutes max
- Compress video before upload (WebM VP8/VP9)
- Buffer eye tracking data in chunks
- Use Web Workers for heavy processing
- Implement progressive upload for large files

## Testing Strategy

### Unit Tests
- Project selection logic
- Recording state management
- Data transformation functions

### Integration Tests
- API communication
- Chrome storage operations
- Media recording pipeline

### E2E Tests
- Complete recording flow
- Upload and verification
- Error recovery scenarios

## Success Metrics

- Recording starts within 3 seconds
- Eye tracking accuracy > 80%
- Upload success rate > 95%
- User can view recording on platform within 1 minute