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
let uploadProgressUI: HTMLElement | null = null
let currentUploadId: string | null = null
let isUploading = false

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
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform-origin: bottom right;
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
    transition: opacity 0.3s ease;
  `
  statusDisplay.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 4px;">Eye Tracker Status</div>
    <div id="cogix-connection-status" style="font-size: 12px;">Checking...</div>
    <div id="cogix-calibration-status" style="font-size: 12px; margin-top: 4px;"></div>
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

  // Create minimal recording indicator (hidden by default)
  const minimalIndicator = document.createElement('div')
  minimalIndicator.id = 'cogix-minimal-indicator'
  minimalIndicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 60px;
    height: 60px;
    background: rgba(231, 76, 60, 0.95);
    border-radius: 50%;
    display: none;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
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
        box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.7);
      }
      70% {
        box-shadow: 0 0 0 20px rgba(231, 76, 60, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(231, 76, 60, 0);
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
      await finalizeRecording(projectId)
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

    // Extract video duration from the actual video file
    let videoDuration: number
    try {
      videoDuration = await getVideoDuration(videoBlob)
      console.log('⏱️ Video duration extracted:', videoDuration, 'seconds')
    } catch (error) {
      console.warn('⚠️ Failed to extract video duration, using calculated fallback:', error.message)
      videoDuration = getFallbackDuration(recordingStartTime || Date.now() - duration, Date.now())
    }

    // Prepare metadata with accurate video duration
    const metadata = {
      duration: videoDuration, // Use extracted duration instead of calculated
      calculatedDuration: duration / 1000, // Keep calculated for comparison
      actualDuration: videoDuration, // Explicit field for actual video duration
      url: window.location.href,
      title: document.title,
      userAgent: navigator.userAgent,
      screen_width: screen.width,
      screen_height: screen.height,
      gazePointsCount: gazeDataBuffer.length,
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
      recordingStartTime = null
      recordingSessionId = null
      return
    }
    
    // Generate upload ID
    currentUploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Save only metadata to local storage (not the video to avoid quota issues)
    const uploadMetadata = {
      uploadId: currentUploadId,
      projectId,
      sessionId,
      videoBlobSize: videoBlob.size,
      gazeDataCount: gazeDataBuffer.length,
      metadata,
      screenDimensions: {
        width: screen.width,
        height: screen.height
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
      console.log('📨 Sending upload request to background...')
      const result = await chrome.runtime.sendMessage({
        type: 'DATA_IO_UPLOAD_SESSION_BLOB_URL',
        uploadId: currentUploadId,
        projectId,
        sessionId,
        videoBlobUrl: blobUrl,
        videoBlobSize: videoBlob.size,
        gazeData: gazeDataBuffer,
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
  
  // Convert normalized coordinates (0-1) to screen pixels
  // The eye tracker likely sends normalized coordinates
  let screenX = x * window.innerWidth;
  let screenY = y * window.innerHeight;
  
  // Check if coordinates are normalized (between 0 and 1)
  if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
    screenX = x * window.innerWidth
    screenY = y * window.innerHeight
    // console.log(`📍 Gaze: normalized(${x.toFixed(3)}, ${y.toFixed(3)}) → screen(${Math.round(screenX)}, ${Math.round(screenY)})`)
  }
  
  gazeOverlayElement.style.left = `${screenX}px`
  gazeOverlayElement.style.top = `${screenY}px`
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
            background: linear-gradient(90deg, #176feb 0%, #44c1f7 100%);
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