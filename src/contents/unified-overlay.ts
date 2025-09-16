/**
 * FIXED: Unified Overlay Content Script
 * This content script creates an overlay UI for the browser extension
 * 
 * FIXES:
 * 1. Calibration automatically starts tracking and gaze visualization
 * 2. Screen recording permission prompt works correctly
 * 3. Recording state is properly managed
 * 4. Data is collected and uploaded to data-io
 */

import { validateProjectSelection } from '../lib/projectValidation'
import { eyeTrackerState } from '../lib/eyeTrackerState'
import { eventTracker, UserEvent, TimelineEvent } from '../lib/eventTracker'

// ============================================================================
// State Management
// ============================================================================

let isRecording = false
let isPaused = false
let mediaRecorder: MediaRecorder | null = null
let currentStream: MediaStream | null = null
let recordedChunks: Blob[] = []
let gazeDataBuffer: any[] = []
let eventDataBuffer: TimelineEvent[] = []
let recordingStartTime: number | null = null
let recordingSessionId: string | null = null
let recordingProjectId: string | null = null // Store project ID globally
let showGazePoint = true
let gazeOverlayElement: HTMLElement | null = null
let isCalibrating = false
let calibrationUI: HTMLElement | null = null
let uploadProgressUI: HTMLElement | null = null
let currentUploadId: string | null = null
let isUploading = false

// Global recording state synced with background
let globalRecordingState: any = null

// Initialize by getting recording state from background
chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' }, (response) => {
  if (response?.success && response.state) {
    globalRecordingState = response.state
    if (globalRecordingState.isRecording) {
      // Restore recording UI if a recording is active
      console.log('🎬 Restoring active recording session:', globalRecordingState)
      restoreRecordingSession(globalRecordingState)
    }
  }
})

// ============================================================================
// Recording Session Restoration (for tab switching)
// ============================================================================

function restoreRecordingSession(state: any) {
  if (!state.isRecording) return

  console.log('🔄 Restoring recording session from global state:', state)

  // Restore recording state
  isRecording = true
  recordingStartTime = state.recordingStartTime
  recordingSessionId = state.sessionId
  recordingProjectId = state.projectId // Store project ID globally

  // Restore gaze data buffer from global state
  gazeDataBuffer = [...(state.gazeDataBuffer || [])]

  // Note: We don't restart MediaRecorder here since each tab records its own content
  // This is intentional - like Loom, we maintain recording state but each tab records separately

  // Update UI to show recording indicator
  const overlay = document.getElementById('cogix-overlay-container')
  if (overlay) {
    // Update recording button
    const recordBtn = overlay.querySelector('#cogix-record-btn') as HTMLButtonElement
    if (recordBtn) {
      recordBtn.textContent = '⏹️'
      recordBtn.title = 'Stop Recording'
      recordBtn.style.background = 'linear-gradient(135deg, #FF6B35 0%, #FF8A65 100%)'
    }

    // Show recording indicator - Orange theme
    let recordingIndicator = overlay.querySelector('#cogix-recording-indicator') as HTMLElement
    if (!recordingIndicator) {
      recordingIndicator = document.createElement('div')
      recordingIndicator.id = 'cogix-recording-indicator'
      recordingIndicator.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #FF6B35 0%, #FF8A65 100%);
        color: white;
        padding: 10px 20px;
        border-radius: 24px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
        font-weight: 500;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 4px 16px rgba(255, 107, 53, 0.3), 0 2px 8px rgba(0,0,0,0.1);
      `
      document.body.appendChild(recordingIndicator)
    }

    // Update recording time
    const elapsed = Date.now() - recordingStartTime
    const minutes = Math.floor(elapsed / 60000)
    const seconds = Math.floor((elapsed % 60000) / 1000)
    recordingIndicator.innerHTML = `
      <span style="display: inline-block; width: 10px; height: 10px; background: white; border-radius: 50%; animation: pulse 1.5s infinite;"></span>
      <span>Recording: ${state.projectId || 'Session'}</span>
      <span style="font-weight: 700;">${minutes}:${seconds.toString().padStart(2, '0')}</span>
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.9); }
        }
      </style>
    `
  }

  console.log('✅ Recording session restored:', {
    sessionId: recordingSessionId,
    elapsed: Date.now() - recordingStartTime,
    gazePoints: gazeDataBuffer.length
  })
}

function handleRecordingStop() {
  console.log('🛑 Handling recording stop, mediaRecorder state:', mediaRecorder?.state)

  isRecording = false

  // Clean up UI
  const recordingIndicator = document.getElementById('cogix-recording-indicator')
  if (recordingIndicator) {
    recordingIndicator.remove()
  }

  // Update button
  const overlay = document.getElementById('cogix-overlay-container')
  if (overlay) {
    const recordBtn = overlay.querySelector('#cogix-record-btn') as HTMLButtonElement
    if (recordBtn) {
      recordBtn.textContent = '⏺️'
      recordBtn.title = 'Start Recording'
      recordBtn.style.background = 'linear-gradient(135deg, #FF6B35 0%, #FF8A65 100%)'
    }
  }

  // Stop media recorder if active
  // This will trigger the onstop handler which calls finalizeRecording
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    console.log('⏹️ Stopping MediaRecorder, will trigger finalization')
    mediaRecorder.stop()
  } else {
    console.log('ℹ️ MediaRecorder not active or not present on this tab')
  }
}

// ============================================================================
// Main Overlay Creation
// ============================================================================

function createOverlay() {
  // Remove any existing overlay
  const existingOverlay = document.getElementById('cogix-overlay-container')
  if (existingOverlay) {
    existingOverlay.remove()
  }

  // Create container
  const container = document.createElement('div')
  container.id = 'cogix-overlay-container'
  container.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-end;
  `

  // Create main overlay panel - White and Orange theme
  const overlay = document.createElement('div')
  overlay.id = 'cogix-overlay'
  overlay.style.cssText = `
    background: rgba(255, 255, 255, 0.98);
    border: 2px solid #FF6B35;
    border-radius: 16px;
    padding: 18px;
    color: #333333;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 32px rgba(255, 107, 53, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1);
    min-width: 260px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform-origin: bottom right;
  `

  // Create status display - Orange accent
  const statusDisplay = document.createElement('div')
  statusDisplay.id = 'cogix-status'
  statusDisplay.style.cssText = `
    margin-bottom: 12px;
    padding: 10px;
    background: linear-gradient(135deg, rgba(255, 107, 53, 0.08) 0%, rgba(255, 138, 101, 0.05) 100%);
    border: 1px solid rgba(255, 107, 53, 0.2);
    border-radius: 10px;
    text-align: center;
    transition: opacity 0.3s ease;
  `
  statusDisplay.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 6px; color: #FF6B35;">Eye Tracker Status</div>
    <div id="cogix-connection-status" style="font-size: 12px; color: #666;">Checking...</div>
    <div id="cogix-calibration-status" style="font-size: 12px; margin-top: 4px; color: #666;"></div>
  `

  // Create control buttons
  const controls = document.createElement('div')
  controls.id = 'cogix-controls'
  controls.style.cssText = `
    display: flex;
    gap: 8px;
    margin-top: 10px;
    transition: opacity 0.3s ease;
  `

  // Record button - Orange primary
  const recordButton = document.createElement('button')
  recordButton.id = 'cogix-record-btn'
  recordButton.style.cssText = `
    flex: 1;
    padding: 10px 14px;
    background: linear-gradient(135deg, #FF6B35 0%, #FF8A65 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
  `
  recordButton.textContent = '⏺ Start Recording'
  recordButton.onmouseover = () => {
    recordButton.style.transform = 'translateY(-1px)'
    recordButton.style.boxShadow = '0 4px 12px rgba(255, 107, 53, 0.4)'
  }
  recordButton.onmouseout = () => {
    recordButton.style.transform = 'translateY(0)'
    recordButton.style.boxShadow = '0 2px 8px rgba(255, 107, 53, 0.3)'
  }

  // Gaze toggle button - White with orange border
  const gazeToggleButton = document.createElement('button')
  gazeToggleButton.id = 'cogix-gaze-toggle'
  gazeToggleButton.style.cssText = `
    padding: 10px 14px;
    background: white;
    color: #FF6B35;
    border: 2px solid #FF6B35;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  `

  const updateGazeToggleButton = () => {
    gazeToggleButton.textContent = showGazePoint ? '👁️' : '👁️‍🗨️'
    if (showGazePoint) {
      gazeToggleButton.style.background = 'linear-gradient(135deg, #FF6B35 0%, #FF8A65 100%)'
      gazeToggleButton.style.color = 'white'
      gazeToggleButton.style.border = '2px solid transparent'
    } else {
      gazeToggleButton.style.background = 'white'
      gazeToggleButton.style.color = '#FF6B35'
      gazeToggleButton.style.border = '2px solid #FF6B35'
    }
    gazeToggleButton.title = showGazePoint ? 'Hide gaze point' : 'Show gaze point'
  }

  controls.appendChild(recordButton)
  controls.appendChild(gazeToggleButton)

  overlay.appendChild(statusDisplay)
  overlay.appendChild(controls)
  container.appendChild(overlay)

  // Create state display (for debugging) - HIDDEN BY DEFAULT - Orange theme
  const stateDisplay = document.createElement('div')
  stateDisplay.id = 'cogix-state-display'
  stateDisplay.style.cssText = `
    background: rgba(255, 255, 255, 0.95);
    border: 2px solid #FF6B35;
    border-radius: 10px;
    padding: 12px;
    color: #333;
    font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
    font-size: 11px;
    max-width: 250px;
    display: none; /* Hidden by default - can be toggled with keyboard shortcut */
    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.2);
  `
  stateDisplay.innerHTML = `
    <div style="margin-bottom: 8px; color: #FF6B35; font-weight: bold; font-size: 12px;">🔧 State Monitor</div>
    <div style="margin: 4px 0;">Status: <span id="cogix-status-text" style="color: #FF6B35; font-weight: 600;">Loading...</span></div>
    <div style="margin: 4px 0;">Connected: <span id="cogix-connected-text" style="color: #666;">false</span></div>
    <div style="margin: 4px 0;">Calibrated: <span id="cogix-calibrated-text" style="color: #666;">false</span></div>
    <div style="margin: 4px 0;">Tracking: <span id="cogix-tracking-text" style="color: #666;">false</span></div>
    <div style="margin: 4px 0;">Recording: <span id="cogix-recording-text" style="color: #666;">false</span></div>
    <div style="margin: 4px 0;">Gaze Points: <span id="cogix-gaze-count" style="color: #FF6B35; font-weight: 600;">0</span></div>
  `
  container.appendChild(stateDisplay)

  // Add keyboard shortcut to toggle state monitor (Ctrl+Shift+D for Debug)
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      stateDisplay.style.display = stateDisplay.style.display === 'none' ? 'block' : 'none'
    }
  })

  document.body.appendChild(container)

  // Create minimal recording indicator (hidden by default)
  const minimalIndicator = document.createElement('div')
  minimalIndicator.id = 'cogix-minimal-indicator'
  minimalIndicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #FF6B35 0%, #FF8A65 100%);
    border-radius: 50%;
    display: none;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.4);
    z-index: 2147483647;
    animation: pulse 2s infinite;
    transition: all 0.3s ease;
    opacity: 0;
    transform: scale(0.8);
  `
  minimalIndicator.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    </svg>
  `
  minimalIndicator.title = 'Stop Recording'
  minimalIndicator.onclick = () => stopRecording()
  document.body.appendChild(minimalIndicator)

  // Add pulse animation styles
  const style = document.createElement('style')
  style.textContent = `
    @keyframes pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(255, 107, 53, 0.7);
      }
      70% {
        box-shadow: 0 0 0 20px rgba(255, 107, 53, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(255, 107, 53, 0);
      }
    }
    
    /* Hide Chrome's screen sharing notification bar */
    .goog-shadow-notification-bar {
      display: none !important;
    }
    
    /* Additional selectors for Chrome's sharing indicator */
    [aria-label*="sharing your screen"],
    [aria-label*="sharing this tab"],
    [aria-label*="sharing a window"] {
      display: none !important;
    }
  `
  document.head.appendChild(style)

  // ============================================================================
  // Event Handlers
  // ============================================================================

  // Toggle gaze visualization
  gazeToggleButton.onclick = () => {
    showGazePoint = !showGazePoint
    chrome.storage.local.set({ showGazePoint })
    updateGazeToggleButton()
    
    if (!showGazePoint && gazeOverlayElement) {
      gazeOverlayElement.style.display = 'none'
    } else if (showGazePoint && gazeOverlayElement) {
      gazeOverlayElement.style.display = 'block'
    }
    
    console.log('Gaze point overlay toggled:', showGazePoint)
  }
  
  updateGazeToggleButton()

  // Handle record button click
  recordButton.onclick = async () => {
    console.log('Record button clicked, current state:', { isRecording })
    
    if (!isRecording) {
      // Validate project selection
      try {
        const project = await validateProjectSelection()
        console.log('✅ Project validated:', project.name)
      } catch (error) {
        console.error('❌ Project validation failed:', error)
        return
      }
      
      // Check eye tracker state
      const state = await eyeTrackerState.getStateAsync()
      console.log('Eye tracker state before recording:', state)
      
      if (!state.isConnected) {
        alert('Please connect the eye tracker first')
        return
      }
      
      if (!state.isCalibrated && !state.isTracking) {
        alert('Please calibrate the eye tracker before recording')
        return
      }
      
      // Get project info
      const projectData = await chrome.storage.sync.get(['selectedProject'])
      const projectId = projectData.selectedProject?.id

      console.log('📌 Selected project data:', projectData.selectedProject)

      if (!projectId) {
        console.error('❌ No project selected:', projectData)
        alert('Please select a project first. Go to the extension popup to select a project.')
        return
      }

      console.log('✅ Starting recording with project ID:', projectId)
      
      // Start recording
      await startRecording(projectId)
    } else {
      // Stop recording
      await stopRecording()
    }
  }

  // Update status periodically
  updateStatus()
  setInterval(updateStatus, 1000)
}

// ============================================================================
// UI Transition Functions
// ============================================================================

function transitionToMinimalUI() {
  const overlay = document.getElementById('cogix-overlay')
  const container = document.getElementById('cogix-overlay-container')
  const minimalIndicator = document.getElementById('cogix-minimal-indicator')
  
  if (overlay && container) {
    // Fade out the main overlay
    overlay.style.opacity = '0'
    overlay.style.transform = 'scale(0.8)'
    
    setTimeout(() => {
      container.style.display = 'none'
      
      // Show minimal indicator
      if (minimalIndicator) {
        minimalIndicator.style.display = 'flex'
        requestAnimationFrame(() => {
          minimalIndicator.style.opacity = '1'
          minimalIndicator.style.transform = 'scale(1)'
        })
      }
    }, 300)
  }
  
  // Attempt to hide Chrome's screen sharing bar
  hideChromeSharingBar()
}

function transitionToNormalUI() {
  const overlay = document.getElementById('cogix-overlay')
  const container = document.getElementById('cogix-overlay-container')
  const minimalIndicator = document.getElementById('cogix-minimal-indicator')
  
  if (minimalIndicator) {
    minimalIndicator.style.opacity = '0'
    minimalIndicator.style.transform = 'scale(0.8)'
    
    setTimeout(() => {
      minimalIndicator.style.display = 'none'
      
      // Show main overlay
      if (container && overlay) {
        container.style.display = 'flex'
        requestAnimationFrame(() => {
          overlay.style.opacity = '1'
          overlay.style.transform = 'scale(1)'
        })
      }
    }, 300)
  }
}

function hideChromeSharingBar() {
  // Try multiple methods to hide Chrome's sharing notification
  
  // Method 1: Find and hide by common class names
  const selectors = [
    '.goog-shadow-notification-bar',
    '[role="alert"]',
    '[aria-label*="sharing"]',
    '[aria-label*="screen"]',
    '[aria-label*="tab"]',
    '[aria-label*="window"]'
  ]
  
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector)
    elements.forEach(el => {
      if (el instanceof HTMLElement) {
        const text = el.textContent?.toLowerCase() || ''
        const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || ''
        if (text.includes('sharing') || ariaLabel.includes('sharing')) {
          el.style.display = 'none'
          el.style.visibility = 'hidden'
        }
      }
    })
  })
  
  // Method 2: Monitor for new elements
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          const text = node.textContent?.toLowerCase() || ''
          const ariaLabel = node.getAttribute('aria-label')?.toLowerCase() || ''
          if ((text.includes('sharing') && text.includes('screen')) ||
              (ariaLabel.includes('sharing') && ariaLabel.includes('screen'))) {
            node.style.display = 'none'
            node.style.visibility = 'hidden'
          }
        }
      })
    })
  })
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
  
  // Stop observing after 10 seconds
  setTimeout(() => observer.disconnect(), 10000)
}

// ============================================================================
// Screen Resolution Helpers
// ============================================================================

/**
 * Get the actual screen resolution, accounting for device pixel ratio
 * and multi-monitor setups
 */
function getActualScreenResolution() {
  // Get the base screen dimensions
  const baseWidth = window.screen.width
  const baseHeight = window.screen.height
  
  // Get available screen dimensions (excludes taskbar/dock)
  const availWidth = window.screen.availWidth
  const availHeight = window.screen.availHeight
  
  // Get device pixel ratio for high-DPI displays
  const pixelRatio = window.devicePixelRatio || 1
  
  // For actual physical resolution, multiply by pixel ratio
  // But for recording and gaze tracking, we typically want logical pixels
  const logicalWidth = baseWidth
  const logicalHeight = baseHeight
  
  // Get viewport dimensions for reference
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  console.log('📐 Screen dimensions:', {
    screen: { width: baseWidth, height: baseHeight },
    available: { width: availWidth, height: availHeight },
    viewport: { width: viewportWidth, height: viewportHeight },
    pixelRatio,
    physical: { width: baseWidth * pixelRatio, height: baseHeight * pixelRatio }
  })
  
  return {
    width: logicalWidth,
    height: logicalHeight,
    availWidth,
    availHeight,
    viewportWidth,
    viewportHeight,
    pixelRatio,
    physicalWidth: logicalWidth * pixelRatio,
    physicalHeight: logicalHeight * pixelRatio
  }
}

// ============================================================================
// Recording Functions
// ============================================================================

async function startRecording(projectId: string) {
  // Store project ID globally for use in finalization
  recordingProjectId = projectId

  if (isRecording) {
    console.log('Already recording')
    return
  }

  try {
    console.log('🎬 Starting recording for project:', projectId)
    
    // Request screen capture permission through background script
    console.log('📺 Requesting screen capture permission...')
    let response;
    try {
      response = await chrome.runtime.sendMessage({
        type: 'REQUEST_SCREEN_CAPTURE',
        sources: ['screen', 'window', 'tab']
      })
      console.log('📺 Screen capture response:', response)
    } catch (error) {
      console.error('Failed to request screen capture:', error)
      showNotification('Failed to request screen recording permission. Please try again.', 'error')
      return
    }

    if (!response || !response.streamId) {
      console.error('Screen capture permission denied or cancelled', response)
      showNotification('Screen recording permission was denied or cancelled. Please grant permission when prompted.', 'error')
      return
    }

    console.log('✅ Screen capture permission granted, streamId:', response.streamId)

    // Get media stream with the streamId
    try {
      currentStream = await navigator.mediaDevices.getUserMedia({
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: response.streamId,
            maxWidth: 1920,
            maxHeight: 1080,
            maxFrameRate: 30
          }
        } as any,
        audio: false
      })
      console.log('✅ Media stream obtained successfully')
    } catch (error) {
      console.error('Failed to get media stream with streamId:', error)
      showNotification('Failed to capture screen. Please make sure you selected a screen to record.', 'error')
      
      // Clean up
      chrome.storage.local.remove(['lastStreamId', 'lastStreamTimestamp'])
      return
    }

    console.log('📹 Media stream obtained')

    // Set up MediaRecorder
    const mimeType = getSupportedMimeType()
    mediaRecorder = new MediaRecorder(currentStream, {
      mimeType,
      videoBitsPerSecond: 2500000
    })

    recordedChunks = []
    gazeDataBuffer = []
    eventDataBuffer = []
    gazeSmoothing.reset() // Reset smoothing filter for new recording
    recordingStartTime = Date.now()
    recordingSessionId = generateSessionId()

    // Start event tracking
    eventTracker.startTracking(recordingStartTime)
    
    // Ensure eye tracking is active for synchronized recording
    const state = await eyeTrackerState.getStateAsync()
    if (state.isCalibrated && !state.isTracking) {
      console.log('🎯 Starting eye tracking for synchronized recording')
      await chrome.runtime.sendMessage({ type: 'START_EYE_TRACKING' })
      
      // Also ensure gaze visualization is on
      if (!showGazePoint) {
        showGazePoint = true
        chrome.storage.local.set({ showGazePoint: true })
        console.log('👁️ Enabled gaze visualization for recording')
      }
    }

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data)
        console.log('📦 Video chunk recorded, size:', event.data.size)
      }
    }

    mediaRecorder.onstop = async () => {
      console.log('🛑 MediaRecorder stopped, finalizing...')
      // Use stored project ID which persists across tab switches
      await finalizeRecording(recordingProjectId || projectId)
    }

    // Start recording - synchronized with eye tracking
    mediaRecorder.start(1000) // Collect data every second
    isRecording = true
    
    console.log(`🎬 Recording started at ${new Date(recordingStartTime).toLocaleTimeString()}`)
    console.log(`📍 Eye tracking active: ${state.isTracking}, Gaze collection started`)
    
    // Update UI
    const recordButton = document.getElementById('cogix-record-btn') as HTMLButtonElement
    if (recordButton) {
      recordButton.textContent = '⏹️ Stop Recording'
      recordButton.style.background = '#27ae60'
    }
    
    // Update state display
    updateRecordingState(true)
    
    // Transition to minimal UI after a short delay
    setTimeout(() => {
      transitionToMinimalUI()
    }, 1500) // Give user time to see the recording started
    
    // Notify background script
    await chrome.runtime.sendMessage({
      type: 'RECORDING_STARTED',
      projectId,
      sessionId: recordingSessionId,
      timestamp: recordingStartTime
    })
    
    console.log('✅ Recording and eye tracking synchronized successfully')
    
  } catch (error) {
    console.error('❌ Failed to start recording:', error)
    alert('Failed to start recording: ' + error.message)
    isRecording = false
  }
}

async function stopRecording() {
  if (!isRecording || !mediaRecorder) {
    console.log('Not recording')
    return
  }

  console.log('⏹️ Stopping recording...')
  
  // Stop event tracking
  eventTracker.stopTracking()
  const timelineEvents = eventTracker.getTimelineEvents()
  eventDataBuffer.push(...timelineEvents)
  console.log('📝 Event tracking stopped, captured', timelineEvents.length, 'events')

  // Stop media recorder
  mediaRecorder.stop()
  
  // Stop all tracks
  if (currentStream) {
    currentStream.getTracks().forEach(track => {
      track.stop()
      console.log('🛑 Stopped track:', track.kind)
    })
    currentStream = null
  }
  
  isRecording = false
  
  // Transition back to normal UI
  transitionToNormalUI()
  
  // Update UI after transition
  setTimeout(() => {
    const recordButton = document.getElementById('cogix-record-btn') as HTMLButtonElement
    if (recordButton) {
      recordButton.textContent = '🔴 Start Recording'
      recordButton.style.background = '#e74c3c'
    }
    
    // Update state display
    updateRecordingState(false)
  }, 350)
  
  console.log('✅ Recording stopped')
}

async function finalizeRecording(projectId?: string) {
  // Use stored project ID if not provided
  const effectiveProjectId = projectId || recordingProjectId

  if (!effectiveProjectId) {
    console.error('❌ No project ID available for upload')
    showNotification('Failed to upload: No project selected', 'error')
    return
  }

  if (!recordingSessionId || recordedChunks.length === 0) {
    console.error('No recording data to finalize')
    return
  }

  const sessionId = recordingSessionId
  const duration = Date.now() - (recordingStartTime || Date.now())
  
  console.log('📤 Finalizing recording:', {
    sessionId,
    projectId: effectiveProjectId,
    duration: duration / 1000 + 's',
    chunks: recordedChunks.length,
    gazePoints: gazeDataBuffer.length,
    events: eventDataBuffer.length
  })

  try {
    // Create video blob
    const videoBlob = new Blob(recordedChunks, { type: getSupportedMimeType() })
    console.log('🎥 Video blob created, size:', videoBlob.size)

    // Extract video duration from the actual video file
    let videoDuration: number
    try {
      videoDuration = await getVideoDuration(videoBlob)
      console.log('⏱️ Video duration extracted:', videoDuration, 'seconds')
    } catch (error) {
      console.warn('⚠️ Failed to extract video duration, using calculated fallback:', error.message)
      videoDuration = getFallbackDuration(recordingStartTime || Date.now() - duration, Date.now())
    }

    // Get actual screen resolution
    const screenInfo = getActualScreenResolution()
    
    // Prepare metadata with accurate video duration and screen info
    const metadata = {
      duration: videoDuration, // Use extracted duration instead of calculated
      calculatedDuration: duration / 1000, // Keep calculated for comparison
      actualDuration: videoDuration, // Explicit field for actual video duration
      url: window.location.href,
      title: document.title,
      userAgent: navigator.userAgent,
      screen_width: screenInfo.width,  // Actual screen width
      screen_height: screenInfo.height, // Actual screen height
      available_width: screenInfo.availWidth,
      available_height: screenInfo.availHeight,
      viewport_width: screenInfo.viewportWidth,
      viewport_height: screenInfo.viewportHeight,
      pixel_ratio: screenInfo.pixelRatio,
      physical_width: screenInfo.physicalWidth,
      physical_height: screenInfo.physicalHeight,
      gazePointsCount: gazeDataBuffer.length,
      eventCount: eventDataBuffer.length,
      videoSize: videoBlob.size,
      codec: getSupportedMimeType(),
      hasValidDuration: videoDuration > 0
    }

    // Check if this session was already uploaded (in case of duplicate attempts)
    const isAlreadyUploaded = await checkIfSessionUploaded(sessionId)
    if (isAlreadyUploaded) {
      console.log('⚠️ Session already uploaded, skipping duplicate:', sessionId)
      showNotification('This recording was already uploaded successfully', 'info')
      
      // Clean up local data
      recordedChunks = []
      gazeDataBuffer = []
      eventDataBuffer = []
    gazeSmoothing.reset() // Reset smoothing filter for new recording
      recordingStartTime = null
      recordingSessionId = null
      return
    }
    
    // Generate upload ID
    currentUploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Save only metadata to local storage (not the video to avoid quota issues)
    const uploadMetadata = {
      uploadId: currentUploadId,
      projectId: effectiveProjectId,
      sessionId,
      videoBlobSize: videoBlob.size,
      gazeDataCount: gazeDataBuffer.length,
      eventDataCount: eventDataBuffer.length,
      metadata,
      screenDimensions: {
        width: screenInfo.width,
        height: screenInfo.height
      },
      timestamp: Date.now(),
      status: 'pending'
    }
    
    // Save metadata only for tracking
    await saveUploadMetadata(uploadMetadata)
    
    // Show upload progress UI
    showUploadProgress(uploadMetadata)
    
    // Show duration extraction progress
    updateUploadProgress(45, 'uploading', `Extracting video duration (${videoDuration.toFixed(1)}s)...`)
    
    console.log('📡 Starting upload via background script (avoids CORS)...')
    
    const videoSizeMB = (videoBlob.size / 1024 / 1024).toFixed(1)
    console.log(`📤 Video size: ${videoSizeMB}MB`)
    
    try {
      // For videos, we need to use a blob URL that the background script can fetch
      // Create a blob URL that can be accessed by the background script
      const blobUrl = URL.createObjectURL(videoBlob)
      console.log('📎 Created blob URL for video:', blobUrl)
      
      // Send the blob URL to background script
      console.log('📨 Sending upload request to background with project ID:', effectiveProjectId)
      const result = await chrome.runtime.sendMessage({
        type: 'DATA_IO_UPLOAD_SESSION_BLOB_URL',
        uploadId: currentUploadId,
        projectId: effectiveProjectId,
        sessionId,
        videoBlobUrl: blobUrl,
        videoBlobSize: videoBlob.size,
        gazeData: gazeDataBuffer,
        eventData: eventDataBuffer,
        metadata,
        screenDimensions: {
          width: screen.width,
          height: screen.height
        }
      })
      
      // Clean up blob URL after upload
      URL.revokeObjectURL(blobUrl)
      
      if (!result.success) {
        throw new Error(result.error || 'Upload failed')
      }
      
      console.log('✅ Upload successful!')
      
    } catch (error) {
      console.error('❌ Upload failed:', error)
      throw error // Re-throw the original error
    }
    
    console.log('✅ Upload successful!')
    updateUploadProgress(100, 'completed', 'Upload successful!')
    
    // Mark as uploaded
    await markUploadAsCompleted(currentUploadId, sessionId)
    await removeUploadFromStorage(currentUploadId)
    
    // Hide progress UI after 3 seconds
    setTimeout(() => {
      hideUploadProgress()
    }, 3000)
    
  } catch (error) {
    console.error('❌ Failed to upload recording:', error)
    updateUploadProgress(0, 'failed', `Upload failed: ${error.message}`)
    
    // Mark as failed in storage but keep for retry
    await markUploadAsFailed(currentUploadId, error.message)
    
    // Show retry button
    showRetryButton()
  }
  
  // Clean up
  recordedChunks = []
  gazeDataBuffer = []
  eventDataBuffer = []
  recordingStartTime = null
  recordingSessionId = null
}

// ============================================================================
// IndexedDB Helpers for Large Video Transfer
// ============================================================================

async function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Increment version to 2 to ensure upgrade happens
    const request = indexedDB.open('CogixVideoDB', 2)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      
      // Delete old object stores if they exist (clean slate)
      const storesToDelete = ['videos', 'uploads', 'recordings']
      for (const storeName of storesToDelete) {
        if (db.objectStoreNames.contains(storeName)) {
          db.deleteObjectStore(storeName)
        }
      }
      
      // Create the videos object store
      if (!db.objectStoreNames.contains('videos')) {
        db.createObjectStore('videos', { keyPath: 'id' })
        console.log('📦 Created videos object store in IndexedDB')
      }
    }
  })
}

async function storeVideoInIndexedDB(db: IDBDatabase, id: string, blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['videos'], 'readwrite')
    const store = transaction.objectStore('videos')
    const data = { id, blob, timestamp: Date.now() }
    const request = store.put(data)
    
    request.onsuccess = () => {
      console.log('✅ Video stored in IndexedDB object store with ID:', id)
    }
    request.onerror = () => {
      console.error('❌ Failed to store video in IndexedDB:', request.error)
      reject(request.error)
    }
    
    // Wait for transaction to complete
    transaction.oncomplete = () => {
      console.log('✅ IndexedDB transaction completed successfully')
      resolve()
    }
    transaction.onerror = () => {
      console.error('❌ IndexedDB transaction failed:', transaction.error)
      reject(transaction.error)
    }
  })
}

async function deleteVideoFromIndexedDB(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['videos'], 'readwrite')
    const store = transaction.objectStore('videos')
    const request = store.delete(id)
    
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// ============================================================================
// Eye Tracking Integration
// ============================================================================

// Listen for messages from background and other sources
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'RECORDING_STATE_UPDATE':
      // Update from background about global recording state
      globalRecordingState = message.state
      if (globalRecordingState.isRecording && !isRecording) {
        // Another tab started recording or we're restoring state
        console.log('📺 Recording state update - restoring UI')
        restoreRecordingSession(globalRecordingState)
      } else if (!globalRecordingState.isRecording && isRecording) {
        // Recording was stopped globally
        console.log('🛑 Recording stopped globally')
        handleRecordingStop()

        // Clear stored project ID
        recordingProjectId = null
      }
      break

    case 'GAZE_DATA':
      handleGazeData(message.data)
      // Also send to background for global buffer
      if (isRecording && globalRecordingState?.isRecording) {
        chrome.runtime.sendMessage({
          type: 'ADD_GAZE_DATA',
          gazeData: message.data
        })
      }
      break

    case 'EYE_TRACKER_STATUS':
      updateEyeTrackerStatus(message)
      break
      
    case 'CALIBRATION_COMPLETE':
      handleCalibrationComplete(message.result)
      break
      
    case 'START_CALIBRATION':
      startCalibration()
      sendResponse({ success: true })
      break
      
    case 'CALIBRATION_POINT':
      showCalibrationPoint(message.point)
      break
      
    case 'CALIBRATION_CANCELLED':
      hideCalibration()
      break
      
    case 'UPLOAD_PROGRESS':
      // Handle upload progress updates from background script
      if (message.uploadId === currentUploadId) {
        updateUploadProgress(message.percent, 'uploading', message.message)
      }
      break
      
    case 'UPLOAD_PROGRESS_DETAIL':
      // Log detailed progress for debugging
      console.log('📊 Upload progress:', message)
      break
  }
})

// Smoothing filter for gaze data
const gazeSmoothing = {
  // Buffer for moving average filter (stores last N points)
  buffer: [] as Array<{x: number, y: number}>,
  bufferSize: 5, // Number of points to average (adjustable)

  // Grid-based stabilization (similar to eyeTraceWebV2.2)
  gridDivisions: 5, // 5x5 grid
  gridStabilization: true, // Enable/disable grid snapping
  gridThreshold: 0.02, // Threshold for grid snapping (2% of screen)

  // Kalman filter state (for advanced smoothing)
  kalmanX: { estimate: 0, errorEstimate: 1 },
  kalmanY: { estimate: 0, errorEstimate: 1 },
  kalmanQ: 0.001, // Process noise
  kalmanR: 0.01,  // Measurement noise

  // Add point and get smoothed result
  addPoint(x: number, y: number): {x: number, y: number} {
    // Add to buffer
    this.buffer.push({x, y})
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift()
    }

    // Apply moving average
    let avgX = this.buffer.reduce((sum, p) => sum + p.x, 0) / this.buffer.length
    let avgY = this.buffer.reduce((sum, p) => sum + p.y, 0) / this.buffer.length

    // Apply Kalman filter for extra smoothness
    avgX = this.applyKalman(avgX, this.kalmanX)
    avgY = this.applyKalman(avgY, this.kalmanY)

    // Apply grid stabilization if enabled (like eyeTraceWebV2.2)
    if (this.gridStabilization) {
      const gridResult = this.applyGridStabilization(avgX, avgY)
      avgX = gridResult.x
      avgY = gridResult.y
    }

    return {x: avgX, y: avgY}
  },

  // Simple Kalman filter implementation
  applyKalman(measurement: number, state: {estimate: number, errorEstimate: number}): number {
    // Prediction
    const predictedEstimate = state.estimate
    const predictedErrorEstimate = state.errorEstimate + this.kalmanQ

    // Update
    const kalmanGain = predictedErrorEstimate / (predictedErrorEstimate + this.kalmanR)
    state.estimate = predictedEstimate + kalmanGain * (measurement - predictedEstimate)
    state.errorEstimate = (1 - kalmanGain) * predictedErrorEstimate

    return state.estimate
  },

  // Grid-based stabilization (similar to eyeTraceWebV2.2's find_mean_eye_point)
  applyGridStabilization(x: number, y: number): {x: number, y: number} {
    // Calculate grid cell
    const gridX = Math.floor(x * this.gridDivisions)
    const gridY = Math.floor(y * this.gridDivisions)

    // Calculate grid center
    const gridCenterX = (gridX + 0.5) / this.gridDivisions
    const gridCenterY = (gridY + 0.5) / this.gridDivisions

    // Calculate distance to grid center
    const distX = Math.abs(x - gridCenterX)
    const distY = Math.abs(y - gridCenterY)

    // Snap to grid if close enough
    if (distX < this.gridThreshold) {
      x = gridCenterX
    }
    if (distY < this.gridThreshold) {
      y = gridCenterY
    }

    return {x, y}
  },

  // Reset the filter
  reset() {
    this.buffer = []
    this.kalmanX = { estimate: 0, errorEstimate: 1 }
    this.kalmanY = { estimate: 0, errorEstimate: 1 }
  }
}

function handleGazeData(data: any) {
  // Apply smoothing filter
  const smoothedPoint = gazeSmoothing.addPoint(data.x, data.y)

  // Store raw data for recording (with smoothed values as well)
  if (isRecording && recordingStartTime) {
    const gazePoint = {
      timestamp: Date.now() - recordingStartTime,
      x: data.x,  // Raw x
      y: data.y,  // Raw y
      smoothedX: smoothedPoint.x,  // Smoothed x
      smoothedY: smoothedPoint.y,  // Smoothed y
      leftEye: data.leftEye,
      rightEye: data.rightEye
    }
    gazeDataBuffer.push(gazePoint)

    // Update gaze count display
    const gazeCount = document.getElementById('cogix-gaze-count')
    if (gazeCount) {
      gazeCount.textContent = gazeDataBuffer.length.toString()
    }
  }

  // Update gaze visualization with both smoothed and raw data
  if (showGazePoint) {
    updateGazeVisualization(smoothedPoint.x, smoothedPoint.y, data.x, data.y)
  }
}

// Additional element for showing raw average position
let rawGazeElement: HTMLDivElement | null = null
let gazeLegendElement: HTMLDivElement | null = null

// Clean up gaze visualization elements
function cleanupGazeVisualization() {
  if (gazeOverlayElement) {
    gazeOverlayElement.remove()
    gazeOverlayElement = null
  }
  if (rawGazeElement) {
    rawGazeElement.remove()
    rawGazeElement = null
  }
  if (gazeLegendElement) {
    gazeLegendElement.remove()
    gazeLegendElement = null
  }
}

function updateGazeVisualization(x: number, y: number, rawX?: number, rawY?: number) {
  // Create smoothed gaze point element (main red dot)
  if (!gazeOverlayElement) {
    gazeOverlayElement = document.createElement('div')
    gazeOverlayElement.id = 'cogix-gaze-point'
    gazeOverlayElement.style.cssText = `
      position: fixed;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255,107,53,0.8) 0%, rgba(255,138,101,0.4) 50%, transparent 70%);
      border: 2px solid rgba(255,107,53,0.6);
      pointer-events: none;
      z-index: 2147483646;
      transform: translate(-50%, -50%);
    `
    document.body.appendChild(gazeOverlayElement)
  }

  // Create raw average position element (semi-transparent blue dot - like eyeImagePOS in eyeTraceWebV2.2)
  if (!rawGazeElement && rawX !== undefined && rawY !== undefined) {
    rawGazeElement = document.createElement('div')
    rawGazeElement.id = 'cogix-gaze-raw'
    rawGazeElement.style.cssText = `
      position: fixed;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: rgba(255, 184, 151, 0.3);
      border: 1px solid rgba(255, 184, 151, 0.5);
      pointer-events: none;
      z-index: 2147483645;
      transform: translate(-50%, -50%);
    `
    document.body.appendChild(rawGazeElement)
  }

  // Create legend for gaze visualization (optional, shows what each dot means)
  if (!gazeLegendElement && gazeSmoothing.gridStabilization) {
    gazeLegendElement = document.createElement('div')
    gazeLegendElement.id = 'cogix-gaze-legend'
    gazeLegendElement.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.95);
      color: #333;
      border: 1px solid #FF6B35;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 11px;
      pointer-events: none;
      z-index: 2147483644;
      line-height: 1.4;
    `
    gazeLegendElement.innerHTML = `
      <div style="margin-bottom: 5px;"><span style="display:inline-block;width:10px;height:10px;background:rgba(255,107,53,0.8);border-radius:50%;margin-right:5px;"></span>Smoothed (Grid: ${gazeSmoothing.gridDivisions}x${gazeSmoothing.gridDivisions})</div>
      <div><span style="display:inline-block;width:10px;height:10px;background:rgba(255,184,151,0.3);border-radius:50%;margin-right:5px;"></span>Raw Average (L+R Eyes)</div>
    `
    document.body.appendChild(gazeLegendElement)
  }
  
  // Convert normalized coordinates (0-1) to screen pixels
  // The eye tracker sends normalized coordinates based on actual screen resolution
  const screenWidth = window.screen.width
  const screenHeight = window.screen.height
  
  // For storage, use actual screen coordinates
  let screenX = x * screenWidth;
  let screenY = y * screenHeight;
  
  // Check if coordinates are normalized (between 0 and 1)
  if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
    screenX = x * screenWidth
    screenY = y * screenHeight
  }
  
  // For display in browser viewport, we need to adjust for viewport position
  // The browser viewport might be offset from screen origin (0,0)
  // and might be smaller than the full screen
  const viewportX = (screenX / screenWidth) * window.innerWidth
  const viewportY = (screenY / screenHeight) * window.innerHeight
  
  // Position smoothed gaze point (red dot)
  gazeOverlayElement.style.left = `${viewportX}px`
  gazeOverlayElement.style.top = `${viewportY}px`
  gazeOverlayElement.style.display = showGazePoint ? 'block' : 'none'

  // Position raw average point (blue dot) if provided
  if (rawGazeElement && rawX !== undefined && rawY !== undefined) {
    // Calculate raw position
    let rawScreenX = rawX * screenWidth
    let rawScreenY = rawY * screenHeight

    if (rawX >= 0 && rawX <= 1 && rawY >= 0 && rawY <= 1) {
      rawScreenX = rawX * screenWidth
      rawScreenY = rawY * screenHeight
    }

    const rawViewportX = (rawScreenX / screenWidth) * window.innerWidth
    const rawViewportY = (rawScreenY / screenHeight) * window.innerHeight

    rawGazeElement.style.left = `${rawViewportX}px`
    rawGazeElement.style.top = `${rawViewportY}px`
    rawGazeElement.style.display = showGazePoint ? 'block' : 'none'
  }
}

function handleCalibrationComplete(result: any) {
  console.log('✅ Calibration completed:', result)
  isCalibrating = false
  
  // Remove calibration UI
  if (calibrationUI) {
    calibrationUI.remove()
    calibrationUI = null
  }
  
  // Exit fullscreen
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(err => {
      console.warn('Error exiting fullscreen:', err)
    })
  }
  
  // Update status
  updateStatus()
  
  // Start showing gaze point automatically
  showGazePoint = true
  chrome.storage.local.set({ showGazePoint: true })
  
  // Ensure gaze overlay element exists
  if (!gazeOverlayElement) {
    gazeOverlayElement = document.createElement('div')
    gazeOverlayElement.id = 'cogix-gaze-point'
    gazeOverlayElement.style.cssText = `
      position: fixed;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255,107,53,0.8) 0%, rgba(255,138,101,0.4) 50%, transparent 70%);
      border: 2px solid rgba(255,107,53,0.6);
      pointer-events: none;
      z-index: 2147483646;
      transform: translate(-50%, -50%);
      transition: none;
      display: block;
    `
    document.body.appendChild(gazeOverlayElement)
    console.log('✅ Created gaze overlay element')
  }
  
  const gazeToggleButton = document.getElementById('cogix-gaze-toggle') as HTMLButtonElement
  if (gazeToggleButton) {
    gazeToggleButton.textContent = '👁️'
    gazeToggleButton.style.background = '#2ecc71'
  }
  
  showNotification('Calibration complete! Eye tracking is now active.', 'success')
  console.log('📍 Gaze point should now be visible when gaze data arrives')
}

// ============================================================================
// Status Updates
// ============================================================================

async function updateStatus() {
  try {
    // Get state from centralized state manager
    const state = await eyeTrackerState.getStateAsync()
    
    // Update connection status
    const connectionStatus = document.getElementById('cogix-connection-status')
    if (connectionStatus) {
      connectionStatus.textContent = state.isConnected ? '🟢 Connected' : '🔴 Disconnected'
    }
    
    // Update calibration status
    const calibrationStatus = document.getElementById('cogix-calibration-status')
    if (calibrationStatus) {
      if (state.isCalibrated || state.isTracking) {
        calibrationStatus.textContent = '✅ Calibrated & Tracking'
        calibrationStatus.style.color = '#2ecc71'
      } else if (state.isConnected) {
        calibrationStatus.textContent = '⚠️ Not Calibrated'
        calibrationStatus.style.color = '#f39c12'
      } else {
        calibrationStatus.textContent = ''
      }
    }
    
    // Update state display
    updateStateDisplay(state)
    
  } catch (error) {
    console.error('Failed to update status:', error)
  }
}

function updateStateDisplay(state: any) {
  const elements = {
    'cogix-status-text': state.displayStatus || state.status || 'Unknown',
    'cogix-connected-text': state.isConnected ? 'true' : 'false',
    'cogix-calibrated-text': state.isCalibrated ? 'true' : 'false',
    'cogix-tracking-text': state.isTracking ? 'true' : 'false'
  }
  
  for (const [id, value] of Object.entries(elements)) {
    const element = document.getElementById(id)
    if (element) {
      element.textContent = String(value)
      if (id.includes('text') && id !== 'cogix-status-text') {
        element.style.color = value === 'true' ? '#2ecc71' : '#e74c3c'
      }
    }
  }
}

function updateRecordingState(recording: boolean) {
  const recordingText = document.getElementById('cogix-recording-text')
  if (recordingText) {
    recordingText.textContent = recording ? 'true' : 'false'
    recordingText.style.color = recording ? '#2ecc71' : '#e74c3c'
  }
}

function updateEyeTrackerStatus(message: any) {
  const state = {
    status: message.status,
    isConnected: message.isConnected,
    isCalibrated: message.isCalibrated,
    isTracking: message.isTracking,
    displayStatus: message.displayStatus || message.status
  }
  updateStateDisplay(state)
}

// ============================================================================
// Calibration
// ============================================================================

async function startCalibration() {
  console.log('Starting calibration UI...')
  
  if (calibrationUI) {
    calibrationUI.remove()
  }
  
  // Request fullscreen mode for better calibration
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
      console.log('✅ Entered fullscreen mode for calibration')
    }
  } catch (error) {
    console.warn('Could not enter fullscreen mode:', error)
    // Continue anyway - fullscreen is preferred but not required
  }
  
  // Create fullscreen container for calibration
  calibrationUI = document.createElement('div')
  calibrationUI.id = 'cogix-calibration-container'
  calibrationUI.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #000;
    z-index: 2147483647;
    display: block;
  `
  
  // Create canvas for calibration points
  // Use full screen dimensions for calibration
  const canvas = document.createElement('canvas')
  canvas.id = 'cogix-calibration-canvas'
  canvas.width = window.screen.width
  canvas.height = window.screen.height
  canvas.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  `
  
  calibrationUI.appendChild(canvas)
  
  // Add instructions overlay
  const instructions = document.createElement('div')
  instructions.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    text-align: center;
    pointer-events: none;
    z-index: 1;
  `
  instructions.innerHTML = `
    <h2 style="font-size: 32px; margin-bottom: 20px;">Eye Tracker Calibration</h2>
    <p style="font-size: 20px; margin-bottom: 15px;">Follow the dots with your eyes</p>
    <p style="font-size: 16px; opacity: 0.7;">Press ESC to cancel</p>
  `
  
  calibrationUI.appendChild(instructions)
  
  document.body.appendChild(calibrationUI)
  isCalibrating = true
  
  // Listen for ESC key
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isCalibrating) {
      stopCalibration()
      document.removeEventListener('keydown', handleEscape)
    }
  }
  document.addEventListener('keydown', handleEscape)
  
  // Request calibration start from background
  console.log('Requesting calibration start from background...')
  chrome.runtime.sendMessage({ type: 'START_EYE_TRACKER_CALIBRATION' })
}

function stopCalibration() {
  console.log('Stopping calibration...')
  isCalibrating = false
  
  if (calibrationUI) {
    calibrationUI.remove()
    calibrationUI = null
  }
  
  // Exit fullscreen if we're in it
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(err => {
      console.warn('Error exiting fullscreen:', err)
    })
  }
  
  // Notify background script
  chrome.runtime.sendMessage({
    type: 'STOP_EYE_TRACKER_CALIBRATION'
  })
}

function showCalibrationPoint(point: { x: number; y: number; index: number; total: number }) {
  console.log('Showing calibration point:', point)
  
  const canvas = document.getElementById('cogix-calibration-canvas') as HTMLCanvasElement
  if (!canvas) {
    console.error('Calibration canvas not found')
    return
  }
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // Convert normalized coordinates to screen coordinates
  const screenX = point.x * canvas.width
  const screenY = point.y * canvas.height
  
  // Draw calibration point with animation
  const drawPoint = () => {
    if (!isCalibrating) return
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    const pointSize = 20
    const animationTime = Date.now() / 1000
    const pulseScale = 1 + Math.sin(animationTime * 4) * 0.2
    
    // Outer circle (pulsing)
    ctx.beginPath()
    ctx.arc(screenX, screenY, pointSize * pulseScale, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.fill()
    
    // Middle circle
    ctx.beginPath()
    ctx.arc(screenX, screenY, pointSize * 0.7, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.fill()
    
    // Inner dot
    ctx.beginPath()
    ctx.arc(screenX, screenY, pointSize * 0.3, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    
    // Update progress text
    const instructions = calibrationUI?.querySelector('p:last-child')
    if (instructions) {
      instructions.textContent = `Point ${point.index + 1} of ${point.total} - Press ESC to cancel`
    }
    
    requestAnimationFrame(drawPoint)
  }
  
  drawPoint()
}

function hideCalibration() {
  console.log('Hiding calibration UI')
  stopCalibration()
}

// ============================================================================
// Upload Progress UI
// ============================================================================

function showUploadProgress(uploadData: any) {
  isUploading = true
  
  // Disable all UI buttons
  disableUIButtons(true)
  
  // Create upload progress overlay
  if (uploadProgressUI) {
    uploadProgressUI.remove()
  }
  
  uploadProgressUI = document.createElement('div')
  uploadProgressUI.id = 'cogix-upload-progress'
  uploadProgressUI.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 400px;
    background: rgba(26, 26, 26, 0.98);
    border: 2px solid #176feb;
    border-radius: 12px;
    padding: 24px;
    z-index: 2147483648;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  `
  
  const videoSizeMB = (uploadData.videoBlobSize / (1024 * 1024)).toFixed(2)
  
  uploadProgressUI.innerHTML = `
    <div style="color: white;">
      <h3 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
        📤 Uploading Recording
      </h3>
      
      <div style="margin-bottom: 16px; font-size: 14px; color: #ccc;">
        <div>Session: ${uploadData.sessionId}</div>
        <div>Size: ${videoSizeMB} MB</div>
        <div>Duration: ${uploadData.metadata?.duration ? uploadData.metadata.duration.toFixed(1) + 's' : 'Extracting...'}</div>
        <div>Gaze Points: ${uploadData.gazeDataCount || 0}</div>
        <div>Codec: ${uploadData.metadata?.codec || 'video/webm'}</div>
      </div>
      
      <div style="margin-bottom: 16px;">
        <div style="background: rgba(255, 255, 255, 0.1); border-radius: 8px; overflow: hidden; height: 8px;">
          <div id="cogix-upload-progress-bar" style="
            background: linear-gradient(90deg, #FF6B35 0%, #FF8A65 100%);
            height: 100%;
            width: 0%;
            transition: width 0.3s ease;
          "></div>
        </div>
        <div id="cogix-upload-progress-text" style="margin-top: 8px; font-size: 14px; text-align: center; color: #ccc;">
          Preparing upload...
        </div>
      </div>
      
      <div id="cogix-upload-status" style="font-size: 14px; color: #888; text-align: center;">
        Please wait, do not close this tab
      </div>
      
      <div id="cogix-upload-actions" style="display: none; margin-top: 16px; text-align: center;">
        <button id="cogix-retry-upload" style="
          background: #176feb;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          margin-right: 8px;
        ">🔄 Retry Upload</button>
        
        <button id="cogix-cancel-upload" style="
          background: #e74c3c;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
        ">❌ Cancel</button>
      </div>
    </div>
  `
  
  document.body.appendChild(uploadProgressUI)
  
  // Simulate initial progress
  setTimeout(() => updateUploadProgress(10, 'uploading', 'Connecting to server...'), 100)
  setTimeout(() => updateUploadProgress(25, 'uploading', 'Uploading video data...'), 500)
}

function updateUploadProgress(percent: number, status: 'uploading' | 'completed' | 'failed', message: string) {
  if (!uploadProgressUI) return
  
  const progressBar = document.getElementById('cogix-upload-progress-bar')
  const progressText = document.getElementById('cogix-upload-progress-text')
  const statusText = document.getElementById('cogix-upload-status')
  const actionsDiv = document.getElementById('cogix-upload-actions')
  
  if (progressBar) {
    progressBar.style.width = `${percent}%`
  }
  
  if (progressText) {
    progressText.textContent = `${percent}%`
  }
  
  if (statusText) {
    statusText.textContent = message
    
    if (status === 'completed') {
      statusText.style.color = '#2ecc71'
      statusText.innerHTML = '✅ ' + message
      
      // Hide actions (retry/cancel buttons) on success
      if (actionsDiv) {
        actionsDiv.style.display = 'none'
      }
      
      // Show a success message
      const uploadTitle = uploadProgressUI.querySelector('h3')
      if (uploadTitle) {
        uploadTitle.textContent = '✅ Upload Complete!'
      }
      
    } else if (status === 'failed') {
      statusText.style.color = '#e74c3c'
      statusText.innerHTML = '❌ ' + message
    }
  }
  
  if (status === 'completed') {
    isUploading = false
    disableUIButtons(false)
  }
}

function hideUploadProgress() {
  if (uploadProgressUI) {
    uploadProgressUI.remove()
    uploadProgressUI = null
  }
  isUploading = false
  currentUploadId = null
  disableUIButtons(false)
}

function showRetryButton() {
  const actions = document.getElementById('cogix-upload-actions')
  if (actions) {
    actions.style.display = 'block'
    
    const retryBtn = document.getElementById('cogix-retry-upload')
    const cancelBtn = document.getElementById('cogix-cancel-upload')
    
    if (retryBtn) {
      retryBtn.onclick = async () => {
        await retryFailedUpload(currentUploadId!)
      }
    }
    
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        hideUploadProgress()
      }
    }
  }
}

function disableUIButtons(disable: boolean) {
  // Disable/enable all interactive buttons in the overlay
  const buttons = [
    'cogix-calibrate-btn',
    'cogix-record-btn',
    'cogix-gaze-toggle',
    'cogix-minimize-btn'
  ]
  
  buttons.forEach(id => {
    const btn = document.getElementById(id) as HTMLButtonElement
    if (btn) {
      btn.disabled = disable
      btn.style.opacity = disable ? '0.5' : '1'
      btn.style.cursor = disable ? 'not-allowed' : 'pointer'
    }
  })
}

// ============================================================================
// Local Storage Management for Upload Backup
// ============================================================================

async function saveUploadMetadata(uploadMetadata: any) {
  try {
    const uploads = await getStoredUploads()
    uploads[uploadMetadata.uploadId] = uploadMetadata
    
    // Store in chrome.storage.local (metadata only, no video data)
    await chrome.storage.local.set({ pendingUploads: uploads })
    console.log('💾 Upload metadata saved to storage:', uploadMetadata.uploadId)
  } catch (error) {
    console.error('Failed to save upload metadata to storage:', error)
  }
}

async function getStoredUploads(): Promise<any> {
  try {
    const result = await chrome.storage.local.get(['pendingUploads'])
    return result.pendingUploads || {}
  } catch (error) {
    console.error('Failed to get stored uploads:', error)
    return {}
  }
}

async function removeUploadFromStorage(uploadId: string) {
  try {
    const uploads = await getStoredUploads()
    delete uploads[uploadId]
    await chrome.storage.local.set({ pendingUploads: uploads })
    console.log('🗑️ Upload removed from storage:', uploadId)
  } catch (error) {
    console.error('Failed to remove upload from storage:', error)
  }
}

async function markUploadAsFailed(uploadId: string, errorMessage: string) {
  try {
    const uploads = await getStoredUploads()
    if (uploads[uploadId]) {
      uploads[uploadId].status = 'failed'
      uploads[uploadId].error = errorMessage
      uploads[uploadId].failedAt = Date.now()
      await chrome.storage.local.set({ pendingUploads: uploads })
      console.log('❌ Upload marked as failed:', uploadId)
    }
  } catch (error) {
    console.error('Failed to mark upload as failed:', error)
  }
}

async function retryFailedUpload(uploadId: string) {
  try {
    const uploads = await getStoredUploads()
    const uploadData = uploads[uploadId]
    
    if (!uploadData) {
      showNotification('Upload data not found', 'error')
      return
    }
    
    // Check if this session was already successfully uploaded
    const isAlreadyUploaded = await checkIfSessionUploaded(uploadData.sessionId)
    if (isAlreadyUploaded) {
      console.log('⚠️ Session already uploaded, skipping duplicate:', uploadData.sessionId)
      updateUploadProgress(100, 'completed', 'Session already uploaded')
      await removeUploadFromStorage(uploadId)
      setTimeout(() => {
        hideUploadProgress()
      }, 3000)
      return
    }
    
    // We can no longer retry uploads since we don't store the video data
    console.error('❌ Cannot retry upload - video data not stored to avoid quota issues')
    showNotification('Cannot retry upload. Please record again if needed.', 'error')
    updateUploadProgress(0, 'failed', 'Retry not available - please record again')
    
    // Remove the failed metadata
    await removeUploadFromStorage(uploadId)
  } catch (error) {
    console.error('❌ Retry failed:', error)
    updateUploadProgress(0, 'failed', `Retry failed: ${error.message}`)
    await markUploadAsFailed(uploadId, error.message)
    showRetryButton()
  }
}

// Track successfully uploaded sessions to prevent duplicates
async function markUploadAsCompleted(uploadId: string, sessionId: string) {
  try {
    // Get completed uploads history
    const result = await chrome.storage.local.get(['completedUploads'])
    const completedUploads = result.completedUploads || {}
    
    // Store with session ID as key and completion time
    completedUploads[sessionId] = {
      uploadId,
      completedAt: Date.now(),
      sessionId
    }
    
    // Keep only last 100 completed uploads to avoid storage bloat
    const sortedKeys = Object.keys(completedUploads)
      .sort((a, b) => completedUploads[b].completedAt - completedUploads[a].completedAt)
    
    if (sortedKeys.length > 100) {
      sortedKeys.slice(100).forEach(key => delete completedUploads[key])
    }
    
    await chrome.storage.local.set({ completedUploads })
    console.log('✅ Marked session as uploaded:', sessionId)
  } catch (error) {
    console.error('Failed to mark upload as completed:', error)
  }
}

// Check if a session has already been uploaded
async function checkIfSessionUploaded(sessionId: string): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get(['completedUploads'])
    const completedUploads = result.completedUploads || {}
    
    if (completedUploads[sessionId]) {
      const uploadTime = new Date(completedUploads[sessionId].completedAt)
      console.log(`⚠️ Session ${sessionId} was already uploaded at ${uploadTime.toLocaleString()}`)
      return true
    }
    
    return false
  } catch (error) {
    console.error('Failed to check upload status:', error)
    return false // Assume not uploaded if we can't check
  }
}

// Check for failed uploads on startup
async function checkFailedUploads() {
  const uploads = await getStoredUploads()
  const failedUploads = Object.values(uploads).filter((u: any) => u.status === 'failed')
  
  if (failedUploads.length > 0) {
    console.log(`📦 Found ${failedUploads.length} failed uploads`)
    
    // Check each failed upload to see if it was actually completed
    for (const upload of failedUploads) {
      const isCompleted = await checkIfSessionUploaded((upload as any).sessionId)
      if (isCompleted) {
        console.log(`🗑️ Removing duplicate failed upload for completed session: ${(upload as any).sessionId}`)
        await removeUploadFromStorage((upload as any).uploadId)
      }
    }
    
    // Re-check after cleanup
    const remainingUploads = await getStoredUploads()
    const remainingFailed = Object.values(remainingUploads).filter((u: any) => u.status === 'failed')
    
    if (remainingFailed.length > 0) {
      showNotification(`${remainingFailed.length} failed upload(s) found. Open extension to retry.`, 'info')
    }
  }
}

// ============================================================================
// Video Duration Extraction
// ============================================================================

/**
 * Extract video duration from a video blob using a temporary video element
 * This is more reliable than calculating from timestamps because MediaRecorder
 * sometimes produces files with incorrect or missing duration metadata
 */
async function getVideoDuration(videoBlob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      const video = document.createElement('video')
      const objectURL = URL.createObjectURL(videoBlob)
      
      let resolved = false
      
      // Set up event listeners
      video.addEventListener('loadedmetadata', () => {
        if (!resolved) {
          resolved = true
          const duration = video.duration
          
          // Clean up
          URL.revokeObjectURL(objectURL)
          video.remove()
          
          if (isFinite(duration) && duration > 0) {
            console.log(`📹 Video duration extracted: ${duration.toFixed(2)}s`)
            resolve(duration)
          } else if (!isFinite(duration) || duration === Infinity) {
            console.warn('⚠️ Invalid video duration (Infinity or NaN):', duration)
            reject(new Error(`Invalid video duration: ${duration}`))
          } else if (duration <= 0) {
            console.warn('⚠️ Invalid video duration (zero or negative):', duration)
            reject(new Error(`Invalid video duration: ${duration}`))
          } else {
            console.warn('⚠️ Invalid video duration:', duration)
            reject(new Error(`Invalid video duration: ${duration}`))
          }
        }
      })
      
      video.addEventListener('error', (e) => {
        if (!resolved) {
          resolved = true
          console.error('❌ Error loading video for duration extraction:', e)
          URL.revokeObjectURL(objectURL)
          video.remove()
          reject(new Error('Failed to load video for duration extraction'))
        }
      })
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true
          console.warn('⏰ Timeout extracting video duration')
          URL.revokeObjectURL(objectURL)
          video.remove()
          reject(new Error('Timeout extracting video duration'))
        }
      }, 10000)
      
      // Set video properties
      video.preload = 'metadata'
      video.muted = true
      video.style.display = 'none'
      video.playsInline = true
      
      // For WebM files from MediaRecorder, sometimes need to seek to get duration
      video.addEventListener('durationchange', () => {
        if (!resolved && isFinite(video.duration) && video.duration > 0) {
          console.log('📹 Duration available after durationchange:', video.duration)
        }
      })
      
      // Add to DOM temporarily (required for some browsers)
      document.body.appendChild(video)
      
      // Start loading
      video.src = objectURL
      
      // WebM workaround: seek to end to force duration calculation
      video.addEventListener('loadeddata', () => {
        if (!resolved && (!isFinite(video.duration) || video.duration === Infinity)) {
          console.log('🔧 Attempting WebM duration workaround...')
          video.currentTime = 1e101 // Seek to "infinity"
          video.addEventListener('seeked', () => {
            video.currentTime = 0 // Reset
          }, { once: true })
        }
      }, { once: true })
      
    } catch (error) {
      console.error('❌ Failed to create video element for duration extraction:', error)
      reject(error)
    }
  })
}

/**
 * Fallback function to get duration from calculated time if video extraction fails
 */
function getFallbackDuration(startTime: number, endTime: number): number {
  const calculatedDuration = (endTime - startTime) / 1000
  console.log(`📊 Using fallback calculated duration: ${calculatedDuration.toFixed(2)}s`)
  return calculatedDuration
}

// ============================================================================
// Helper Functions
// ============================================================================

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
  
  return 'video/webm'
}

function generateSessionId(): string {
  // Create a human-readable timestamp
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const second = String(now.getSeconds()).padStart(2, '0')
  const millisecond = String(now.getMilliseconds()).padStart(3, '0')
  
  // Format: rec_YYYYMMDD_HHMMSS_MS_RANDOM
  // Example: rec_20240115_143025_123_abc123
  const timestamp = `${year}${month}${day}_${hour}${minute}${second}_${millisecond}`
  const randomId = Math.random().toString(36).substr(2, 6)
  
  return `rec_${timestamp}_${randomId}`
}

function showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const notification = document.createElement('div')
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 8px;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 14px;
    z-index: 2147483647;
    animation: slideIn 0.3s ease-out;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `
  
  // Set background color based on type
  switch (type) {
    case 'success':
      notification.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)'
      break
    case 'error':
      notification.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)'
      break
    default:
      notification.style.background = 'linear-gradient(135deg, #3498db, #2980b9)'
  }
  
  notification.textContent = message
  document.body.appendChild(notification)
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out'
    setTimeout(() => notification.remove(), 300)
  }, 5000)
}

// Add animation styles
const style = document.createElement('style')
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`
document.head.appendChild(style)

// ============================================================================
// Initialize
// ============================================================================

// Initialize overlay when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    createOverlay()
    checkFailedUploads() // Check for any failed uploads
  })
} else {
  createOverlay()
  checkFailedUploads() // Check for any failed uploads
}

// Load saved preferences
chrome.storage.local.get(['showGazePoint'], (result) => {
  showGazePoint = result.showGazePoint !== false // Default to true
})

console.log('✅ Cogix overlay content script loaded')