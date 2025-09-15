/**
 * Professional Chrome Extension State Synchronization Manager
 * 
 * This implements the recommended pattern for real-time state sync across
 * all extension contexts (background, popup, content scripts, options page)
 * 
 * Key Features:
 * - Background script as single source of truth
 * - Real-time updates via message passing
 * - Automatic reconnection handling
 * - Type-safe state management
 * - Offline fallback to storage
 */

import { DeviceStatus } from '@iris-point/eye-tracking-core'

// ============================================================================
// Types
// ============================================================================

export interface SyncedState {
  eyeTracker: {
    status: DeviceStatus
    isConnected: boolean
    isCalibrated: boolean
    isTracking: boolean
    lastUpdate: number
    wsUrl: string
  }
  recording: {
    isRecording: boolean
    sessionId: string | null
    projectId: string | null
    startTime: number | null
  }
  user: {
    isAuthenticated: boolean
    userId: string | null
    selectedProject: any | null
  }
}

type StateUpdateListener<K extends keyof SyncedState> = (
  newValue: SyncedState[K],
  oldValue: SyncedState[K]
) => void

type StateChangeMessage = {
  type: 'STATE_CHANGE'
  namespace: keyof SyncedState
  newValue: any
  oldValue: any
}

// ============================================================================
// State Sync Manager (Use in all contexts)
// ============================================================================

export class StateSyncManager {
  private listeners = new Map<string, Set<StateUpdateListener<any>>>()
  private state: Partial<SyncedState> = {}
  private isBackgroundScript = false
  private port: chrome.runtime.Port | null = null
  private reconnectTimer: NodeJS.Timeout | null = null

  constructor() {
    this.detectContext()
    this.initialize()
  }

  private detectContext() {
    // Check if we're in the background script
    try {
      this.isBackgroundScript = 
        typeof chrome !== 'undefined' &&
        chrome.runtime &&
        chrome.runtime.getManifest &&
        !chrome.tabs &&
        !document
    } catch {
      this.isBackgroundScript = false
    }
  }

  private async initialize() {
    if (this.isBackgroundScript) {
      await this.initializeAsBackground()
    } else {
      await this.initializeAsClient()
    }
  }

  // ============================================================================
  // Background Script Mode (Source of Truth)
  // ============================================================================

  private async initializeAsBackground() {
    console.log('🎯 StateSyncManager: Initializing as BACKGROUND (source of truth)')
    
    // Load initial state from storage
    await this.loadFromStorage()
    
    // Listen for client connections
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name !== 'state-sync') return
      
      console.log('📡 New client connected:', port.sender)
      
      // Send current state to new client
      port.postMessage({
        type: 'INITIAL_STATE',
        state: this.state
      })
      
      // Listen for state update requests from clients
      port.onMessage.addListener((msg) => {
        if (msg.type === 'UPDATE_STATE') {
          this.updateState(msg.namespace, msg.value)
        }
      })
    })
    
    // Broadcast state changes to all connected clients
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'GET_STATE') {
        sendResponse(this.state)
        return true
      }
      
      if (request.type === 'UPDATE_STATE') {
        const oldValue = this.state[request.namespace as keyof SyncedState]
        this.state[request.namespace as keyof SyncedState] = request.value
        
        // Broadcast to all tabs and extension pages
        this.broadcastStateChange(request.namespace, request.value, oldValue)
        
        // Persist to storage
        this.saveToStorage(request.namespace, request.value)
        
        sendResponse({ success: true })
        return true
      }
    })
  }

  private broadcastStateChange(namespace: string, newValue: any, oldValue: any) {
    // Broadcast to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'STATE_CHANGE',
            namespace,
            newValue,
            oldValue
          } as StateChangeMessage).catch(() => {
            // Tab doesn't have content script, ignore
          })
        }
      })
    })
    
    // Broadcast to all extension views (popup, options, etc)
    chrome.runtime.sendMessage({
      type: 'STATE_CHANGE',
      namespace,
      newValue,
      oldValue
    } as StateChangeMessage).catch(() => {
      // No listeners, ignore
    })
  }

  // ============================================================================
  // Client Mode (Popup, Content Scripts, Options Page)
  // ============================================================================

  private async initializeAsClient() {
    console.log('📱 StateSyncManager: Initializing as CLIENT')
    
    // Try to connect to background script
    this.connectToBackground()
    
    // Listen for state changes from background
    chrome.runtime.onMessage.addListener((message: StateChangeMessage) => {
      if (message.type === 'STATE_CHANGE') {
        this.handleStateChange(message.namespace, message.newValue, message.oldValue)
      }
    })
    
    // Load initial state
    await this.loadInitialState()
  }

  private connectToBackground() {
    try {
      // Create persistent connection to background
      this.port = chrome.runtime.connect({ name: 'state-sync' })
      
      this.port.onMessage.addListener((msg) => {
        if (msg.type === 'INITIAL_STATE') {
          this.state = msg.state
          console.log('📥 Received initial state:', this.state)
        }
      })
      
      this.port.onDisconnect.addListener(() => {
        console.warn('🔌 Disconnected from background, attempting reconnect...')
        this.port = null
        this.scheduleReconnect()
      })
      
      console.log('✅ Connected to background script')
    } catch (error) {
      console.error('❌ Failed to connect to background:', error)
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connectToBackground()
    }, 1000)
  }

  private async loadInitialState() {
    try {
      // Request current state from background
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' })
      if (response) {
        this.state = response
        console.log('📊 Loaded state from background:', this.state)
      }
    } catch (error) {
      console.warn('⚠️ Could not load state from background, using storage fallback')
      await this.loadFromStorage()
    }
  }

  private handleStateChange(namespace: string, newValue: any, oldValue: any) {
    this.state[namespace as keyof SyncedState] = newValue
    
    // Notify local listeners
    const listeners = this.listeners.get(namespace)
    if (listeners) {
      listeners.forEach(listener => listener(newValue, oldValue))
    }
  }

  // ============================================================================
  // Storage Operations (Fallback & Persistence)
  // ============================================================================

  private async loadFromStorage() {
    const keys = ['eyeTracker', 'recording', 'user']
    const result = await chrome.storage.local.get(keys)
    
    keys.forEach(key => {
      if (result[key]) {
        this.state[key as keyof SyncedState] = result[key]
      }
    })
  }

  private async saveToStorage(namespace: string, value: any) {
    await chrome.storage.local.set({ [namespace]: value })
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get current value of a state namespace
   */
  get<K extends keyof SyncedState>(namespace: K): SyncedState[K] | undefined {
    return this.state[namespace]
  }

  /**
   * Update state (will sync across all contexts)
   */
  async set<K extends keyof SyncedState>(
    namespace: K,
    value: SyncedState[K]
  ): Promise<void> {
    const oldValue = this.state[namespace]
    
    if (this.isBackgroundScript) {
      // Direct update in background
      this.state[namespace] = value
      this.broadcastStateChange(namespace, value, oldValue)
      await this.saveToStorage(namespace, value)
    } else {
      // Request update from background
      try {
        await chrome.runtime.sendMessage({
          type: 'UPDATE_STATE',
          namespace,
          value
        })
      } catch (error) {
        console.error('Failed to update state:', error)
        // Fallback: update local state and storage
        this.state[namespace] = value
        await this.saveToStorage(namespace, value)
      }
    }
    
    // Notify local listeners
    const listeners = this.listeners.get(namespace)
    if (listeners) {
      listeners.forEach(listener => listener(value, oldValue))
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe<K extends keyof SyncedState>(
    namespace: K,
    listener: StateUpdateListener<K>
  ): () => void {
    if (!this.listeners.has(namespace)) {
      this.listeners.set(namespace, new Set())
    }
    
    const listeners = this.listeners.get(namespace)!
    listeners.add(listener)
    
    // Return unsubscribe function
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) {
        this.listeners.delete(namespace)
      }
    }
  }

  /**
   * Batch update multiple namespaces
   */
  async setBatch(updates: Partial<SyncedState>): Promise<void> {
    const promises = Object.entries(updates).map(([namespace, value]) =>
      this.set(namespace as keyof SyncedState, value)
    )
    await Promise.all(promises)
  }

  /**
   * Get entire state snapshot
   */
  getSnapshot(): Partial<SyncedState> {
    return { ...this.state }
  }

  /**
   * Clear all state
   */
  async clear(): Promise<void> {
    const emptyState: SyncedState = {
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
      },
      user: {
        isAuthenticated: false,
        userId: null,
        selectedProject: null
      }
    }
    
    await this.setBatch(emptyState)
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let instance: StateSyncManager | null = null

export function getStateSyncManager(): StateSyncManager {
  if (!instance) {
    instance = new StateSyncManager()
  }
  return instance
}

// For convenience, export a default instance
export const stateSync = getStateSyncManager()