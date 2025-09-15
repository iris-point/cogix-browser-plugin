/**
 * StateSyncManager - Core state synchronization engine
 * 
 * Handles real-time state synchronization across all Chrome extension contexts
 * using a hybrid approach of message passing for speed and storage for persistence.
 */

import {
  ExtensionState,
  StateNamespace,
  StateListener,
  StateUpdate,
  StateSyncConfig,
  StateMessage,
  StateUpdateMessage,
  StateRequestMessage,
  StateResponseMessage,
  DEFAULT_EXTENSION_STATE
} from './types'

import {
  STORAGE_PREFIX,
  MESSAGE_TYPES,
  PORT_NAME,
  RECONNECT_DELAY,
  MAX_RECONNECT_ATTEMPTS,
  STORAGE_DEBOUNCE_DELAY,
  DEBUG_PREFIX,
  ENABLE_DEBUG_LOGGING
} from './constants'

export class StateSyncManager {
  private state: ExtensionState
  private config: Required<StateSyncConfig>
  private listeners: Map<string, Set<StateListener<any>>>
  private port: chrome.runtime.Port | null = null
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private storageDebounceTimer: NodeJS.Timeout | null = null
  private isInitialized = false
  private pendingUpdates: Map<StateNamespace, any> = new Map()

  constructor(config: StateSyncConfig) {
    this.state = { ...DEFAULT_EXTENSION_STATE }
    this.config = {
      mode: config.mode,
      persistKeys: config.persistKeys || ['eyeTracker', 'recording', 'user'],
      debugMode: config.debugMode || ENABLE_DEBUG_LOGGING,
      syncInterval: config.syncInterval || 1000,
      retryAttempts: config.retryAttempts || MAX_RECONNECT_ATTEMPTS,
      retryDelay: config.retryDelay || RECONNECT_DELAY
    }
    this.listeners = new Map()
    
    this.initialize()
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  private async initialize() {
    this.log('Initializing StateSyncManager in', this.config.mode, 'mode')
    
    try {
      // Load persisted state
      await this.loadPersistedState()
      
      if (this.config.mode === 'master') {
        await this.initializeMaster()
      } else {
        await this.initializeClient()
      }
      
      this.isInitialized = true
      this.log('Initialization complete')
    } catch (error) {
      this.logError('Initialization failed:', error)
      // Retry initialization
      setTimeout(() => this.initialize(), this.config.retryDelay)
    }
  }

  private async initializeMaster() {
    // Set up message listeners for client requests
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this))
    
    // Set up port connections for persistent clients
    chrome.runtime.onConnect.addListener(this.handlePortConnection.bind(this))
    
    // Set up storage change listener for external updates
    chrome.storage.onChanged.addListener(this.handleStorageChange.bind(this))
    
    // Mark system as ready
    await this.updateState('system', { isReady: true, contextValid: true })
  }

  private async initializeClient() {
    // Try to establish port connection with background
    this.connectToMaster()
    
    // Set up message listener for broadcasts
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this))
    
    // Request initial state
    await this.requestStateFromMaster()
  }

  // ============================================================================
  // Master Mode Methods
  // ============================================================================

  private handlePortConnection(port: chrome.runtime.Port) {
    if (port.name !== PORT_NAME) return
    
    this.log('Client connected:', port.sender)
    
    // Send current state to new client
    port.postMessage({
      type: MESSAGE_TYPES.STATE_SYNC,
      data: this.state,
      timestamp: Date.now(),
      source: 'background'
    })
    
    // Handle client messages
    port.onMessage.addListener((msg: StateMessage) => {
      this.handleClientMessage(msg, port)
    })
    
    port.onDisconnect.addListener(() => {
      this.log('Client disconnected:', port.sender)
    })
  }

  private handleClientMessage(msg: StateMessage, port: chrome.runtime.Port) {
    switch (msg.type) {
      case MESSAGE_TYPES.STATE_UPDATE:
        const updateMsg = msg as StateUpdateMessage
        this.handleStateUpdateRequest(updateMsg.namespace, updateMsg.data)
        break
        
      case MESSAGE_TYPES.STATE_REQUEST:
        const requestMsg = msg as StateRequestMessage
        this.handleStateRequest(requestMsg, port)
        break
    }
  }

  private async handleStateUpdateRequest(namespace: StateNamespace, update: any) {
    await this.updateState(namespace, update)
  }

  private handleStateRequest(msg: StateRequestMessage, port: chrome.runtime.Port) {
    const response: StateResponseMessage = {
      type: MESSAGE_TYPES.STATE_RESPONSE,
      data: msg.namespace ? { [msg.namespace]: this.state[msg.namespace] } : this.state,
      requestId: msg.requestId,
      timestamp: Date.now(),
      source: 'background'
    }
    
    port.postMessage(response)
  }

  private broadcastStateChange(namespace: StateNamespace, newState: any, oldState: any, changes: any) {
    const message: StateUpdateMessage = {
      type: MESSAGE_TYPES.STATE_UPDATE,
      namespace,
      data: newState,
      changes,
      timestamp: Date.now(),
      source: 'background'
    }
    
    // Broadcast to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {
            // Ignore tabs without content scripts
          })
        }
      })
    })
    
    // Broadcast to all extension contexts
    chrome.runtime.sendMessage(message).catch(() => {
      // Ignore if no listeners
    })
  }

  // ============================================================================
  // Client Mode Methods
  // ============================================================================

  private connectToMaster() {
    if (this.port || this.reconnectAttempts >= this.config.retryAttempts) {
      return
    }
    
    try {
      this.port = chrome.runtime.connect({ name: PORT_NAME })
      
      this.port.onMessage.addListener((msg: StateMessage) => {
        this.handleMasterMessage(msg)
      })
      
      this.port.onDisconnect.addListener(() => {
        this.log('Disconnected from master, attempting reconnect...')
        this.port = null
        this.scheduleReconnect()
      })
      
      this.reconnectAttempts = 0
      this.log('Connected to master')
    } catch (error) {
      this.logError('Failed to connect to master:', error)
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    
    this.reconnectAttempts++
    
    if (this.reconnectAttempts >= this.config.retryAttempts) {
      this.logError('Max reconnection attempts reached')
      return
    }
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connectToMaster()
    }, this.config.retryDelay * Math.pow(2, Math.min(this.reconnectAttempts - 1, 5)))
  }

  private handleMasterMessage(msg: StateMessage) {
    switch (msg.type) {
      case MESSAGE_TYPES.STATE_SYNC:
        this.state = msg.data
        this.log('Received full state sync')
        break
        
      case MESSAGE_TYPES.STATE_UPDATE:
        const updateMsg = msg as StateUpdateMessage
        this.handleStateUpdate(updateMsg.namespace, updateMsg.data, updateMsg.changes)
        break
        
      case MESSAGE_TYPES.STATE_RESPONSE:
        const responseMsg = msg as StateResponseMessage
        this.handleStateResponse(responseMsg)
        break
    }
  }

  private async requestStateFromMaster(): Promise<void> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId()
      const timeout = setTimeout(() => {
        reject(new Error('State request timeout'))
      }, 5000)
      
      const handler = (msg: any) => {
        if (msg.type === MESSAGE_TYPES.STATE_RESPONSE && msg.requestId === requestId) {
          clearTimeout(timeout)
          chrome.runtime.onMessage.removeListener(handler)
          this.state = { ...this.state, ...msg.data }
          resolve()
        }
      }
      
      chrome.runtime.onMessage.addListener(handler)
      
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.STATE_REQUEST,
        requestId,
        timestamp: Date.now(),
        source: this.getSource()
      }).catch(reject)
    })
  }

  private handleStateResponse(msg: StateResponseMessage) {
    // Update local state with response
    Object.entries(msg.data).forEach(([namespace, value]) => {
      this.state[namespace as StateNamespace] = value
    })
  }

  // ============================================================================
  // Common Methods
  // ============================================================================

  private handleMessage(msg: any, sender: chrome.runtime.MessageSender, sendResponse: Function): boolean | void {
    if (!msg.type || !msg.type.startsWith('STATE_')) return
    
    if (this.config.mode === 'master') {
      // Handle as master
      switch (msg.type) {
        case MESSAGE_TYPES.STATE_UPDATE:
          this.handleStateUpdateRequest(msg.namespace, msg.data)
          sendResponse({ success: true })
          break
          
        case MESSAGE_TYPES.STATE_REQUEST:
          sendResponse({
            type: MESSAGE_TYPES.STATE_RESPONSE,
            data: msg.namespace ? { [msg.namespace]: this.state[msg.namespace] } : this.state,
            requestId: msg.requestId
          })
          break
      }
    } else {
      // Handle as client
      if (msg.type === MESSAGE_TYPES.STATE_UPDATE && msg.source === 'background') {
        this.handleStateUpdate(msg.namespace, msg.data, msg.changes)
      }
    }
    
    return true // Keep channel open for async response
  }

  private handleStateUpdate(namespace: StateNamespace, newState: any, changes: any) {
    const oldState = this.state[namespace]
    this.state[namespace] = newState
    
    // Notify listeners
    this.notifyListeners(namespace, newState, oldState, changes)
  }

  private handleStorageChange(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) {
    if (areaName !== 'local') return
    
    Object.entries(changes).forEach(([key, change]) => {
      if (key.startsWith(STORAGE_PREFIX)) {
        const namespace = key.replace(STORAGE_PREFIX, '') as StateNamespace
        if (this.isValidNamespace(namespace)) {
          // Only update if we're the master and the change came from outside
          if (this.config.mode === 'master' && !this.pendingUpdates.has(namespace)) {
            this.handleStateUpdate(namespace, change.newValue, {})
          }
        }
      }
    })
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get current state for a namespace
   */
  public getState<K extends StateNamespace>(namespace: K): ExtensionState[K] {
    return this.state[namespace]
  }

  /**
   * Get entire state snapshot
   */
  public getFullState(): ExtensionState {
    return { ...this.state }
  }

  /**
   * Update state for a namespace
   */
  public async updateState<K extends StateNamespace>(
    namespace: K,
    update: StateUpdate<K>
  ): Promise<void> {
    const oldState = this.state[namespace]
    const newState = { ...oldState, ...update }
    const changes = update
    
    if (this.config.mode === 'master') {
      // Update local state
      this.state[namespace] = newState
      
      // Persist if configured
      if (this.config.persistKeys.includes(namespace)) {
        this.persistState(namespace, newState)
      }
      
      // Broadcast to all clients
      this.broadcastStateChange(namespace, newState, oldState, changes)
      
      // Notify local listeners
      this.notifyListeners(namespace, newState, oldState, changes)
    } else {
      // Send update request to master
      if (this.port) {
        this.port.postMessage({
          type: MESSAGE_TYPES.STATE_UPDATE,
          namespace,
          data: update,
          timestamp: Date.now(),
          source: this.getSource()
        })
      } else {
        // Fallback to message
        await chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.STATE_UPDATE,
          namespace,
          data: update,
          timestamp: Date.now(),
          source: this.getSource()
        })
      }
    }
  }

  /**
   * Subscribe to state changes
   */
  public subscribe<K extends StateNamespace>(
    namespace: K,
    listener: StateListener<K>
  ): () => void {
    const key = namespace as string
    
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set())
    }
    
    this.listeners.get(key)!.add(listener)
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(key)
      if (listeners) {
        listeners.delete(listener)
        if (listeners.size === 0) {
          this.listeners.delete(key)
        }
      }
    }
  }

  /**
   * Reset state to defaults
   */
  public async resetState(namespace?: StateNamespace): Promise<void> {
    if (namespace) {
      await this.updateState(namespace, DEFAULT_EXTENSION_STATE[namespace] as any)
    } else {
      // Reset all namespaces
      for (const ns of Object.keys(DEFAULT_EXTENSION_STATE) as StateNamespace[]) {
        await this.updateState(ns, DEFAULT_EXTENSION_STATE[ns] as any)
      }
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private notifyListeners(namespace: StateNamespace, newState: any, oldState: any, changes: any) {
    const listeners = this.listeners.get(namespace as string)
    
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(newState, oldState, changes)
        } catch (error) {
          this.logError('Listener error:', error)
        }
      })
    }
  }

  private async persistState(namespace: StateNamespace, state: any): Promise<void> {
    // Mark as pending to avoid re-processing storage change
    this.pendingUpdates.set(namespace, state)
    
    // Debounce storage writes
    if (this.storageDebounceTimer) {
      clearTimeout(this.storageDebounceTimer)
    }
    
    this.storageDebounceTimer = setTimeout(async () => {
      try {
        await chrome.storage.local.set({
          [STORAGE_PREFIX + namespace]: state
        })
        this.pendingUpdates.delete(namespace)
      } catch (error) {
        this.logError('Failed to persist state:', error)
      }
    }, STORAGE_DEBOUNCE_DELAY)
  }

  private async loadPersistedState(): Promise<void> {
    try {
      const keys = this.config.persistKeys.map(k => STORAGE_PREFIX + k)
      const stored = await chrome.storage.local.get(keys)
      
      Object.entries(stored).forEach(([key, value]) => {
        const namespace = key.replace(STORAGE_PREFIX, '') as StateNamespace
        if (this.isValidNamespace(namespace)) {
          this.state[namespace] = { ...DEFAULT_EXTENSION_STATE[namespace], ...value }
        }
      })
    } catch (error) {
      this.logError('Failed to load persisted state:', error)
    }
  }

  private isValidNamespace(namespace: string): namespace is StateNamespace {
    return namespace in DEFAULT_EXTENSION_STATE
  }

  private getSource(): 'background' | 'popup' | 'content' | 'options' {
    if (typeof window === 'undefined') return 'background'
    if (window.location.pathname.includes('popup')) return 'popup'
    if (window.location.pathname.includes('options')) return 'options'
    return 'content'
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private log(...args: any[]) {
    if (this.config.debugMode) {
      console.log(DEBUG_PREFIX, `[${this.config.mode}]`, ...args)
    }
  }

  private logError(...args: any[]) {
    console.error(DEBUG_PREFIX, `[${this.config.mode}]`, ...args)
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  public destroy() {
    if (this.port) {
      this.port.disconnect()
      this.port = null
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    
    if (this.storageDebounceTimer) {
      clearTimeout(this.storageDebounceTimer)
      this.storageDebounceTimer = null
    }
    
    this.listeners.clear()
    this.pendingUpdates.clear()
  }
}