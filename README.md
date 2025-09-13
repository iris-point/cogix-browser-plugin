# Cogix Browser Extension

A powerful browser extension for screen recording with synchronized eye tracking data collection. Built with [Plasmo](https://docs.plasmo.com/) and integrated with the Cogix platform.

## Features

### 🎥 Screen Recording
- High-quality screen capture with MediaRecorder API
- Configurable recording settings (resolution, FPS, codec)
- Real-time recording indicators and controls

### 👁️ Eye Tracking Integration
- Hardware eye tracker support (via WebSocket)
- WebGazer webcam-based eye tracking fallback
- Real-time gaze point visualization overlay
- 60Hz+ gaze data collection during recording

### 🔄 Data Pipeline
- Automatic video upload to Cogix backend with CDN delivery
- Session data submission to cogix-data-io service
- Seamless integration with CogixStudio for analysis and playback

### 🔐 Authentication & Security
- Clerk authentication integration
- Secure API key management
- Project-based access control

## Quick Start

### Prerequisites
- Node.js 16+ and npm
- Chrome browser (Manifest V3 support)
- Cogix platform services running:
  - cogix-backend (port 8000)
  - cogix-data-api (port 8001)
  - cogix-frontend (port 3000)

### Installation

1. **Clone and Install**
   ```bash
   git clone <repository>
   cd cogix-browser-plugin
   npm install
   ```

2. **Development Build**
   ```bash
   npm run dev
   ```

3. **Load Extension**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select `build/chrome-mv3-dev/`

### Basic Usage

1. **Authentication**
   - Click extension icon in toolbar
   - Sign in with your Cogix account
   - Select a project from the dropdown

2. **Eye Tracker Setup**
   - Go to "Eye Tracking" tab in popup
   - Connect to your eye tracker (hardware or WebGazer)
   - Complete calibration process

3. **Recording**
   - Navigate to any website
   - Click the recording button in the bottom-left overlay
   - Perform your activities while being tracked
   - Click stop to end recording and upload data

4. **Analysis**
   - Open CogixStudio: `http://localhost:3000/projects/{project_id}/eye-tracking/test?storage=dataio`
   - View synchronized video playback with gaze data
   - Analyze user behavior and attention patterns

## Development

### Building the Extension

**Development Build:**
```bash
npm run dev
```

**Production Build:**
```bash
npm run build
```

**Debug Build:**
```bash
npm run debug-build
```

### Project Structure

```
cogix-browser-plugin/
├── src/
│   ├── popup/                 # Extension popup UI
│   │   ├── pages/            # Popup pages (auth, projects, eye-tracking)
│   │   └── components/       # Reusable UI components
│   ├── contents/             # Content scripts
│   │   └── unified-overlay.ts # Main recording overlay and controls
│   ├── background.ts         # Service worker for API calls and coordination
│   ├── contexts/            # React contexts for state management
│   └── utils/               # Utility functions and helpers
├── assets/                  # Extension assets and icons
└── build/                   # Built extension files
```

### Key Components

#### Content Script (`unified-overlay.ts`)
- Creates recording controls overlay
- Handles screen capture and gaze data collection
- Manages video upload and session data submission
- Real-time gaze point visualization

#### Background Script (`background.ts`)
- Handles API requests to avoid CORS issues
- Manages eye tracker WebSocket connections
- Coordinates between content scripts and popup

#### Popup Interface
- **Authentication**: Clerk-based sign-in/sign-out
- **Project Selection**: Choose active project for recordings
- **Eye Tracking**: Connection, calibration, and status monitoring

### Configuration

#### Environment Variables
Create `.env.local` in the project root:

```env
PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
PLASMO_PUBLIC_CLERK_SYNC_HOST=https://your-sync-host
```

#### API Endpoints
The extension connects to:
- **Backend API**: `https://api.cogix.app` (configurable)
- **Data-IO API**: `https://data-io.cogix.app` (configurable)
- **Eye Tracker**: `wss://127.0.0.1:8443` or `ws://127.0.0.1:9000`

## Architecture

### Data Flow

1. **Recording Initiation**
   - User clicks record button
   - Extension validates eye tracker connection and calibration
   - Screen capture stream is requested via `chrome.desktopCapture`

2. **Data Collection**
   - Video recorded using MediaRecorder API
   - Gaze data collected at 60Hz+ from eye tracker
   - Data synchronized using timestamps

3. **Upload Pipeline**
   - Video uploaded to cogix-backend → CDN URL returned
   - Session data (with video URL) submitted to cogix-data-io
   - Success/error feedback provided to user

4. **Visualization**
   - CogixStudio loads session data from cogix-data-io
   - Video and gaze data synchronized for playback
   - Analysis tools available for user behavior insights

### Storage Providers

The system supports two storage modes:

#### FileStorageProvider (Default)
- Local browser storage for development/testing
- Suitable for small datasets and offline work

#### DataIOStorageProvider (Production)
- Cloud-based storage via cogix-data-io
- Scalable for large datasets and team collaboration
- Activated with `?storage=dataio` URL parameter

## API Integration

### Authentication Flow
```typescript
// Extension uses Clerk for authentication
const { user, getToken } = useAuth();
const token = await getToken();

// Token used for all API requests
fetch(apiUrl, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Video Upload
```typescript
// Upload to cogix-backend
const formData = new FormData();
formData.append('file', videoBlob, 'recording.webm');
formData.append('folder_path', 'recordings');

const response = await fetch(`/api/v1/project-files/${projectId}/upload`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});
```

### Session Data Submission
```typescript
// Submit to cogix-data-io
const sessionData = {
  id: sessionId,
  videoUrl: cdnUrl,
  gazeData: gazePoints,
  metadata: { /* ... */ }
};

await fetch(`/${userId}/${projectId}/browser-extension/${sessionId}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ data: sessionData })
});
```

## Testing

### Manual Testing
See [RECORDING_WORKFLOW_TESTING.md](./RECORDING_WORKFLOW_TESTING.md) for comprehensive testing instructions.

### Automated Testing
```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e
```

### Debug Tools
- Browser DevTools for content script debugging
- Extension popup console for popup debugging
- Background script logs in extension service worker

## Troubleshooting

### Common Issues

#### Recording Button Not Working
- Verify eye tracker connection in popup
- Check calibration status
- Refresh page and try again

#### Upload Failures
- Check authentication status
- Verify backend services are running
- Check network connectivity and CORS settings

#### Gaze Data Issues
- Ensure eye tracker SDK is running
- Verify WebSocket connection
- Check calibration quality

### Debug Commands

```javascript
// Check extension storage
chrome.storage.sync.get(null, console.log);

// Check local storage
console.log('Failed recordings:', localStorage.getItem('failedRecordings'));

// Test API connectivity
fetch('http://localhost:8000/health').then(r => r.json()).then(console.log);
```

## Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make changes and test thoroughly
4. Submit a pull request with detailed description

### Code Style
- TypeScript with strict mode enabled
- ESLint and Prettier for code formatting
- React hooks for state management
- Async/await for asynchronous operations

### Testing Requirements
- Unit tests for utility functions
- Integration tests for API interactions
- Manual testing with real eye tracker hardware

## Deployment

### Development Deployment
1. Build extension: `npm run build`
2. Load unpacked in Chrome developer mode
3. Test with local Cogix services

### Production Deployment
1. Update version in `package.json` and `manifest.json`
2. Build production bundle: `npm run build`
3. Test thoroughly with production services
4. Package and distribute through appropriate channels

### Chrome Web Store
Follow [Chrome Web Store deployment guidelines](https://developer.chrome.com/docs/webstore/publish/) for public distribution.

## Documentation

- [Implementation Specification](./SCREEN_RECORDING_IMPLEMENTATION_SPEC.md)
- [Testing Guide](./RECORDING_WORKFLOW_TESTING.md)
- [API Documentation](../cogix-data-io/API_DOCUMENTATION.md)
- [Eye Tracking Integration](./EYE_TRACKING_INTEGRATION.md)

## Support

For technical support or questions:
- Check existing documentation and troubleshooting guides
- Review GitHub issues for similar problems
- Contact the development team with detailed error logs and reproduction steps
