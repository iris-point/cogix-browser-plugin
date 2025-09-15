/**
 * React Hooks for State Management
 * Provides easy-to-use hooks for React components
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { StateSyncManager } from './StateSyncManager'
import { 
  ExtensionState, 
  StateNamespace, 
  StateUpdate,
  EyeTrackerState,
  RecordingState,
  UserState,
  UIState,
  SystemState
} from './types'

// Global instance (will be initialized on first use)
let globalStateManager: StateSyncManager | null = null

/**
 * Get or create the global state manager instance
 */
function getStateManager(): StateSyncManager {
  if (!globalStateManager) {
    // Detect if we're in background script or client
    const isBackground = typeof window === 'undefined' || !window.document
    globalStateManager = new StateSyncManager({
      mode: isBackground ? 'master' : 'client',
      debugMode: process.env.NODE_ENV === 'development'
    })
  }
  return globalStateManager
}

/**
 * Hook to access and update a specific state namespace
 */
export function useExtensionState<K extends StateNamespace>(
  namespace: K
): [
  ExtensionState[K] | undefined,
  (update: StateUpdate<K>) => Promise<void>,
  boolean
] {
  const stateManager = useRef<StateSyncManager>()
  const [state, setState] = useState<ExtensionState[K] | undefined>()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Initialize state manager
    stateManager.current = getStateManager()
    
    // Get initial state
    const initialState = stateManager.current.getState(namespace)
    setState(initialState)
    setIsLoading(false)
    
    // Subscribe to changes
    const unsubscribe = stateManager.current.subscribe(namespace, (newState) => {
      setState(newState)
    })
    
    return unsubscribe
  }, [namespace])

  const updateState = useCallback(async (update: StateUpdate<K>) => {
    if (stateManager.current) {
      await stateManager.current.updateState(namespace, update)
    }
  }, [namespace])

  return [state, updateState, isLoading]
}

/**
 * Hook specifically for eye tracker state
 */
export function useEyeTrackerState(): [
  EyeTrackerState | undefined,
  (update: Partial<EyeTrackerState>) => Promise<void>,
  boolean
] {
  return useExtensionState('eyeTracker')
}

/**
 * Hook specifically for recording state
 */
export function useRecordingState(): [
  RecordingState | undefined,
  (update: Partial<RecordingState>) => Promise<void>,
  boolean
] {
  return useExtensionState('recording')
}

/**
 * Hook specifically for user state
 */
export function useUserState(): [
  UserState | undefined,
  (update: Partial<UserState>) => Promise<void>,
  boolean
] {
  return useExtensionState('user')
}

/**
 * Hook specifically for UI state
 */
export function useUIState(): [
  UIState | undefined,
  (update: Partial<UIState>) => Promise<void>,
  boolean
] {
  return useExtensionState('ui')
}

/**
 * Hook specifically for system state
 */
export function useSystemState(): [
  SystemState | undefined,
  (update: Partial<SystemState>) => Promise<void>,
  boolean
] {
  return useExtensionState('system')
}

/**
 * Hook to access the entire extension state
 */
export function useFullExtensionState(): [
  ExtensionState | undefined,
  boolean
] {
  const stateManager = useRef<StateSyncManager>()
  const [state, setState] = useState<ExtensionState | undefined>()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Initialize state manager
    stateManager.current = getStateManager()
    
    // Get initial state
    const initialState = stateManager.current.getFullState()
    setState(initialState)
    setIsLoading(false)
    
    // Subscribe to all namespaces
    const unsubscribes: (() => void)[] = []
    
    const namespaces: StateNamespace[] = ['eyeTracker', 'recording', 'user', 'ui', 'system']
    namespaces.forEach(namespace => {
      const unsubscribe = stateManager.current!.subscribe(namespace, () => {
        setState(stateManager.current!.getFullState())
      })
      unsubscribes.push(unsubscribe)
    })
    
    return () => {
      unsubscribes.forEach(fn => fn())
    }
  }, [])

  return [state, isLoading]
}

/**
 * Hook for connection status
 */
export function useConnectionStatus(): {
  isConnected: boolean
  isCalibrated: boolean
  isTracking: boolean
  canRecord: boolean
} {
  const [eyeTracker] = useEyeTrackerState()
  
  return {
    isConnected: eyeTracker?.isConnected || false,
    isCalibrated: eyeTracker?.isCalibrated || false,
    isTracking: eyeTracker?.isTracking || false,
    canRecord: (eyeTracker?.isConnected || false) && 
               (eyeTracker?.isCalibrated || eyeTracker?.isTracking || false)
  }
}

/**
 * Hook for recording status
 */
export function useRecordingStatus(): {
  isRecording: boolean
  sessionId: string | null
  duration: number
  canStart: boolean
} {
  const [recording] = useRecordingState()
  const { canRecord } = useConnectionStatus()
  
  return {
    isRecording: recording?.isRecording || false,
    sessionId: recording?.sessionId || null,
    duration: recording?.duration || 0,
    canStart: canRecord && !recording?.isRecording
  }
}

/**
 * Hook for notifications
 */
export function useNotifications() {
  const [ui, updateUI] = useUIState()
  
  const addNotification = useCallback(async (
    type: 'info' | 'success' | 'warning' | 'error',
    message: string,
    autoClose = true
  ) => {
    const notification = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      message,
      timestamp: Date.now(),
      autoClose
    }
    
    await updateUI({
      notifications: [...(ui?.notifications || []), notification].slice(-50)
    })
    
    if (autoClose) {
      setTimeout(async () => {
        await updateUI({
          notifications: (ui?.notifications || []).filter(n => n.id !== notification.id)
        })
      }, 5000)
    }
  }, [ui, updateUI])
  
  const removeNotification = useCallback(async (id: string) => {
    await updateUI({
      notifications: (ui?.notifications || []).filter(n => n.id !== id)
    })
  }, [ui, updateUI])
  
  const clearNotifications = useCallback(async () => {
    await updateUI({ notifications: [] })
  }, [updateUI])
  
  return {
    notifications: ui?.notifications || [],
    addNotification,
    removeNotification,
    clearNotifications
  }
}

/**
 * Hook to reset state
 */
export function useStateReset() {
  const stateManager = useRef<StateSyncManager>()
  
  useEffect(() => {
    stateManager.current = getStateManager()
  }, [])
  
  const resetState = useCallback(async (namespace?: StateNamespace) => {
    if (stateManager.current) {
      await stateManager.current.resetState(namespace)
    }
  }, [])
  
  return resetState
}

/**
 * Export the state manager for direct access when needed
 */
export { getStateManager }