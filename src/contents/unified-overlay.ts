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

// ============================================================================
// State Management
// ============================================================================

let isRecording = false
let isPaused = false
let mediaRecorder: MediaRecorder | null = null
let currentStream: MediaStream | null = null
let recordedChunks: Blob[] = []
let gazeDataBuffer: any[] = []
let recordingStartTime: number | null = null
let recordingSessionId: string | null = null
let showGazePoint = true
let gazeOverlayElement: HTMLElement | null = null
let isCalibrating = false
let calibrationUI: HTMLElement | null = null

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

  // Create main overlay panel
  const overlay = document.createElement('div')
  overlay.id = 'cogix-overlay'
  overlay.style.cssText = `
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #4A90E2;
    border-radius: 12px;
    padding: 15px;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    min-width: 250px;
  `

  // Create status display
  const statusDisplay = document.createElement('div')
  statusDisplay.id = 'cogix-status'
  statusDisplay.style.cssText = `
    margin-bottom: 10px;
    padding: 8px;
    background: rgba(74, 144, 226, 0.2);
    border-radius: 6px;
    text-align: center;
  `
  statusDisplay.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 4px;">Eye Tracker Status</div>
    <div id="cogix-connection-status" style="font-size: 12px;">Checking...</div>
    <div id="cogix-calibration-status" style="font-size: 12px; margin-top: 4px;"></div>
  `

  // Create control buttons
  const controls = document.createElement('div')
  controls.style.cssText = `
    display: flex;
    gap: 8px;
    margin-top: 10px;
  `

  // Record button
  const recordButton = document.createElement('button')
  recordButton.id = 'cogix-record-btn'
  recordButton.style.cssText = `
    flex: 1;
    padding: 8px 12px;
    background: #e74c3c;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  `
  recordButton.textContent = '🔴 Start Recording'
  
  // Gaze toggle button
  const gazeToggleButton = document.createElement('button')
  gazeToggleButton.id = 'cogix-gaze-toggle'
  gazeToggleButton.style.cssText = `
    padding: 8px 12px;
    background: #2ecc71;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  `
  
  const updateGazeToggleButton = () => {
    gazeToggleButton.textContent = showGazePoint ? '👁️' : '👁️‍🗨️'
    gazeToggleButton.style.background = showGazePoint ? '#2ecc71' : '#95a5a6'
    gazeToggleButton.title = showGazePoint ? 'Hide gaze point' : 'Show gaze point'
  }

  controls.appendChild(recordButton)
  controls.appendChild(gazeToggleButton)

  overlay.appendChild(statusDisplay)
  overlay.appendChild(controls)
  container.appendChild(overlay)

  // Create state display (for debugging)
  const stateDisplay = document.createElement('div')
  stateDisplay.id = 'cogix-state-display'
  stateDisplay.style.cssText = `
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid #666;
    border-radius: 8px;
    padding: 10px;
    color: #0f0;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    max-width: 250px;
  `
  stateDisplay.innerHTML = `
    <div style="margin-bottom: 5px; color: #fff; font-weight: bold;">State Monitor</div>
    <div>Status: <span id="cogix-status-text">Loading...</span></div>
    <div>Connected: <span id="cogix-connected-text">false</span></div>
    <div>Calibrated: <span id="cogix-calibrated-text">false</span></div>
    <div>Tracking: <span id="cogix-tracking-text">false</span></div>
    <div>Recording: <span id="cogix-recording-text">false</span></div>
    <div>Gaze Points: <span id="cogix-gaze-count">0</span></div>
  `
  container.appendChild(stateDisplay)

  document.body.appendChild(container)

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
      
      if (!projectId) {
        alert('Please select a project first')
        return
      }
      
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
// Recording Functions
// ============================================================================

async function startRecording(projectId: string) {
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
    recordingStartTime = Date.now()
    recordingSessionId = generateSessionId()

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data)
        console.log('📦 Video chunk recorded, size:', event.data.size)
      }
    }

    mediaRecorder.onstop = async () => {
      console.log('🛑 MediaRecorder stopped, finalizing...')
      await finalizeRecording(projectId)
    }

    // Start recording
    mediaRecorder.start(1000) // Collect data every second
    isRecording = true
    
    // Update UI
    const recordButton = document.getElementById('cogix-record-btn') as HTMLButtonElement
    if (recordButton) {
      recordButton.textContent = '⏹️ Stop Recording'
      recordButton.style.background = '#27ae60'
    }
    
    // Update state display
    updateRecordingState(true)
    
    // Notify background script
    await chrome.runtime.sendMessage({
      type: 'RECORDING_STARTED',
      projectId,
      sessionId: recordingSessionId
    })
    
    console.log('✅ Recording started successfully')
    
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
  
  // Update UI
  const recordButton = document.getElementById('cogix-record-btn') as HTMLButtonElement
  if (recordButton) {
    recordButton.textContent = '🔴 Start Recording'
    recordButton.style.background = '#e74c3c'
  }
  
  // Update state display
  updateRecordingState(false)
  
  console.log('✅ Recording stopped')
}

async function finalizeRecording(projectId: string) {
  if (!recordingSessionId || recordedChunks.length === 0) {
    console.error('No recording data to finalize')
    return
  }

  const sessionId = recordingSessionId
  const duration = Date.now() - (recordingStartTime || Date.now())
  
  console.log('📤 Finalizing recording:', {
    sessionId,
    projectId,
    duration: duration / 1000 + 's',
    chunks: recordedChunks.length,
    gazePoints: gazeDataBuffer.length
  })

  try {
    // Create video blob
    const videoBlob = new Blob(recordedChunks, { type: getSupportedMimeType() })
    console.log('🎥 Video blob created, size:', videoBlob.size)

    // Convert to array for serialization
    const videoArray = Array.from(new Uint8Array(await videoBlob.arrayBuffer()))

    // Prepare metadata
    const metadata = {
      duration: duration / 1000,
      url: window.location.href,
      title: document.title,
      userAgent: navigator.userAgent,
      screen_width: screen.width,
      screen_height: screen.height,
      gazePointsCount: gazeDataBuffer.length,
      videoSize: videoBlob.size,
      codec: getSupportedMimeType()
    }

    console.log('📡 Uploading to data-io...')
    
    // Send to background script for upload
    const result = await chrome.runtime.sendMessage({
      type: 'DATA_IO_UPLOAD_SESSION',
      projectId,
      sessionId,
      videoBlob: videoArray,
      gazeData: gazeDataBuffer,
      metadata,
      screenDimensions: {
        width: screen.width,
        height: screen.height
      }
    })

    if (result.success) {
      console.log('✅ Upload successful:', result)
      showNotification('Recording uploaded successfully!', 'success')
    } else {
      throw new Error(result.error || 'Upload failed')
    }
    
  } catch (error) {
    console.error('❌ Failed to upload recording:', error)
    showNotification('Failed to upload recording: ' + error.message, 'error')
  }
  
  // Clean up
  recordedChunks = []
  gazeDataBuffer = []
  recordingStartTime = null
  recordingSessionId = null
}

// ============================================================================
// Eye Tracking Integration
// ============================================================================

// Listen for gaze data
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GAZE_DATA':
      handleGazeData(message.data)
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
  }
})

function handleGazeData(data: any) {
  // Store gaze data if recording
  if (isRecording && recordingStartTime) {
    const gazePoint = {
      timestamp: Date.now() - recordingStartTime,
      x: data.x,
      y: data.y,
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
  
  // Update gaze visualization
  if (showGazePoint) {
    updateGazeVisualization(data.x, data.y)
  }
}

function updateGazeVisualization(x: number, y: number) {
  if (!gazeOverlayElement) {
    gazeOverlayElement = document.createElement('div')
    gazeOverlayElement.id = 'cogix-gaze-point'
    gazeOverlayElement.style.cssText = `
      position: fixed;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255,0,0,0.8) 0%, rgba(255,0,0,0.4) 50%, transparent 70%);
      border: 2px solid rgba(255,0,0,0.6);
      pointer-events: none;
      z-index: 2147483646;
      transform: translate(-50%, -50%);
      transition: all 0.1s ease-out;
    `
    document.body.appendChild(gazeOverlayElement)
  }
  
  gazeOverlayElement.style.left = `${x}px`
  gazeOverlayElement.style.top = `${y}px`
  gazeOverlayElement.style.display = showGazePoint ? 'block' : 'none'
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
      background: radial-gradient(circle, rgba(255,0,0,0.8) 0%, rgba(255,0,0,0.4) 50%, transparent 70%);
      border: 2px solid rgba(255,0,0,0.6);
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
  const canvas = document.createElement('canvas')
  canvas.id = 'cogix-calibration-canvas'
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
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
  return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
  document.addEventListener('DOMContentLoaded', createOverlay)
} else {
  createOverlay()
}

// Load saved preferences
chrome.storage.local.get(['showGazePoint'], (result) => {
  showGazePoint = result.showGazePoint !== false // Default to true
})

console.log('✅ Cogix overlay content script loaded')