import type { PlasmoCSConfig } from "plasmo"
import { Storage } from "@plasmohq/storage"
import type { 
  GazePoint, 
  EyeTrackingSessionData, 
  RecordingMetadata,
  SessionSubmissionMetadata
} from '../types/eye-tracking-session'
import { EYE_TRACKING_CONSTANTS } from '../types/eye-tracking-session'
import { showUploadProgress, hideUploadProgress } from './upload-progress'
import { dataIOClient } from '../lib/dataIOClient'
import { showConnectionTest, showConnectionTestFromBackground } from './connection-test'
import { validateProjectSelection, getSelectedProject } from '../lib/projectValidation'

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false,
  run_at: "document_end"
}

const storage = new Storage()

// Debug: Log that content script is loaded
console.log('Cogix content script loaded on:', window.location.href)

// Screen recording state
let isRecording = false
let recordingStartTime: number | null = null
let gazeDataBuffer: GazePoint[] = []
let mediaRecorder: MediaRecorder | null = null
let recordedChunks: Blob[] = []
let currentStream: MediaStream | null = null

// Gaze point overlay state
let showGazePoint = false
let gazePointElement: HTMLElement | null = null

// Create persistent gaze point element
function createGazePointElement() {
  if (gazePointElement) return gazePointElement;
  
  gazePointElement = document.createElement('div');
  gazePointElement.id = 'cogix-persistent-gaze-point';
  gazePointElement.style.cssText = `
    position: fixed !important;
    width: 12px !important;
    height: 12px !important;
    border-radius: 50% !important;
    background: rgba(255, 0, 0, 0.8) !important;
    border: 2px solid rgba(255, 255, 255, 0.9) !important;
    pointer-events: none !important;
    z-index: 2147483647 !important;
    transform: translate(-50%, -50%) !important;
    transition: all 0.05s ease !important;
    display: none !important;
    box-shadow: 0 0 10px rgba(255, 0, 0, 0.5) !important;
  `;
  document.body.appendChild(gazePointElement);
  return gazePointElement;
}

function updateGazePointPosition(x: number, y: number) {
  if (!showGazePoint) return; // Don't update if disabled
  
  // Eye tracker outputs normalized coordinates (0-1) - convert to screen pixels
  // This matches the emotion experiment's approach
  const screenX = x * window.innerWidth;
  const screenY = y * window.innerHeight;
  
  const element = createGazePointElement();
  element.style.left = `${screenX}px`;
  element.style.top = `${screenY}px`;
  element.style.display = 'block';
  
  // Debug: Log gaze point updates occasionally
  if (Math.random() < 0.01) { // Log 1% of updates to avoid spam
    console.log(`Gaze point updated: normalized(${x.toFixed(3)}, ${y.toFixed(3)}) → screen(${screenX.toFixed(1)}, ${screenY.toFixed(1)}) on viewport(${window.innerWidth}x${window.innerHeight})`);
  }
}

function hideGazePoint() {
  if (gazePointElement) {
    gazePointElement.style.display = 'none';
  }
}

// Helper function to show alert messages
function showAlert(message: string, container: HTMLElement) {
  const existingAlert = document.getElementById('cogix-alert');
  if (existingAlert) {
    existingAlert.remove();
  }
  
  const alert = document.createElement('div');
  alert.id = 'cogix-alert';
  alert.style.cssText = `
    position: absolute !important;
    bottom: 100% !important;
    left: 0 !important;
    right: 0 !important;
    margin-bottom: 8px !important;
    padding: 8px 12px !important;
    background: #fee2e2 !important;
    border: 1px solid #fecaca !important;
    border-radius: 6px !important;
    color: #991b1b !important;
    font-size: 13px !important;
    font-family: system-ui, -apple-system, sans-serif !important;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1) !important;
    animation: slideUp 0.3s ease !important;
    z-index: 2147483649 !important;
  `;
  
  alert.textContent = message;
  container.appendChild(alert);
  
  setTimeout(() => {
    alert.remove();
  }, 3000);
}

// Create unified overlay
async function createOverlay() {
  // Check if overlay already exists
  if (document.getElementById('cogix-unified-overlay')) {
    return;
  }

  // Load initial state
  const projectData = await chrome.storage.sync.get(['selectedProject']);
  const selectedProject = projectData.selectedProject;
  const isRecording = await storage.get('isRecording') || false;
  showGazePoint = await storage.get('showGazePoint') || false;

  // Create main container (bottom-left)
  const container = document.createElement('div');
  container.id = 'cogix-unified-overlay';
  container.style.cssText = `
    position: fixed !important;
    bottom: 20px !important;
    left: 20px !important;
    z-index: 2147483647 !important;
    font-family: system-ui, -apple-system, sans-serif !important;
  `;

  // Create control panel
  const panel = document.createElement('div');
  panel.style.cssText = `
    background: white !important;
    border-radius: 12px !important;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1) !important;
    overflow: hidden !important;
    display: flex !important;
    align-items: center !important;
    transition: all 0.3s ease !important;
  `;

  // Create project indicator section (non-clickable, just displays current project)
  const projectSection = document.createElement('div');
  projectSection.style.cssText = `
    padding: 12px 16px !important;
    border-right: 1px solid #e5e7eb !important;
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    min-width: 200px !important;
  `;

  const projectIcon = document.createElement('div');
  projectIcon.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
      <path d="M3 3h18v18H3zM3 9h18M9 3v18"></path>
    </svg>
  `;

  const projectInfo = document.createElement('div');
  projectInfo.style.cssText = `
    flex: 1 !important;
  `;

  const projectLabel = document.createElement('div');
  projectLabel.style.cssText = `
    font-size: 11px !important;
    color: #9ca3af !important;
    margin-bottom: 2px !important;
  `;
  projectLabel.textContent = 'Project';

  const projectName = document.createElement('div');
  projectName.id = 'cogix-project-name';
  projectName.style.cssText = `
    font-size: 13px !important;
    color: #1f2937 !important;
    font-weight: 500 !important;
  `;
  projectName.textContent = selectedProject?.name || 'No project selected';
  
  // Add gaze tracking indicator
  const gazeIndicator = document.createElement('div');
  gazeIndicator.id = 'cogix-gaze-indicator';
  gazeIndicator.style.cssText = `
    font-size: 10px !important;
    color: #10b981 !important;
    margin-top: 2px !important;
    display: none !important;
  `;
  gazeIndicator.textContent = '👁️ Gaze tracking active';

  projectInfo.appendChild(projectLabel);
  projectInfo.appendChild(projectName);
  projectInfo.appendChild(gazeIndicator);
  projectSection.appendChild(projectIcon);
  projectSection.appendChild(projectInfo);

  // Listen for project selection changes from storage
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.selectedProject) {
      const newProject = changes.selectedProject.newValue;
      projectName.textContent = newProject?.name || 'No project selected';
      console.log('Project indicator updated:', newProject?.name);
    }
  });

  // Create controls section
  const controlsSection = document.createElement('div');
  controlsSection.style.cssText = `
    display: flex !important;
    align-items: center !important;
    padding: 8px !important;
    gap: 8px !important;
  `;

  // Create record button
  const recordButton = document.createElement('button');
  recordButton.id = 'cogix-record-btn';
  recordButton.style.cssText = `
    width: 48px !important;
    height: 48px !important;
    border-radius: 50% !important;
    background: ${isRecording ? '#ef4444' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'} !important;
    border: none !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    transition: all 0.2s ease !important;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
  `;

  recordButton.onmouseover = () => {
    recordButton.style.transform = 'scale(1.1)';
    recordButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
  };

  recordButton.onmouseout = () => {
    recordButton.style.transform = 'scale(1)';
    recordButton.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
  };

  // Add icon based on recording state
  const updateRecordIcon = (recording: boolean) => {
    if (recording) {
      recordButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect>
        </svg>
      `;
      recordButton.style.background = '#ef4444';
    } else {
      recordButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <circle cx="12" cy="12" r="10"></circle>
        </svg>
      `;
      recordButton.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
  };

  updateRecordIcon(Boolean(isRecording));

  // Create gaze point toggle button
  const gazeToggleButton = document.createElement('button');
  gazeToggleButton.style.cssText = `
    width: 32px !important;
    height: 32px !important;
    border-radius: 50% !important;
    background: ${showGazePoint ? '#10b981' : '#f3f4f6'} !important;
    border: none !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    transition: all 0.2s ease !important;
    margin-left: 8px !important;
  `;

  gazeToggleButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${showGazePoint ? 'white' : '#6b7280'}" stroke-width="2">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24"></path>
    </svg>
  `;

  gazeToggleButton.title = 'Toggle Gaze Point Overlay';
  
  const updateGazeToggleButton = () => {
    gazeToggleButton.style.background = showGazePoint ? '#10b981' : '#f3f4f6';
    const svg = gazeToggleButton.querySelector('svg');
    if (svg) {
      svg.setAttribute('stroke', showGazePoint ? 'white' : '#6b7280');
    }
    
    // Show/hide existing gaze point
    if (!showGazePoint && gazePointElement) {
      gazePointElement.style.display = 'none';
    }
  };
  
  gazeToggleButton.onclick = () => {
    showGazePoint = !showGazePoint;
    storage.set('showGazePoint', showGazePoint);
    updateGazeToggleButton();
    console.log('Gaze point overlay toggled:', showGazePoint);
  };
  
  // Set initial button state
  updateGazeToggleButton();

  // Handle record button click
  recordButton.onclick = async () => {
    console.log('Record button clicked');
    
    try {
      // Validate project selection before recording
      const project = await validateProjectSelection();
      console.log('✅ Project validated for recording:', project.name);
    } catch (error) {
      console.error('❌ Project validation failed:', error);
      // Project selection modal will be shown by validateProjectSelection()
      return;
    }
    
    // Get project info for recording
    const projectData = await chrome.storage.sync.get(['selectedProject']);
    const projectId = projectData.selectedProject?.id;
    const projectName = projectData.selectedProject?.name;
    
    // Check if eye tracker is connected and calibrated
    // Get fresh status from background script to ensure accuracy
    let eyeTrackerStatus;
    try {
      const statusResponse = await chrome.runtime.sendMessage({ type: 'EYE_TRACKER_STATUS' });
      console.log('Background script returned status:', statusResponse);
      eyeTrackerStatus = {
        eyeTrackerConnected: statusResponse.isConnected,
        eyeTrackerCalibrated: statusResponse.isCalibrated,
        isTracking: statusResponse.isTracking
      };
      console.log('Fresh eye tracker status:', eyeTrackerStatus);
      
      // Also update local storage for consistency
      chrome.storage.local.set({
        eyeTrackerConnected: statusResponse.isConnected,
        eyeTrackerCalibrated: statusResponse.isCalibrated,
        eyeTrackerTracking: statusResponse.isTracking
      });
    } catch (error) {
      console.warn('Failed to get fresh status, falling back to storage:', error);
      eyeTrackerStatus = await chrome.storage.local.get([
        'eyeTrackerConnected', 
        'eyeTrackerCalibrated',
        'eyeTrackerTracking'
      ]);
    }
    
    if (!eyeTrackerStatus.eyeTrackerConnected) {
      showAlert('Please connect eye tracker from the extension popup first', container);
      return;
    }
    
    if (!eyeTrackerStatus.eyeTrackerCalibrated) {
      showAlert('Please calibrate the eye tracker before recording.\nClick the Calibrate button in the extension popup.', container);
      return;
    }
    
    console.log('Eye tracker is connected and calibrated, ready to record');
    
    const currentlyRecording = await storage.get('isRecording') || false;
    const newRecordingState = !currentlyRecording;
    
    console.log('Toggling recording state to:', newRecordingState);
    
    // Update storage
    await storage.set('isRecording', newRecordingState);
    
    // Update button appearance
    updateRecordIcon(newRecordingState);
    
    // Send message to background script
    chrome.runtime.sendMessage({
      type: 'TOGGLE_RECORDING',
      isRecording: newRecordingState,
      projectId: projectId
    });
    
    // Show feedback
    if (newRecordingState) {
      showAlert(`Recording started for project: ${projectName}`, container);
    } else {
      showAlert('Recording stopped', container);
    }
  };

  // Create test connection button
  const testButton = document.createElement('button');
  testButton.title = 'Test Data-IO Connection';
  testButton.style.cssText = `
    width: 32px !important;
    height: 32px !important;
    border-radius: 50% !important;
    background: #f3f4f6 !important;
    border: none !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    transition: all 0.2s ease !important;
  `;

  testButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
      <path d="M9 12l2 2 4-4"></path>
      <circle cx="12" cy="12" r="9"></circle>
    </svg>
  `;

  testButton.onmouseover = () => {
    testButton.style.background = '#e5e7eb';
  };

  testButton.onmouseout = () => {
    testButton.style.background = '#f3f4f6';
  };

  testButton.onclick = async () => {
    console.log('Test connection button clicked');
    
    try {
      // Validate project selection before testing
      const project = await validateProjectSelection();
      console.log('✅ Project validated for testing:', project.name);
      
      // Use background script for testing (avoids CORS issues)
      showConnectionTestFromBackground(project.id);
      
    } catch (error) {
      console.error('❌ Project validation failed for testing:', error);
      // Project selection modal will be shown by validateProjectSelection()
    }
  };

  // Create minimize button
  const minimizeButton = document.createElement('button');
  minimizeButton.style.cssText = `
    width: 32px !important;
    height: 32px !important;
    border-radius: 50% !important;
    background: #f3f4f6 !important;
    border: none !important;
    cursor: pointer !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    transition: all 0.2s ease !important;
  `;

  minimizeButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  `;

  minimizeButton.onmouseover = () => {
    minimizeButton.style.background = '#e5e7eb';
  };

  minimizeButton.onmouseout = () => {
    minimizeButton.style.background = '#f3f4f6';
  };

  let isMinimized = false;
  minimizeButton.onclick = () => {
    isMinimized = !isMinimized;
    if (isMinimized) {
      projectSection.style.display = 'none';
      panel.style.borderRadius = '50%';
      minimizeButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      `;
    } else {
      projectSection.style.display = 'flex';
      panel.style.borderRadius = '12px';
      minimizeButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      `;
    }
  };

  // Assemble components
  controlsSection.appendChild(recordButton);
  controlsSection.appendChild(gazeToggleButton);
  controlsSection.appendChild(testButton);
  controlsSection.appendChild(minimizeButton);
  
  panel.appendChild(projectSection);
  panel.appendChild(controlsSection);
  
  container.appendChild(panel);
  document.body.appendChild(container);

  // Listen for recording state changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.isRecording) {
      updateRecordIcon(changes.isRecording.newValue);
    }
  });
}

// Initialize overlay when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createOverlay);
} else {
  createOverlay();
}

// Screen recording functions
async function startScreenRecording(projectId: string): Promise<void> {
  if (isRecording) {
    console.log('Recording already in progress')
    return
  }

  try {
    // Request screen capture from background script
    const response = await chrome.runtime.sendMessage({
      type: 'REQUEST_SCREEN_CAPTURE',
      sources: ['screen', 'window', 'tab']
    })

    if (!response.streamId) {
      throw new Error('User cancelled screen capture or no permission')
    }

    // Get media stream
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: response.streamId,
          maxWidth: 1280,
          maxHeight: 720,
          maxFrameRate: 30
        }
      } as any,
      audio: false // Disable audio for now to avoid permission issues
    })

    // Set up MediaRecorder
    const mimeType = getSupportedMimeType()
    mediaRecorder = new MediaRecorder(currentStream, {
      mimeType,
      videoBitsPerSecond: 1500000
    })

    recordedChunks = []
    gazeDataBuffer = []
    recordingStartTime = Date.now()

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data)
      }
    }

    mediaRecorder.onstop = async () => {
      await finalizeRecording(projectId)
    }

    mediaRecorder.start(1000) // Collect data every second
    isRecording = true

    // Show recording indicator
    showRecordingIndicator()
    
    // Show gaze point during recording
    const gazePointElement = document.getElementById('cogix-gaze-point')
    if (gazePointElement) {
      gazePointElement.style.display = 'block'
    }

    console.log(`Screen recording started for project ${projectId}`)
    
  } catch (error) {
    console.error('Failed to start screen recording:', error)
    showAlert(`Failed to start recording: ${error.message}`, document.body)
  }
}

async function stopScreenRecording(): Promise<void> {
  if (!isRecording || !mediaRecorder) {
    return
  }

  mediaRecorder.stop()
  isRecording = false

  // Hide recording indicator and gaze point
  hideRecordingIndicator()
  const gazePointElement = document.getElementById('cogix-gaze-point')
  if (gazePointElement) {
    gazePointElement.style.display = 'none'
  }

  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop())
    currentStream = null
  }
}

async function finalizeRecording(projectId: string): Promise<void> {
  if (!recordingStartTime) return

  const videoBlob = new Blob(recordedChunks, { 
    type: getSupportedMimeType() 
  })

  const duration = Date.now() - recordingStartTime;
  const sessionId = `${EYE_TRACKING_CONSTANTS.BROWSER_PLUGIN_PREFIX}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log('Recording session completed:', {
    sessionId,
    duration: duration / 1000,
    gazePoints: gazeDataBuffer.length,
    videoSize: videoBlob.size
  });

  try {
    // Create video file for upload
    const videoFile = new File([videoBlob], `recording-${sessionId}.webm`, { 
      type: getSupportedMimeType() 
    });

    // Create gaze data file for upload
    const gazeDataFile = new File([JSON.stringify(gazeDataBuffer)], `gaze-data-${sessionId}.json`, { 
      type: 'application/json' 
    });

    // Prepare metadata using the same structure as cogixAPIClient
    const metadata: Partial<RecordingMetadata> = {
      duration: duration / 1000,
      screen_width: screen.width,
      screen_height: screen.height,
      device: 'browser-extension',
      source: 'browser-extension',
      gaze_points_count: gazeDataBuffer.length,
      has_video: true,
      has_gaze_file: true,
      storage_type: 'edge_r2',
      
      // Browser-specific metadata
      url: window.location.href,
      title: document.title,
      user_agent: navigator.userAgent,
      
      // Recording settings
      recording_settings: {
        fps: EYE_TRACKING_CONSTANTS.DEFAULT_VIDEO_FPS,
        resolution: '1280x720',
        codec: getSupportedMimeType()
      },
      
      // Eye tracking settings
      eye_tracking_settings: {
        sampling_rate: EYE_TRACKING_CONSTANTS.DEFAULT_SAMPLING_RATE,
        tracker_model: 'hardware'
      }
    };

    // Upload session using background script (avoids ALL CORS issues)
    showUploadProgress({
      stage: 'token',
      progress: 5,
      message: 'Preparing upload via background script...',
      sessionId: sessionId
    });

    // Convert video blob to transferable format for background script
    console.log('🔄 Converting video blob for background transfer...');
    const videoArray = Array.from(new Uint8Array(await videoBlob.arrayBuffer()));
    
    console.log('📡 Sending upload request to background script:', {
      sessionId,
      projectId,
      videoSize: videoArray.length,
      gazePoints: gazeDataBuffer.length
    });
    
    const result = await chrome.runtime.sendMessage({
      type: 'DATA_IO_UPLOAD_SESSION',
      projectId: projectId,
      sessionId: sessionId,
      videoBlob: videoArray, // Serializable Uint8Array
      gazeData: gazeDataBuffer,
      metadata: {
        ...metadata,
        url: window.location.href,
        title: document.title
      },
      screenDimensions: {
        width: screen.width,
        height: screen.height
      }
    });

    if (!result.success) {
      throw new Error(result.error || 'Background upload failed');
    }

    console.log('Complete session uploaded successfully:', result);
    
    // Show final completion message
    showUploadProgress({
      stage: 'complete',
      progress: 100,
      message: 'Upload completed successfully!',
      sessionId: sessionId
    });
    
  } catch (error) {
    console.error('Failed to upload recording:', error);
    
    // Show error in progress UI with detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    showUploadProgress({
      stage: 'error',
      progress: 0,
      message: 'Upload failed',
      sessionId: sessionId,
      errorDetails: errorMessage
    });
    
    // Store session locally for retry later (enhanced error recovery)
    const failedSession = {
      sessionId,
      projectId,
      videoBlob: Array.from(new Uint8Array(await videoBlob.arrayBuffer())), // Convert to serializable format
      gazeData: gazeDataBuffer,
      metadata: {
        duration: duration / 1000,
        url: window.location.href,
        title: document.title,
        userAgent: navigator.userAgent,
        screenWidth: screen.width,
        screenHeight: screen.height,
        gazePointsCount: gazeDataBuffer.length,
        videoSize: videoBlob.size,
        codec: getSupportedMimeType()
      },
      uploadFailed: true,
      error: errorMessage,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    // Store in local storage for retry
    try {
      const failedSessions = JSON.parse(localStorage.getItem('failedRecordings') || '[]');
      failedSessions.push(failedSession);
      
      // Keep only the last 10 failed sessions to avoid storage bloat
      if (failedSessions.length > 10) {
        failedSessions.splice(0, failedSessions.length - 10);
      }
      
      localStorage.setItem('failedRecordings', JSON.stringify(failedSessions));
      console.log('Session stored locally for retry:', sessionId);
    } catch (storageError) {
      console.error('Failed to store session locally:', storageError);
    }
  }
  
  // Clean up
  recordedChunks = []
  gazeDataBuffer = []
  recordingStartTime = null
  mediaRecorder = null
}

function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4'
  ]
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  
  return 'video/webm' // Fallback
}

// Legacy functions removed - now using dataIOClient for consistent behavior

// Legacy function - kept for backward compatibility
async function uploadVideoToBackend(videoBlob: Blob, projectId: string): Promise<string> {
  // Get authentication token
  const authData = await chrome.storage.sync.get(['clerkToken']);
  const token = authData.clerkToken;
  
  if (!token) {
    throw new Error('Not authenticated. Please sign in to the extension.');
  }

  // Create form data
  const formData = new FormData();
  const filename = `recording_${Date.now()}.webm`;
  formData.append('file', videoBlob, filename);
  formData.append('folder_path', 'recordings');
  formData.append('overwrite', 'true');

  // Upload to backend
  const API_BASE_URL = 'https://api.cogix.app';
  const uploadUrl = `${API_BASE_URL}/api/v1/project-files/${projectId}/upload`;
  
  console.log('Uploading video to:', uploadUrl);
  
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Upload response error:', response.status, errorText);
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  console.log('Upload result:', result);
  
  // Return the signed URL or file path that can be used to access the video
  return result.signed_url || result.file_path || result.url;
}

// Get or create API key for data-io submissions
async function getDataIOApiKey(projectId: string): Promise<string> {
  // Check if we have a cached API key
  const cacheKey = `dataio_api_key_${projectId}`;
  const cachedKey = localStorage.getItem(cacheKey);
  
  if (cachedKey) {
    console.log('Using cached API key for project:', projectId);
    return cachedKey;
  }

  // Get fresh API key from backend
  const authData = await chrome.storage.sync.get(['clerkToken']);
  const token = authData.clerkToken;
  
  if (!token) {
    throw new Error('Not authenticated. Please sign in to the extension.');
  }

  const API_BASE_URL = 'https://api.cogix.app';
  const apiKeyUrl = `${API_BASE_URL}/api/v1/projects/${projectId}/default-api-key`;
  
  console.log('Getting API key from:', apiKeyUrl);
  
  const response = await fetch(apiKeyUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('API key request error:', response.status, errorText);
    throw new Error(`Failed to get API key: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  console.log('API key result:', result);
  
  // Extract the API key from the response
  let apiKey = result.api_key || result.encrypted_key;
  
  if (!apiKey) {
    throw new Error('No API key returned from backend');
  }

  // Cache the key for future use (with expiration)
  localStorage.setItem(cacheKey, apiKey);
  localStorage.setItem(`${cacheKey}_expires`, (Date.now() + 24 * 60 * 60 * 1000).toString()); // 24 hours
  
  return apiKey;
}

// Submit session data to cogix-data-io (simplified with Clerk auth)
async function submitSessionToDataIO(sessionData: any, projectId: string): Promise<void> {
  // Get authentication token
  const authData = await chrome.storage.sync.get(['clerkToken', 'clerkUser']);
  const token = authData.clerkToken;
  const user = authData.clerkUser;
  
  if (!token || !user) {
    throw new Error('Not authenticated. Please sign in to the extension.');
  }

  // Use Clerk user ID directly (data-io now handles Clerk auth)
  const DATA_IO_URL = 'https://data-io.cogix.app';
  const userId = user.id; // Clerk user ID
  const participantId = 'browser-extension'; // Could be made configurable
  const sessionId = sessionData.id;
  
  // Build submission URL using Clerk user ID
  const submitUrl = `${DATA_IO_URL}/${userId}/${projectId}/${participantId}/${sessionId}`;
  
  console.log('Submitting session data to:', submitUrl);
  
  // Prepare submission payload
  const submissionPayload = {
    data: sessionData,
    metadata: {
      device: 'browser-extension',
      version: chrome.runtime.getManifest().version,
      submitted_at: new Date().toISOString(),
      eyeTrackerType: 'hardware', // Could be detected from actual tracker type
      browser: navigator.userAgent
    }
  };
  
  const response = await fetch(submitUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(submissionPayload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Data-IO submission error:', response.status, errorText);
    
    // If it's an auth error, clear cached API key and retry once
    if (response.status === 401 || response.status === 403) {
      console.log('Auth error, clearing cached API key and retrying...');
      const cacheKey = `dataio_api_key_${projectId}`;
      localStorage.removeItem(cacheKey);
      localStorage.removeItem(`${cacheKey}_expires`);
      
      // Retry with fresh Clerk token
      const freshAuthData = await chrome.storage.sync.get(['clerkToken']);
      const freshToken = freshAuthData.clerkToken;
      
      const retryResponse = await fetch(submitUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${freshToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(submissionPayload)
      });
      
      if (!retryResponse.ok) {
        const retryErrorText = await retryResponse.text();
        console.error('Retry submission error:', retryResponse.status, retryErrorText);
        throw new Error(`Data submission failed after retry: ${retryResponse.status} ${retryResponse.statusText}`);
      }
      
      const retryResult = await retryResponse.json();
      console.log('Data-IO retry submission result:', retryResult);
      return;
    }
    
    throw new Error(`Data submission failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  console.log('Data-IO submission result:', result);
}

function showRecordingIndicator(): void {
  // Remove existing indicator if any
  const existing = document.getElementById('cogix-recording-indicator')
  if (existing) {
    existing.remove()
  }

  const indicator = document.createElement('div')
  indicator.id = 'cogix-recording-indicator'
  indicator.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    background: rgba(220, 38, 38, 0.9) !important;
    color: white !important;
    padding: 8px 16px !important;
    border-radius: 20px !important;
    font-family: system-ui, -apple-system, sans-serif !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    z-index: 2147483648 !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
    animation: recordingPulse 2s infinite !important;
  `

  // Add recording dot animation
  const dot = document.createElement('div')
  dot.style.cssText = `
    width: 8px !important;
    height: 8px !important;
    border-radius: 50% !important;
    background: white !important;
    animation: recordingDot 1s infinite alternate !important;
  `

  indicator.appendChild(dot)
  indicator.appendChild(document.createTextNode('Recording'))

  // Add CSS animations
  const style = document.createElement('style')
  style.textContent = `
    @keyframes recordingPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    @keyframes recordingDot {
      0% { opacity: 1; }
      100% { opacity: 0.3; }
    }
  `
  document.head.appendChild(style)
  document.body.appendChild(indicator)
}

function hideRecordingIndicator(): void {
  const indicator = document.getElementById('cogix-recording-indicator')
  if (indicator) {
    indicator.remove()
  }
}

// Calibration state
let isCalibrating = false
let calibrationOverlay: HTMLElement | null = null
let calibrationPoints = [
  { x: 0.1, y: 0.1 },  // Top-left
  { x: 0.9, y: 0.1 },  // Top-right  
  { x: 0.5, y: 0.5 },  // Center
  { x: 0.1, y: 0.9 },  // Bottom-left
  { x: 0.9, y: 0.9 }   // Bottom-right
]
let currentCalibrationPoint = 0

// Keyboard handler for calibration control
const handleCalibrationKeyPress = (event: KeyboardEvent) => {
  if (!isCalibrating) return
  
  switch (event.key) {
    case 'Escape':
      console.log('ESC pressed - cancelling calibration')
      stopCalibration()
      break
    case ' ': // Spacebar
      console.log('SPACE pressed - skipping to next point')
      event.preventDefault()
      if (currentCalibrationPoint < calibrationPoints.length - 1) {
        currentCalibrationPoint++
        showCalibrationPoint(currentCalibrationPoint)
      } else {
        stopCalibration()
      }
      break
  }
}

async function startCalibration() {
  if (isCalibrating) return
  
  console.log('Starting full-screen calibration...')
  isCalibrating = true
  currentCalibrationPoint = 0
  
  // Request fullscreen first (like the emotion experiment)
  try {
    const element = document.documentElement
    if (element.requestFullscreen) {
      await element.requestFullscreen()
    } else if ((element as any).mozRequestFullScreen) {
      await (element as any).mozRequestFullScreen()
    } else if ((element as any).webkitRequestFullscreen) {
      await (element as any).webkitRequestFullscreen()
    } else if ((element as any).msRequestFullscreen) {
      await (element as any).msRequestFullscreen()
    }
    console.log('Fullscreen mode activated')
  } catch (error) {
    console.warn('Could not enter fullscreen:', error)
    // Continue with calibration even if fullscreen fails
  }
  
  // Create calibration overlay with instructions
  calibrationOverlay = document.createElement('div')
  calibrationOverlay.id = 'cogix-calibration-overlay'
  calibrationOverlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background: #252A3D !important;
    z-index: 2147483650 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-family: system-ui, -apple-system, sans-serif !important;
    color: white !important;
  `
  
  // Show instructions first
  const instructions = document.createElement('div')
  instructions.id = 'calibration-instructions'
  instructions.style.cssText = `
    text-align: center !important;
    font-size: 24px !important;
    font-weight: 400 !important;
    max-width: 800px !important;
    padding: 40px !important;
  `
  instructions.innerHTML = `
    <h2 style="margin-bottom: 30px; font-size: 42px; font-weight: 600;">Eye Tracker Calibration</h2>
    <div style="margin-bottom: 40px; line-height: 1.6;">
      <p style="margin-bottom: 20px; font-size: 26px;">📍 <strong>Instructions:</strong></p>
      <p style="margin-bottom: 15px; font-size: 20px; color: #e0e0e0;">
        1. Look directly at each calibration point when it appears
      </p>
      <p style="margin-bottom: 15px; font-size: 20px; color: #e0e0e0;">
        2. Keep your head still and focus on the center of each point
      </p>
      <p style="margin-bottom: 15px; font-size: 20px; color: #e0e0e0;">
        3. Each point will be shown for 3 seconds
      </p>
      <p style="margin-bottom: 15px; font-size: 20px; color: #e0e0e0;">
        4. There are 5 calibration points in total
      </p>
    </div>
    <button id="start-calibration-btn" style="
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      color: white !important;
      border: none !important;
      padding: 16px 48px !important;
      font-size: 20px !important;
      font-weight: 500 !important;
      border-radius: 8px !important;
      cursor: pointer !important;
      transition: transform 0.2s ease !important;
      margin-bottom: 30px !important;
    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
      Start Calibration
    </button>
    <div style="margin-top: 20px; font-size: 16px; color: #aaa;">
      <p>Press <strong>ESC</strong> at any time to cancel</p>
    </div>
  `
  
  calibrationOverlay.appendChild(instructions)
  document.body.appendChild(calibrationOverlay)
  
  // Add keyboard event handlers for calibration control
  document.addEventListener('keydown', handleCalibrationKeyPress)
  
  // Wait for user to click start button
  const startBtn = document.getElementById('start-calibration-btn')
  if (startBtn) {
    startBtn.onclick = () => {
      // Hide instructions
      instructions.style.display = 'none'
      
      // Show calibration progress UI
      const progressUI = document.createElement('div')
      progressUI.id = 'calibration-progress-ui'
      progressUI.style.cssText = `
        text-align: center !important;
        font-size: 20px !important;
        color: white !important;
      `
      progressUI.innerHTML = `
        <p style="margin-bottom: 20px; font-size: 24px;">Look at the calibration point</p>
        <p style="font-size: 18px; color: #4CAF50;">Point <span id="calibration-progress">1</span> of 5</p>
      `
      calibrationOverlay.appendChild(progressUI)
      
      // Add cancel button
      const cancelButton = document.createElement('button')
      cancelButton.style.cssText = `
        position: absolute !important;
        bottom: 50px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        background: rgba(239, 68, 68, 0.9) !important;
        color: white !important;
        border: none !important;
        padding: 15px 30px !important;
        border-radius: 8px !important;
        font-size: 18px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        z-index: 2147483651 !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
      `
      cancelButton.textContent = '✕ Cancel Calibration (ESC)'
      cancelButton.onclick = () => {
        console.log('Cancel button clicked')
        stopCalibration()
      }
      calibrationOverlay.appendChild(cancelButton)
      
      // Start the actual calibration
      // Show first calibration point immediately
      showCalibrationPoint(0)
      console.log('Showing initial calibration point')
      
      // Send start message immediately - HHProvider will wait 3 seconds
      setTimeout(() => {
        console.log('Sending START_EYE_TRACKER_CALIBRATION message')
        chrome.runtime.sendMessage({
          type: 'START_EYE_TRACKER_CALIBRATION'
        }).catch(error => {
          console.error('Failed to send calibration start message:', error)
        })
      }, 100) // Small delay to ensure point is visible
    }
  }
}

function showCalibrationPoint(pointIndex: number) {
  if (!calibrationOverlay || pointIndex < 0 || pointIndex >= calibrationPoints.length) return
  
  // Remove existing point
  const existingPoint = document.getElementById('calibration-point')
  if (existingPoint) {
    existingPoint.remove()
  }
  
  const point = calibrationPoints[pointIndex]
  console.log(`Showing calibration point ${pointIndex + 1}/5 at normalized coordinates (${point.x}, ${point.y})`)
  console.log(`This corresponds to screen position: (${point.x * window.innerWidth}px, ${point.y * window.innerHeight}px)`)
  
  const pointElement = document.createElement('div')
  pointElement.id = 'calibration-point'
  
  // Keep the original circular point design but make it more visible
  pointElement.style.cssText = `
    position: absolute !important;
    width: 30px !important;
    height: 30px !important;
    border-radius: 50% !important;
    background: #4CAF50 !important;
    border: 4px solid white !important;
    box-shadow: 0 0 30px rgba(76, 175, 80, 0.8), 0 0 60px rgba(76, 175, 80, 0.4) !important;
    transform: translate(-50%, -50%) !important;
    left: ${point.x * 100}% !important;
    top: ${point.y * 100}% !important;
    animation: calibrationPulse 1s infinite alternate !important;
    pointer-events: none !important;
  `
  
  // Add pulse animation
  if (!document.getElementById('calibration-styles')) {
    const style = document.createElement('style')
    style.id = 'calibration-styles'
    style.textContent = `
      @keyframes calibrationPulse {
        0% { transform: translate(-50%, -50%) scale(1); }
        100% { transform: translate(-50%, -50%) scale(1.2); }
      }
    `
    document.head.appendChild(style)
  }
  
  calibrationOverlay.appendChild(pointElement)
  
  // Update progress
  const progressElement = document.getElementById('calibration-progress')
  if (progressElement) {
    progressElement.textContent = (pointIndex + 1).toString()
  }
  
  // Add debug info to the overlay
  const debugInfo = document.getElementById('calibration-debug') || document.createElement('div')
  debugInfo.id = 'calibration-debug'
  debugInfo.style.cssText = `
    position: absolute !important;
    bottom: 120px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    color: white !important;
    font-size: 14px !important;
    text-align: center !important;
  `
  debugInfo.innerHTML = `
    Point ${pointIndex + 1}/5: (${point.x}, ${point.y})<br>
    Screen: (${Math.round(point.x * window.innerWidth)}, ${Math.round(point.y * window.innerHeight)})
  `
  
  if (!debugInfo.parentElement) {
    calibrationOverlay.appendChild(debugInfo)
  }
}

function stopCalibration() {
  console.log('Stopping calibration...')
  isCalibrating = false
  currentCalibrationPoint = 0
  
  // Remove keyboard event handlers
  document.removeEventListener('keydown', handleCalibrationKeyPress)
  
  if (calibrationOverlay) {
    calibrationOverlay.remove()
    calibrationOverlay = null
  }
  
  // Remove calibration styles
  const styles = document.getElementById('calibration-styles')
  if (styles) {
    styles.remove()
  }
  
  // Exit fullscreen when calibration is cancelled
  if (document.exitFullscreen) {
    document.exitFullscreen()
  } else if ((document as any).mozCancelFullScreen) {
    (document as any).mozCancelFullScreen()
  } else if ((document as any).webkitExitFullscreen) {
    (document as any).webkitExitFullscreen()
  } else if ((document as any).msExitFullscreen) {
    (document as any).msExitFullscreen()
  }
  console.log('Calibration cancelled, exiting fullscreen')
  
  // Send stop message to background to update eye tracker state
  chrome.runtime.sendMessage({
    type: 'STOP_EYE_TRACKER_CALIBRATION'
  }).catch(error => {
    console.error('Failed to send calibration stop message:', error)
  })
}

// Listen for messages from background script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message.type)
  
  switch (message.type) {
    case 'START_RECORDING':
      startScreenRecording(message.projectId)
      sendResponse({ success: true })
      break
      
    case 'STOP_RECORDING':
      stopScreenRecording()
      sendResponse({ success: true })
      break
      
    case 'START_CALIBRATION':
      console.log('Starting calibration from content script')
      startCalibration()
      sendResponse({ success: true })
      break
      
    case 'PING':
      // Simple test message to verify content script is working
      console.log('Content script ping received')
      sendResponse({ success: true, location: window.location.href })
      break
      
    case 'TEST_CONNECTION':
      // Test data-io connection
      console.log('Testing data-io connection from content script')
      chrome.storage.sync.get(['selectedProject']).then(projectData => {
        const projectId = projectData.selectedProject?.id
        showConnectionTest(projectId)
        sendResponse({ success: true })
      })
      return true // Keep message channel open for async response
      break
      
    case 'STOP_CALIBRATION':
      stopCalibration()
      sendResponse({ success: true })
      break
      
    case 'CALIBRATION_PROGRESS':
      // message.current is nFinishedNum from eye tracker (1-based)
      console.log('Calibration progress - nFinishedNum:', message.current)
      
      if (message.current > 0 && message.current <= 5) {
        // Update progress counter
        const progressElement = document.getElementById('calibration-progress')
        if (progressElement) {
          progressElement.textContent = Math.min(message.current + 1, 5).toString()
        }
        
        if (message.current < 5) {
          // Show the next calibration point immediately
          console.log(`Point ${message.current} completed, showing next point ${message.current + 1}`)
          showCalibrationPoint(message.current) // This uses nFinishedNum as array index
          
          // HHProvider will wait 3 seconds before sending the next command
          // This gives the user time to move their gaze to the new point
        } else if (message.current === 5) {
          console.log('All 5 calibration points completed')
          // Remove the calibration point since we're done
          const existingPoint = document.getElementById('calibration-point')
          if (existingPoint) {
            existingPoint.remove()
          }
        }
      }
      break
      
    case 'CALIBRATION_COMPLETE':
      console.log('Calibration complete message received from background')
      
      // Update calibration state in storage for single source of truth
      chrome.storage.local.set({
        eyeTrackerCalibrated: true,
        calibrationTimestamp: Date.now()
      }, () => {
        console.log('Calibration state saved to storage: eyeTrackerCalibrated = true')
      })
      
      // Show completion message
      if (calibrationOverlay) {
        calibrationOverlay.innerHTML = `
          <div style="text-align: center; color: white;">
            <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
            <h2 style="font-size: 36px; margin-bottom: 20px;">Calibration Complete!</h2>
            <p style="font-size: 20px; color: #4CAF50;">Eye tracking is now calibrated and ready</p>
            <p style="font-size: 16px; color: #aaa; margin-top: 20px;">You can now start recording</p>
          </div>
        `
      }
      
      // Auto-enable gaze point overlay
      showGazePoint = true
      storage.set('showGazePoint', true)
      
      // Update gaze toggle button appearance
      const gazeToggleBtn = document.querySelector('#cogix-unified-overlay button[title="Toggle Gaze Point Overlay"]') as HTMLElement
      if (gazeToggleBtn) {
        gazeToggleBtn.style.background = '#10b981'
        const svg = gazeToggleBtn.querySelector('svg')
        if (svg) {
          svg.setAttribute('stroke', 'white')
        }
      }
      
      // Update the gaze indicator to show calibrated status
      const calibratedGazeIndicator = document.getElementById('cogix-gaze-indicator')
      if (calibratedGazeIndicator) {
        calibratedGazeIndicator.textContent = '👁️ Calibrated & tracking'
        calibratedGazeIndicator.style.color = '#10b981'
      }
      
      setTimeout(() => {
        stopCalibration()
        // Exit fullscreen after calibration
        if (document.exitFullscreen) {
          document.exitFullscreen()
        }
      }, 3000) // Show completion for 3 seconds
      break
      
    case 'GAZE_DATA':
      // Debug: Log gaze data reception occasionally
      if (Math.random() < 0.005) { // Log 0.5% of gaze data to avoid spam
        console.log('Gaze data received:', message.data.x.toFixed(1), message.data.y.toFixed(1), 'showGazePoint:', showGazePoint);
      }
      
      // Show gaze tracking indicator
      const gazeIndicator = document.getElementById('cogix-gaze-indicator');
      if (gazeIndicator) {
        gazeIndicator.style.display = 'block';
      }
      
      // Always update gaze point position if enabled
      updateGazePointPosition(message.data.x, message.data.y)
      
      // Store gaze data if recording
      if (isRecording && recordingStartTime) {
        gazeDataBuffer.push({
          timestamp: message.data.timestamp - recordingStartTime, // Relative to recording start
          x: message.data.x,
          y: message.data.y,
          confidence: message.data.confidence || 0.8
        })
      }
      break

    case 'UPLOAD_PROGRESS':
      // Handle progress updates from background script
      const { stage, progress, details } = message;
      console.log('📊 Upload progress update:', { stage, progress });
      
      showUploadProgress({
        stage: stage.includes('video') ? 'video_upload' :
               stage.includes('gaze') ? 'gaze_upload' :
               stage.includes('token') || stage.includes('auth') ? 'token' :
               stage.includes('submit') || stage.includes('session') ? 'session_submit' :
               stage.includes('complet') ? 'complete' : 'video_upload',
        progress: Math.round(progress),
        message: stage,
        sessionId: message.sessionId,
        videoProgress: details?.videoProgress,
        gazeProgress: details?.gazeProgress
      });
      break

    case 'PROJECT_SELECTED':
      // Handle immediate project selection from popup (no storage delay)
      const { project } = message;
      console.log('📡 Received immediate project selection:', project?.name);
      
      if (project) {
        // Update project display immediately
        const projectNameElement = document.querySelector('#cogix-unified-overlay .project-name');
        if (projectNameElement) {
          projectNameElement.textContent = project.name;
        }
        
        // Show success notification
        const successNotification = document.createElement('div');
        successNotification.style.cssText = `
          position: fixed !important;
          bottom: 20px !important;
          right: 20px !important;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
          color: white !important;
          padding: 12px 16px !important;
          border-radius: 8px !important;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif !important;
          font-size: 14px !important;
          z-index: 2147483647 !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
          animation: slideInFromBottom 0.3s ease-out !important;
        `;
        
        successNotification.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="font-size: 16px;">✅</div>
            <div>Project: ${project.name}</div>
          </div>
        `;
        
        document.body.appendChild(successNotification);
        
        // Auto-dismiss
        setTimeout(() => {
          if (document.body.contains(successNotification)) {
            successNotification.remove();
          }
        }, 3000);
      }
      break
      
    default:
      // Unknown message type
      break
  }
})

// Re-create overlay if it gets removed
const observer = new MutationObserver(() => {
  if (!document.getElementById('cogix-unified-overlay')) {
    createOverlay();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: false
});