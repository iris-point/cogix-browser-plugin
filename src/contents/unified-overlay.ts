import type { PlasmoCSConfig } from "plasmo"
import { Storage } from "@plasmohq/storage"

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
let gazeDataBuffer: Array<{
  timestamp: number
  x: number
  y: number
  leftEye?: any
  rightEye?: any
}> = []
let mediaRecorder: MediaRecorder | null = null
let recordedChunks: Blob[] = []
let currentStream: MediaStream | null = null

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
  const selectedProjectId = await storage.get('selectedProjectId');
  const selectedProjectName = await storage.get('selectedProjectName');
  const isRecording = await storage.get('isRecording') || false;

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
  projectName.textContent = selectedProjectName || 'No project selected';

  projectInfo.appendChild(projectLabel);
  projectInfo.appendChild(projectName);
  projectSection.appendChild(projectIcon);
  projectSection.appendChild(projectInfo);

  // Listen for project selection changes from storage
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.selectedProjectName) {
      const newName = changes.selectedProjectName.newValue;
      projectName.textContent = newName || 'No project selected';
      console.log('Project indicator updated:', newName);
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

  // Create gaze point visualization
  let gazePoint: HTMLElement | null = null;
  
  const createGazePoint = () => {
    if (gazePoint) return gazePoint;
    
    gazePoint = document.createElement('div');
    gazePoint.id = 'cogix-gaze-point';
    gazePoint.style.cssText = `
      position: fixed !important;
      width: 12px !important;
      height: 12px !important;
      border-radius: 50% !important;
      background: rgba(255, 0, 0, 0.7) !important;
      border: 2px solid rgba(255, 255, 255, 0.8) !important;
      pointer-events: none !important;
      z-index: 2147483646 !important;
      transform: translate(-50%, -50%) !important;
      transition: all 0.1s ease !important;
      display: none !important;
    `;
    document.body.appendChild(gazePoint);
    return gazePoint;
  };
  
  const updateGazePoint = (x: number, y: number) => {
    const point = createGazePoint();
    point.style.left = `${x}px`;
    point.style.top = `${y}px`;
    point.style.display = 'block';
  };
  
  const hideGazePoint = () => {
    if (gazePoint) {
      gazePoint.style.display = 'none';
    }
  };

  // Handle record button click
  recordButton.onclick = async () => {
    console.log('Record button clicked');
    
    // Check if project is selected
    const projectId = await storage.get('selectedProjectId');
    const projectName = await storage.get('selectedProjectName');
    
    if (!projectId || !projectName) {
      showAlert('Please select a project from the extension popup first', container);
      return;
    }
    
    // Check if eye tracker is connected
    const eyeTrackerConnected = await storage.get('eyeTrackerConnected');
    if (!eyeTrackerConnected) {
      showAlert('Please connect eye tracker from the extension popup first', container);
      return;
    }
    
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

  const sessionData = {
    id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    projectId,
    startTime: recordingStartTime,
    endTime: Date.now(),
    gazeData: gazeDataBuffer,
    metadata: {
      url: window.location.href,
      title: document.title,
      userAgent: navigator.userAgent,
      screenResolution: {
        width: screen.width,
        height: screen.height
      }
    }
  }

  // Save recording data (you might want to upload this to your backend)
  console.log('Recording session completed:', sessionData)
  console.log('Video blob size:', videoBlob.size, 'bytes')
  console.log('Gaze data points:', gazeDataBuffer.length)

  // For now, just log the data. In a real implementation, you would upload this
  // to your backend API along with the video file
  
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
  
  // Create full-screen calibration overlay
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
  
  // Add instructions
  const instructions = document.createElement('div')
  instructions.style.cssText = `
    position: absolute !important;
    top: 10% !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    text-align: center !important;
    font-size: 28px !important;
    font-weight: 500 !important;
  `
  instructions.innerHTML = `
    <h2 style="margin-bottom: 30px; font-size: 36px;">Eye Tracker Calibration</h2>
    <p style="margin-bottom: 20px;">Look at each point that appears and keep your head still</p>
    <p style="font-size: 24px; color: #4CAF50;">Point <span id="calibration-progress">1</span> of 5</p>
    <div style="margin-top: 40px; font-size: 18px; color: #aaa;">
      <p>Press <strong>ESC</strong> to cancel calibration</p>
      <p>Press <strong>SPACE</strong> to skip to next point</p>
    </div>
  `
  
  // Add cancel button in bottom center to avoid overlap with calibration points
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
  
  // Add hover effect
  cancelButton.onmouseover = () => {
    cancelButton.style.background = 'rgba(239, 68, 68, 1)'
    cancelButton.style.transform = 'translateX(-50%) translateY(-2px)'
  }
  cancelButton.onmouseout = () => {
    cancelButton.style.background = 'rgba(239, 68, 68, 0.9)'
    cancelButton.style.transform = 'translateX(-50%)'
  }
  
  calibrationOverlay.appendChild(instructions)
  calibrationOverlay.appendChild(cancelButton)
  document.body.appendChild(calibrationOverlay)
  
  // Add keyboard event handlers for calibration control
  document.addEventListener('keydown', handleCalibrationKeyPress)
  
  // Show first calibration point after a delay
  setTimeout(() => {
    showCalibrationPoint(0)
    
    // Send calibration start message to background to trigger eye tracker
    chrome.runtime.sendMessage({
      type: 'START_EYE_TRACKER_CALIBRATION'
    }).catch(error => {
      console.error('Failed to send calibration start message:', error)
    })
  }, 1000) // 1 second delay like the emotion experiment
}

function showCalibrationPoint(pointIndex: number) {
  if (!calibrationOverlay || pointIndex >= calibrationPoints.length) return
  
  // Remove existing point
  const existingPoint = document.getElementById('calibration-point')
  if (existingPoint) {
    existingPoint.remove()
  }
  
  const point = calibrationPoints[pointIndex]
  const pointElement = document.createElement('div')
  pointElement.id = 'calibration-point'
  pointElement.style.cssText = `
    position: absolute !important;
    width: 20px !important;
    height: 20px !important;
    border-radius: 50% !important;
    background: #4CAF50 !important;
    border: 3px solid white !important;
    box-shadow: 0 0 20px rgba(76, 175, 80, 0.6) !important;
    transform: translate(-50%, -50%) !important;
    left: ${point.x * 100}% !important;
    top: ${point.y * 100}% !important;
    animation: calibrationPulse 1s infinite alternate !important;
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
  
  // Exit fullscreen (optional - user can stay in fullscreen if they want)
  try {
    if (document.fullscreenElement) {
      document.exitFullscreen()
      console.log('Exited fullscreen mode')
    }
  } catch (error) {
    console.warn('Could not exit fullscreen:', error)
  }
  
  // Send stop message to background
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
      
    case 'STOP_CALIBRATION':
      stopCalibration()
      sendResponse({ success: true })
      break
      
    case 'CALIBRATION_PROGRESS':
      // Handle calibration progress from eye tracker
      if (message.current < 5) {
        showCalibrationPoint(message.current)
      }
      break
      
    case 'CALIBRATION_COMPLETE':
      // Calibration finished
      setTimeout(() => {
        stopCalibration()
      }, 2000) // Show completion for 2 seconds
      break
      
    case 'GAZE_DATA':
      // Store gaze data if recording
      if (isRecording && recordingStartTime) {
        gazeDataBuffer.push({
          timestamp: message.data.timestamp - recordingStartTime, // Relative to recording start
          x: message.data.x,
          y: message.data.y,
          leftEye: message.data.leftEye,
          rightEye: message.data.rightEye
        })
        
        // Show gaze point visualization during recording
        const gazePointElement = document.getElementById('cogix-gaze-point')
        if (gazePointElement) {
          gazePointElement.style.left = `${message.data.x}px`
          gazePointElement.style.top = `${message.data.y}px`
          gazePointElement.style.display = 'block'
        }
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