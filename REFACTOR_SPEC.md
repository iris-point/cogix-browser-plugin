# Browser Plugin System Refactor Specification

## Overview
Complete refactor of the browser plugin system to integrate with the cogix-eye-tracking-core SDK, implementing simultaneous eye tracking, screen recording, and event recording with Clerk authentication synchronized with the main cogix-frontend web application.

## Core Requirements

### 1. Authentication System
- **Clerk Integration**: Use same Clerk setup as cogix-frontend
- **Sync Host**: Synchronize authentication between web app and extension
- **Environment Configuration**:
  - Development: `http://localhost`
  - Production: Domain where Clerk Frontend API runs
- **User Flow**: Users authenticated in web app automatically authenticated in extension

### 2. Eye Tracking Integration
- **Core SDK Usage**: Leverage cogix-eye-tracking-core library as foundation
- **Providers**: Support both hardware (HH) and webcam (WebGazer) providers
- **Calibration**: Implement calibration using core SDK components
- **Data Collection**: 60Hz+ sampling rate with buffering

### 3. Recording Capabilities
- **Simultaneous Recording**:
  - Eye tracking data (gaze coordinates, pupil data, fixations)
  - Screen recording (video capture of active tab)
  - Event recording (mouse, keyboard, scroll, clicks)
- **Data Synchronization**: Timestamp alignment across all data streams
- **Storage**: Temporary local storage with direct upload to Cloudflare Worker

### 4. Data Submission via Cloudflare Worker
- **API Token Management**: 
  - User selects project in extension
  - Retrieves project's API token from frontend
  - Stores token securely in extension storage
- **Direct Upload**: 
  - Submit data directly to cogix-data-io Cloudflare Worker
  - No backend changes required
  - Use existing data ingestion endpoints
- **Data Format**: Match existing cogix-data-io schema
- **Batch Processing**: Send data in optimized chunks

### 5. Architecture

#### Plugin Structure
```
cogix-browser-plugin/
├── src/
│   ├── background/        # Service worker
│   ├── content/          # Content scripts
│   ├── popup/            # Extension popup UI
│   ├── sidepanel/        # Side panel UI
│   ├── core/             # Core SDK integration
│   ├── recording/        # Recording modules
│   ├── auth/             # Clerk authentication
│   ├── sync/             # Data synchronization
│   └── api/              # Cloudflare Worker integration
```

#### Core Components
1. **Background Service Worker**
   - Manages recording sessions
   - Handles data upload to Cloudflare Worker
   - Coordinates between content scripts and popup
   - Manages API token storage

2. **Content Script**
   - Injects eye tracking visualization
   - Captures DOM events
   - Manages screen recording
   - Streams data to background worker

3. **Popup/Side Panel UI**
   - Authentication status
   - Project selection (fetch from frontend)
   - Recording controls
   - Calibration interface
   - Settings management

4. **Core SDK Integration**
   - Import from @cogix-eye-tracking-core
   - Use EyeTrackingSDK class
   - Leverage existing providers
   - Utilize analysis tools

5. **Cloudflare Worker Client**
   - Direct API communication
   - Data formatting for cogix-data-io
   - Retry logic for failed uploads
   - Progress tracking

## Implementation Plan

### Phase 1: Authentication Setup
1. Install Clerk Chrome Extension SDK
2. Configure environment variables
3. Set up ClerkProvider with syncHost
4. Configure manifest permissions
5. Add extension ID to web app allowed_origins

### Phase 2: Core SDK Integration
1. Import cogix-eye-tracking-core modules
2. Set up EyeTrackingSDK instance
3. Configure providers (HH/WebGazer)
4. Implement data buffering

### Phase 3: Project & API Token Management
1. Fetch user's projects from frontend (via Clerk auth)
2. Project selection UI in extension
3. Retrieve and store API token for selected project
4. Secure token storage in chrome.storage

### Phase 4: UI Development
1. Create popup interface with React
2. Implement calibration UI using SDK components
3. Add recording controls
4. Display authentication status
5. Project selector component

### Phase 5: Recording Implementation
1. Screen recording using Chrome APIs
2. Event recording system
3. Data synchronization
4. Local storage management

### Phase 6: Cloudflare Worker Integration
1. Implement data formatting for cogix-data-io schema
2. Create upload client for Worker endpoints
3. Batch processing system
4. Error handling and retry logic
5. Progress tracking and user feedback

## Technical Specifications

### Dependencies
```json
{
  "@clerk/chrome-extension": "latest",
  "@cogix-eye-tracking-core": "file:../../",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.0.0",
  "vite": "^5.0.0",
  "typescript": "^5.0.0"
}
```

### Manifest Configuration
```json
{
  "manifest_version": 3,
  "permissions": [
    "cookies",
    "storage",
    "tabs",
    "activeTab",
    "scripting",
    "desktopCapture"
  ],
  "host_permissions": [
    "$PLASMO_PUBLIC_CLERK_SYNC_HOST/*",
    "$CLERK_FRONTEND_API/*",
    "https://cogix-data-io.workers.dev/*"
  ],
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }],
  "action": {
    "default_popup": "popup.html"
  },
  "side_panel": {
    "default_path": "sidepanel.html"
  }
}
```

### Environment Variables
```env
# Development
PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_FRONTEND_API=https://...
PLASMO_PUBLIC_CLERK_SYNC_HOST=http://localhost
VITE_FRONTEND_URL=http://localhost:3000
VITE_DATA_IO_URL=https://cogix-data-io.workers.dev

# Production
PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_FRONTEND_API=https://yourdomain.com
PLASMO_PUBLIC_CLERK_SYNC_HOST=https://yourdomain.com
VITE_FRONTEND_URL=https://yourdomain.com
VITE_DATA_IO_URL=https://cogix-data-io.workers.dev
```

### Data Flow
1. User authenticates in web app
2. Extension syncs auth state via Clerk
3. User selects project in extension
4. Extension fetches API token for project
5. User initiates recording session
6. Content script captures:
   - Eye tracking data from SDK
   - Screen recording via Chrome API
   - DOM events
7. Data buffered locally
8. Direct upload to Cloudflare Worker using API token
9. Worker processes and stores data

### Cloudflare Worker Integration
```typescript
// Data submission interface
interface DataSubmission {
  apiToken: string;
  sessionId: string;
  timestamp: number;
  data: {
    eyeTracking?: EyeTrackingData[];
    events?: EventData[];
    screenRecording?: ScreenRecordingChunk;
  };
}

// Endpoints
const WORKER_ENDPOINTS = {
  submit: '/api/submit',
  batch: '/api/batch',
  session: '/api/session'
};

// Upload client
class CloudflareWorkerClient {
  async submitData(submission: DataSubmission): Promise<void> {
    // Implementation
  }
  
  async createSession(apiToken: string, metadata: any): Promise<string> {
    // Implementation
  }
  
  async endSession(apiToken: string, sessionId: string): Promise<void> {
    // Implementation
  }
}
```

### API Token Management
```typescript
// Storage structure
interface ExtensionStorage {
  projects: Project[];
  selectedProjectId: string;
  apiTokens: {
    [projectId: string]: {
      token: string;
      expiresAt?: number;
    };
  };
}

// Project selection flow
1. Fetch projects from frontend API
2. Display in dropdown
3. On selection, fetch/retrieve API token
4. Store securely in chrome.storage.local
5. Use for all data submissions
```

### Data Schema (matching cogix-data-io)
```typescript
interface EyeTrackingData {
  timestamp: number;
  x: number;
  y: number;
  leftPupilDiameter?: number;
  rightPupilDiameter?: number;
  confidence?: number;
}

interface EventData {
  timestamp: number;
  type: 'click' | 'keypress' | 'scroll' | 'mousemove';
  target?: string;
  value?: any;
  coordinates?: { x: number; y: number };
}

interface ScreenRecordingChunk {
  timestamp: number;
  blob: Blob;
  duration: number;
  metadata: {
    url: string;
    title: string;
    viewport: { width: number; height: number };
  };
}
```

### Error Handling
- Graceful degradation if eye tracking unavailable
- Retry logic for failed Worker uploads
- Local data persistence on connection loss
- User notification system
- API token refresh mechanism

### Performance Considerations
- Efficient data buffering (1MB chunks)
- Throttled event recording
- Background upload to avoid UI blocking
- Memory management for long sessions
- Compression before upload

## Migration from Old System
- Keep browser-extension-eyetrack for reference
- Gradual feature migration
- No backend changes required
- Complete removal after validation

## Success Criteria
1. Seamless authentication sync with web app
2. Reliable simultaneous recording of all data streams
3. Successful calibration using core SDK
4. Direct data upload to Cloudflare Worker
5. User-friendly interface matching web app design
6. Performance: <5% CPU usage during recording
7. Data accuracy: >95% event capture rate
8. Successful project selection and API token management

## Testing Requirements
1. Unit tests for core modules
2. Integration tests for SDK usage
3. E2E tests for recording flow
4. Cloudflare Worker upload tests
5. API token management tests
6. Cross-browser compatibility
7. Performance benchmarking
8. Data integrity validation

## Security Considerations
1. Secure API token storage (chrome.storage.local)
2. Token encryption at rest
3. Content Security Policy compliance
4. CORS configuration for Worker
5. Data encryption in transit (HTTPS)
6. User consent for recording
7. Privacy-preserving defaults
8. Token expiration handling

## No Backend Changes Required
This refactor specifically avoids any changes to the existing backend systems:
- Uses existing Cloudflare Worker endpoints
- Leverages current API token system
- Maintains compatibility with existing data schemas
- No modifications to cogix-backend or cogix-data-api