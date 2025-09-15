/**
 * Centralized Eye Tracker State Management
 * Single source of truth using Chrome Storage with real-time sync
 */

import { DeviceStatus } from '@iris-point/eye-tracking-core'

export interface EyeTrackerState {
  // Core state
  status: DeviceStatus
  isConnected: boolean
  isCalibrated: boolean
  isTracking: boolean
  
  // Metadata
  lastUpdate: number
  calibrationTimestamp?: number
  wsUrl: string
  
  // Derived states (computed from core state)
  canRecord: boolean  // true if connected AND (calibrated OR tracking)
  displayStatus: string // Human-readable status
}

// Default state
const DEFAULT_STATE: EyeTrackerState = {
  status: DeviceStatus.DISCONNECTED,
  isConnected: false,
  isCalibrated: false,
  isTracking: false,
  lastUpdate: Date.now(),
  wsUrl: 'wss://127.0.0.1:8443',
  canRecord: false,
  displayStatus: 'Not connected'
}

// Storage key
const STORAGE_KEY = 'eyeTrackerState'

/**
 * Eye Tracker State Manager
 * Handles all state operations with Chrome storage
 */
export class EyeTrackerStateManager {
  private static instance: EyeTrackerStateManager | null = null
  private listeners: Set<(state: EyeTrackerState) => void> = new Set()
  private currentState: EyeTrackerState = DEFAULT_STATE
  private storageListener: ((changes: any, areaName: string) => void) | null = null
  
  private constructor() {
    this.initialize()
  }
  
  static getInstance(): EyeTrackerStateManager {
    if (!EyeTrackerStateManager.instance) {
      EyeTrackerStateManager.instance = new EyeTrackerStateManager()
    }
    return EyeTrackerStateManager.instance
  }
  
  private async initialize() {
    // Check if chrome.storage is available
    if (typeof chrome === 'undefined' || !chrome.storage) {
      console.warn('[StateManager] Chrome storage API not available yet')
      this.currentState = DEFAULT_STATE
      return
    }
    
    try {
      // Load initial state
      const stored = await this.loadState()
      this.currentState = stored
      
      // Set up storage listener for real-time sync
      this.storageListener = (changes, areaName) => {
        console.log('🔔 [StateManager] Storage change detected:', { areaName, hasStateChange: !!changes[STORAGE_KEY] })
        if (areaName === 'local' && changes[STORAGE_KEY]) {
          const newState = changes[STORAGE_KEY].newValue || DEFAULT_STATE
          const oldState = changes[STORAGE_KEY].oldValue
          console.log('🔄 [StateManager] State changed from:', oldState)
          console.log('🔄 [StateManager] State changed to:', newState)
          this.currentState = newState
          this.notifyListeners(newState)
        }
      }
      
      chrome.storage.onChanged.addListener(this.storageListener)
    } catch (error) {
      console.error('[StateManager] Failed to initialize:', error)
      this.currentState = DEFAULT_STATE
    }
  }
  
  /**
   * Load state from storage
   */
  private async loadState(): Promise<EyeTrackerState> {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        const state = result[STORAGE_KEY] || DEFAULT_STATE
        resolve(state)
      })
    })
  }
  
  /**
   * Get current state synchronously (from cache)
   */
  getState(): EyeTrackerState {
    return this.currentState
  }
  
  /**
   * Get current state asynchronously (from storage)
   */
  async getStateAsync(): Promise<EyeTrackerState> {
    return this.loadState()
  }
  
  /**
   * Update state (partial update supported)
   * This is the ONLY way to update state - ensures single source of truth
   */
  async updateState(updates: Partial<EyeTrackerState>): Promise<void> {
    console.log('📝 [StateManager] updateState called with:', updates)
    const currentState = await this.loadState()
    console.log('📖 [StateManager] Current state:', currentState)
    
    // Merge updates
    const newState: EyeTrackerState = {
      ...currentState,
      ...updates,
      lastUpdate: Date.now()
    }
    
    // Compute derived states
    newState.canRecord = newState.isConnected && (newState.isCalibrated || newState.isTracking)
    newState.displayStatus = this.computeDisplayStatus(newState)
    
    // Validate state consistency
    this.validateState(newState)
    
    console.log('💾 [StateManager] Saving new state:', newState)
    
    // Save to storage (this will trigger listeners)
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: newState }, () => {
        console.log('✅ [StateManager] State saved successfully')
        resolve()
      })
    })
    
    // Update cache
    this.currentState = newState
    
    // Manually notify listeners since storage change might not fire immediately
    this.notifyListeners(newState)
  }
  
  /**
   * Handle connection state change
   */
  async setConnected(isConnected: boolean, status?: DeviceStatus): Promise<void> {
    console.log(`🔌 [StateManager] setConnected(${isConnected}, ${status})`)
    const updates: Partial<EyeTrackerState> = {
      isConnected,
      status: status || (isConnected ? DeviceStatus.CONNECTED : DeviceStatus.DISCONNECTED)
    }
    
    // If disconnecting, reset dependent states
    if (!isConnected) {
      console.log('🔌 [StateManager] Disconnecting - resetting calibration and tracking')
      updates.isCalibrated = false
      updates.isTracking = false
      updates.calibrationTimestamp = undefined
    }
    
    await this.updateState(updates)
  }
  
  /**
   * Handle calibration complete
   */
  async setCalibrated(isCalibrated: boolean): Promise<void> {
    console.log(`✅ [StateManager] setCalibrated(${isCalibrated})`)
    const updates: Partial<EyeTrackerState> = {
      isCalibrated
    }
    
    if (isCalibrated) {
      console.log('✅ [StateManager] Calibration complete - setting tracking to true')
      updates.calibrationTimestamp = Date.now()
      // Calibration complete usually means we start tracking
      updates.isTracking = true
      updates.status = DeviceStatus.TRACKING
    }
    
    await this.updateState(updates)
  }
  
  /**
   * Handle tracking state change
   */
  async setTracking(isTracking: boolean): Promise<void> {
    await this.updateState({
      isTracking,
      status: isTracking ? DeviceStatus.TRACKING : DeviceStatus.CONNECTED
    })
  }
  
  /**
   * Handle device status change
   */
  async setStatus(status: DeviceStatus): Promise<void> {
    const updates: Partial<EyeTrackerState> = { status }
    
    // Update related flags based on status
    switch (status) {
      case DeviceStatus.DISCONNECTED:
        updates.isConnected = false
        updates.isCalibrated = false
        updates.isTracking = false
        break
      case DeviceStatus.CONNECTED:
        updates.isConnected = true
        updates.isTracking = false
        break
      case DeviceStatus.TRACKING:
        updates.isConnected = true
        updates.isTracking = true
        // If tracking, we must be calibrated
        updates.isCalibrated = true
        break
      case DeviceStatus.CALIBRATING:
        updates.isConnected = true
        break
    }
    
    await this.updateState(updates)
  }
  
  /**
   * Reset state to defaults
   */
  async reset(): Promise<void> {
    await this.updateState(DEFAULT_STATE)
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: EyeTrackerState) => void): () => void {
    this.listeners.add(listener)
    
    // Immediately call with current state
    listener(this.currentState)
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener)
    }
  }
  
  /**
   * Notify all listeners of state change
   */
  private notifyListeners(state: EyeTrackerState) {
    this.listeners.forEach(listener => {
      try {
        listener(state)
      } catch (error) {
        console.error('[StateManager] Listener error:', error)
      }
    })
  }
  
  /**
   * Validate state consistency
   */
  private validateState(state: EyeTrackerState) {
    // Can't be tracking without being connected
    if (state.isTracking && !state.isConnected) {
      console.warn('[StateManager] Invalid state: tracking without connection')
      state.isTracking = false
    }
    
    // Can't be calibrated without being connected
    if (state.isCalibrated && !state.isConnected) {
      console.warn('[StateManager] Invalid state: calibrated without connection')
      state.isCalibrated = false
    }
    
    // If tracking, must be calibrated
    if (state.isTracking && !state.isCalibrated) {
      console.log('[StateManager] Auto-fixing: tracking implies calibrated')
      state.isCalibrated = true
    }
    
    // Status should match flags
    if (!state.isConnected && state.status !== DeviceStatus.DISCONNECTED && state.status !== DeviceStatus.ERROR) {
      console.warn('[StateManager] Status mismatch: fixing to DISCONNECTED')
      state.status = DeviceStatus.DISCONNECTED
    }
  }
  
  /**
   * Compute human-readable display status
   */
  private computeDisplayStatus(state: EyeTrackerState): string {
    if (!state.isConnected) return 'Not connected'
    if (state.isTracking) return 'Calibrated & tracking'
    if (state.isCalibrated) return 'Calibrated (not tracking)'
    if (state.status === DeviceStatus.CALIBRATING) return 'Calibrating...'
    return 'Connected (not calibrated)'
  }
  
  /**
   * Cleanup
   */
  destroy() {
    if (this.storageListener) {
      chrome.storage.onChanged.removeListener(this.storageListener)
    }
    this.listeners.clear()
  }
}

// Export a getter function for lazy initialization
// This prevents initialization errors when Chrome APIs aren't ready yet
export const getEyeTrackerState = () => EyeTrackerStateManager.getInstance()

// For backward compatibility, export a proxy that initializes on first access
export const eyeTrackerState = new Proxy({} as EyeTrackerStateManager, {
  get(target, prop) {
    const instance = EyeTrackerStateManager.getInstance()
    return instance[prop as keyof EyeTrackerStateManager]
  }
})