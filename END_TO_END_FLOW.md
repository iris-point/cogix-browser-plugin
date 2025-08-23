# Cogix Browser Extension - End-to-End Flow

## Architecture Overview

The extension works exactly like Loom - clicking the extension icon overlays a recording setup interface on the current page, allowing users to configure and start eye tracking recordings that automatically upload to their Cogix project workspace.

## Key Components

### 1. **Session Management** (Shared with Cogix Website)
- **NextAuth Integration**: Reads session cookies from `localhost:3000` (Cogix website)
- **Automatic Sync**: When user logs in on website, extension automatically detects session
- **Token Management**: Uses same JWT tokens as main application
- **Cookie Reading**: Monitors `next-auth.session-token` cookies

### 2. **API Integration** (Same as cogix-frontend)
- **Projects API**: `/api/v1/projects` - List and select projects
- **Files API**: `/api/v1/projects/{id}/files` - Upload sessions
- **Signed URLs**: Uses same signed URL upload mechanism
- **Data Format**: Matches `TrackingSession` format from cogix-eye-tracking SDK

### 3. **Recording Flow**

#### Step 1: Extension Icon Click
```javascript
// User clicks extension icon
chrome.action.onClicked → Injects overlay on current page
```

#### Step 2: Authentication Check
```javascript
// Extension checks for existing session
SessionManager.getSession() → Reads NextAuth cookies
↓
If authenticated → Show recording setup
If not → Show login prompt → Opens Cogix website
```

#### Step 3: Project Selection
```javascript
// User selects project from dropdown
CogixAPIClient.getProjects() → Fetches user's projects
↓
User selects project → Stored in extension state
```

#### Step 4: Recording Configuration
- **Recording Mode**: Screen / Camera / Both
- **Eye Tracker**: HH Hardware / WebGazer
- **Audio**: Optional audio recording
- **Calibration**: Required for first use

#### Step 5: Start Recording
```javascript
// User clicks "Start Recording"
ContentManager.startRecording() →
  1. Start screen capture (navigator.mediaDevices.getDisplayMedia)
  2. Initialize eye tracker (HH or WebGazer)
  3. Start session recording
  4. Collect gaze data in real-time
```

#### Step 6: Data Collection
```javascript
// During recording
EyeTrackingManager.on('gazeData') → 
  Collects {x, y, timestamp, confidence} at 60Hz
  Stores in sessionData array
```

#### Step 7: Stop Recording
```javascript
// User stops recording
ContentManager.stopRecording() →
  1. Stop all media streams
  2. Format session data (matches TrackingSession format)
  3. Generate thumbnail
  4. Prepare for upload
```

#### Step 8: Upload to Project
```javascript
// Automatic upload to selected project
CogixAPIClient.uploadSession() →
  1. Get signed upload URL from backend
  2. Upload session JSON to S3/R2
  3. Upload video (if screen recorded)
  4. Create file record in database
  5. Session appears in project workspace
```

## Data Format (Matches cogix-frontend)

```typescript
interface TrackingSession {
  id: string;
  name: string;
  timestamp: number;
  duration: number;
  
  metadata: {
    url: string;
    title: string;
    projectId: string;
    provider: 'hh' | 'webgazer';
    browser: string;
    screenResolution: { width: number; height: number };
    viewport: { width: number; height: number };
  };
  
  gazeData: Array<{
    x: number;
    y: number;
    timestamp: number;
    confidence: number;
  }>;
  
  fixations: Fixation[];
  saccades: Saccade[];
  blinks: Blink[];
  aois: AOI[];
  
  videoBlob?: Blob;
  thumbnail?: string;
}
```

## API Endpoints Used (Same as cogix-frontend)

1. **Authentication**
   - `GET /api/auth/session` - Check session status
   - `POST /api/auth/callback/credentials` - Login
   - `POST /api/auth/signout` - Logout

2. **Projects**
   - `GET /api/v1/projects` - List user's projects
   - `GET /api/v1/projects/{id}` - Get project details

3. **File Upload**
   - `POST /api/v1/projects/{id}/files/signed-upload-url` - Get S3/R2 signed URL
   - `PUT {signed_url}` - Upload to cloud storage
   - `POST /api/v1/projects/{id}/files` - Create file record

## Security

1. **Token Security**
   - Tokens never stored in plain text
   - Uses Chrome's secure storage API
   - Automatic token refresh

2. **Session Validation**
   - Server-side session validation
   - CORS configured for extension origin
   - Cookie domain restrictions

3. **Data Privacy**
   - Local data cleared after upload
   - No persistent tracking
   - User consent for screen recording

## Installation & Testing

### Development Setup
```bash
cd cogix-browser-plugin
npm install
npm run build:extension
```

### Load in Chrome
1. Open `chrome://extensions/`
2. Enable Developer Mode
3. Click "Load unpacked"
4. Select `dist` folder

### Test Flow
1. **Start Backend Services**:
   ```bash
   cd ../cogix-backend && uvicorn app.main:app --reload --port 8000
   cd ../cogix-data-api && python start-server.py
   cd ../cogix-frontend && npm run dev
   ```

2. **Login on Website**:
   - Go to `http://localhost:3000`
   - Sign in with your account
   - Create a project if needed

3. **Use Extension**:
   - Navigate to any website
   - Click extension icon
   - Select your project
   - Configure recording settings
   - Click "Start Recording"
   - Perform eye tracking
   - Stop recording

4. **Verify Upload**:
   - Go to `http://localhost:3000/projects/{id}/eye-tracking/studio`
   - Session should appear in the list
   - Can be loaded and played back

## Compatibility

- **Browsers**: Chrome/Edge (Manifest V3)
- **Eye Trackers**: HH Hardware, WebGazer
- **Backend**: Cogix Backend API v1
- **Frontend**: Cogix Frontend (Next.js 15)
- **SDK**: @iris-point/eye-tracking

## Known Limitations

1. Chrome extension cannot access some protected pages (chrome://, edge://)
2. Screen recording requires user permission each time
3. WebGazer requires camera permissions
4. HH requires local service running

## Success Criteria

✅ Extension uses same auth as website (NextAuth cookies)
✅ Projects API works identically to frontend
✅ Session data format matches TrackingSession
✅ Upload uses same signed URL mechanism
✅ Sessions appear in project workspace
✅ Can be loaded in Cogix Studio
✅ Loom-style overlay interface
✅ Real-time eye tracking recording
✅ Automatic session upload