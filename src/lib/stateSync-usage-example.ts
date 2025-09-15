/**
 * Usage Examples for Chrome Extension State Sync
 * 
 * This shows how to use the StateSyncManager in different contexts
 */

import { stateSync } from './stateSyncManager'
import { DeviceStatus } from '@iris-point/eye-tracking-core'

// ============================================================================
// Example 1: In Background Script
// ============================================================================

export function backgroundScriptExample() {
  // Update eye tracker status (will broadcast to all contexts)
  stateSync.set('eyeTracker', {
    status: DeviceStatus.CONNECTED,
    isConnected: true,
    isCalibrated: false,
    isTracking: false,
    lastUpdate: Date.now(),
    wsUrl: 'wss://127.0.0.1:8443'
  })

  // Subscribe to changes (even in background)
  const unsubscribe = stateSync.subscribe('eyeTracker', (newState, oldState) => {
    console.log('Eye tracker state changed:', { oldState, newState })
  })

  // Later: cleanup
  // unsubscribe()
}

// ============================================================================
// Example 2: In Popup
// ============================================================================

export function popupExample() {
  // Get current state
  const eyeTrackerState = stateSync.get('eyeTracker')
  console.log('Current eye tracker state:', eyeTrackerState)

  // Subscribe to real-time updates
  const unsubscribe = stateSync.subscribe('eyeTracker', (newState) => {
    console.log('Eye tracker updated:', newState)
    // Update UI
    updatePopupUI(newState)
  })

  // Update state from popup (will sync everywhere)
  async function handleConnect() {
    await stateSync.set('eyeTracker', {
      status: DeviceStatus.CONNECTING,
      isConnected: false,
      isCalibrated: false,
      isTracking: false,
      lastUpdate: Date.now(),
      wsUrl: 'wss://127.0.0.1:8443'
    })
  }

  // Cleanup when popup closes
  window.addEventListener('unload', () => {
    unsubscribe()
  })
}

// ============================================================================
// Example 3: In Content Script
// ============================================================================

export function contentScriptExample() {
  // Content scripts can also read and update state
  const recordingState = stateSync.get('recording')
  
  if (recordingState?.isRecording) {
    console.log('Recording in progress:', recordingState.sessionId)
  }

  // Subscribe to recording state changes
  stateSync.subscribe('recording', (newState) => {
    if (newState.isRecording) {
      startRecordingUI()
    } else {
      stopRecordingUI()
    }
  })

  // Start recording
  async function startRecording(projectId: string) {
    await stateSync.set('recording', {
      isRecording: true,
      sessionId: generateSessionId(),
      projectId: projectId,
      startTime: Date.now()
    })
  }
}

// ============================================================================
// Example 4: React Hook Integration
// ============================================================================

import { useState, useEffect } from 'react'

export function useSyncedState<K extends keyof import('./stateSyncManager').SyncedState>(
  namespace: K
): [
  import('./stateSyncManager').SyncedState[K] | undefined,
  (value: import('./stateSyncManager').SyncedState[K]) => Promise<void>
] {
  const [state, setState] = useState(() => stateSync.get(namespace))

  useEffect(() => {
    // Subscribe to changes
    const unsubscribe = stateSync.subscribe(namespace, (newValue) => {
      setState(newValue)
    })

    // Get latest value in case it changed before subscription
    setState(stateSync.get(namespace))

    return unsubscribe
  }, [namespace])

  const updateState = async (value: import('./stateSyncManager').SyncedState[K]) => {
    await stateSync.set(namespace, value)
  }

  return [state, updateState]
}

// React component example
export function EyeTrackerComponent() {
  const [eyeTracker, setEyeTracker] = useSyncedState('eyeTracker')

  if (!eyeTracker) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <p>Status: {eyeTracker.status}</p>
      <p>Connected: {eyeTracker.isConnected ? 'Yes' : 'No'}</p>
      <p>Calibrated: {eyeTracker.isCalibrated ? 'Yes' : 'No'}</p>
      
      <button onClick={() => {
        setEyeTracker({
          ...eyeTracker,
          isConnected: !eyeTracker.isConnected
        })
      }}>
        Toggle Connection
      </button>
    </div>
  )
}

// ============================================================================
// Example 5: Batch Updates
// ============================================================================

export async function batchUpdateExample() {
  // Update multiple namespaces at once
  await stateSync.setBatch({
    eyeTracker: {
      status: DeviceStatus.DISCONNECTED,
      isConnected: false,
      isCalibrated: false,
      isTracking: false,
      lastUpdate: Date.now(),
      wsUrl: 'wss://127.0.0.1:8443'
    },
    recording: {
      isRecording: false,
      sessionId: null,
      projectId: null,
      startTime: null
    }
  })
}

// ============================================================================
// Helper Functions
// ============================================================================

function updatePopupUI(state: any) {
  // Update your popup UI here
}

function startRecordingUI() {
  // Show recording indicator
}

function stopRecordingUI() {
  // Hide recording indicator
}

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}