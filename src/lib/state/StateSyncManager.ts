/**
 * StateSyncManager - Core state synchronization engine (FIXED VERSION)
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
  private messageHandler: ((msg: any, sender: any, sendResponse: any) => void) | null = null
  private portHandler: ((port: chrome.runtime.Port) => void) | null = null
  private storageHandler: ((changes: any, areaName: string) => void) | null = null

  constructor(config: StateSyncConfig) {
    this.state = this.createInitialState()
    this.config = {
      mode: config.mode,
      persistKeys: config.persistKeys || ['eyeTracker', 'recording', 'user'],
      debugMode: config.debugMode ?? ENABLE_DEBUG_LOGGING,
      syncInterval: config.syncInterval || 1000,
      retryAttempts: config.retryAttempts || MAX_RECONNECT_ATTEMPTS,
      retryDelay: config.retryDelay || RECONNECT_DELAY
    }
    this.listeners = new Map()
    
    // Delay initialization to ensure Chrome APIs are ready
    if (this.isChromeContextValid()) {
      this.initialize()
    } else {
      // Wait for Chrome APIs to be available
      const checkInterval = setInterval(() => {
        if (this.isChromeContextValid()) {
          clearInterval(checkInterval)
          this.initialize()
        }
      }, 100)
    }
  }

  // ============================================================================
  // Chrome Context Validation
  // ============================================================================

  private isChromeContextValid(): boolean {
    try {
      return typeof chrome !== 'undefined' && 
             chrome.runtime && 
             chrome.runtime.id !== undefined
    } catch {
      return false
    }
  }

  private isExtensionContextInvalidated(): boolean {
    try {
      // This will throw if context is invalidated
      chrome.runtime.getManifest()
      return false
    } catch (error: any) {
      return error?.message?.includes('Extension context invalidated') ?? false
    }
  }

  private detectEnvironment(): 'background' | 'popup' | 'content' | 'options' | 'unknown' {
    try {
      // Check if we're in a service worker (MV3 background)
      if (typeof self !== 'undefined' && 'ServiceWorkerGlobalScope' in self) {
        return 'background'
      }
      
      // Check if we have a window object
      if (typeof window !== 'undefined' && window.location) {
        const url = window.location.href
        if (url.includes('popup.html')) return 'popup'
        if (url.includes('options.html')) return 'options'
        if (url.startsWith('chrome-extension://')) {
          // Extension page but not popup/options
          return 'background'
        }
        // Regular web page
        return 'content'
      }
      
      // Fallback: check for document (content script indicator)
      if (typeof document !== 'undefined') {
        return 'content'
      }
      
      return 'unknown'
    } catch {
      return 'unknown'
    }
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  private createInitialState(): ExtensionState {
    const state = { ...DEFAULT_EXTENSION_STATE }
    
    // Update version if Chrome API is available
    try {
      if (this.isChromeContextValid()) {
        state.system.version = chrome.runtime.getManifest().version
      }
    } catch {
      // Keep default version
    }
    
    return state
  }

  private async initialize() {
    if (this.isInitialized) return
    
    this.log('Initializing StateSyncManager in', this.config.mode, 'mode')
    this.log('Environment detected:', this.detectEnvironment())
    
    try {
      // Check if context is still valid
      if (this.isExtensionContextInvalidated()) {
        this.logError('Extension context invalidated, cannot initialize')
        return
      }
      
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
      
      // Only retry if context is still valid
      if (!this.isExtensionContextInvalidated()) {
        setTimeout(() => this.initialize(), this.config.retryDelay)
      }
    }
  }

  private async initializeMaster() {
    try {
      // Create bound handlers to maintain context
      this.messageHandler = this.handleMessage.bind(this)
      this.portHandler = this.handlePortConnection.bind(this)
      this.storageHandler = this.handleStorageChange.bind(this)
      
      // Set up message listeners for client requests
      chrome.runtime.onMessage.addListener(this.messageHandler)
      
      // Set up port connections for persistent clients
      chrome.runtime.onConnect.addListener(this.portHandler)
      
      // Set up storage change listener for external updates
      chrome.storage.onChanged.addListener(this.storageHandler)
      
      // Mark system as ready
      await this.updateState('system', { isReady: true, contextValid: true })
      
      this.log('Master initialization complete')
    } catch (error) {
      this.logError('Master initialization error:', error)
      throw error
    }
  }

  private async initializeClient() {
    try {
      // Set up message listener for broadcasts
      this.messageHandler = this.handleMessage.bind(this)
      chrome.runtime.onMessage.addListener(this.messageHandler)
      
      // Try to establish port connection with background
      this.connectToMaster()
      
      // Request initial state with timeout
      const stateLoaded = await this.requestStateFromMaster().catch(error => {
        this.logError('Failed to load initial state from master:', error)
        return false
      })
      
      if (!stateLoaded) {
        // Fallback: try loading from storage
        this.log('Using storage fallback for initial state')
        await this.loadPersistedState()
      }
      
      this.log('Client initialization complete')
    } catch (error) {
      this.logError('Client initialization error:', error)
      throw error
    }
  }

  // ============================================================================
  // Master Mode Methods
  // ============================================================================

  private handlePortConnection(port: chrome.runtime.Port) {
    if (port.name !== PORT_NAME) return
    
    this.log('Client connected:', port.sender?.tab?.id || 'extension page')
    
    // Send current state to new client
    try {
      port.postMessage({
        type: MESSAGE_TYPES.STATE_SYNC,
        data: this.state,
        timestamp: Date.now(),
        source: 'background'
      })
    } catch (error) {
      this.logError('Failed to send initial state to client:', error)
    }
    
    // Handle client messages
    port.onMessage.addListener((msg: StateMessage) => {
      try {
        this.handleClientMessage(msg, port)
      } catch (error) {
        this.logError('Error handling client message:', error)
      }
    })
    
    port.onDisconnect.addListener(() => {
      this.log('Client disconnected:', port.sender?.tab?.id || 'extension page')
      // Check for Chrome runtime errors
      if (chrome.runtime.lastError) {
        this.logError('Port disconnect error:', chrome.runtime.lastError)
      }
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
    try {
      const response: StateResponseMessage = {
        type: MESSAGE_TYPES.STATE_RESPONSE,
        data: msg.namespace ? { [msg.namespace]: this.state[msg.namespace] } : this.state,
        requestId: msg.requestId,
        timestamp: Date.now(),
        source: 'background'
      }
      
      port.postMessage(response)
    } catch (error) {
      this.logError('Failed to send state response:', error)
    }
  }

  private async broadcastStateChange(namespace: StateNamespace, newState: any, oldState: any, changes: any) {
    const message: StateUpdateMessage = {
      type: MESSAGE_TYPES.STATE_UPDATE,
      namespace,
      data: newState,
      changes,
      timestamp: Date.now(),
      source: 'background'
    }
    
    // Broadcast to all tabs (with error handling)
    try {
      const tabs = await chrome.tabs.query({})
      
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {
            // Ignore tabs without content scripts
          })
        }
      }
    } catch (error) {
      this.logError('Failed to broadcast to tabs:', error)
    }
    
    // Broadcast to all extension contexts (with error handling)
    try {
      await chrome.runtime.sendMessage(message)
    } catch (error) {
      // This is expected if there are no other extension pages open
      // Only log in debug mode
      if (this.config.debugMode) {
        this.log('No extension listeners for broadcast (this is normal)')
      }
    }
  }

  // ============================================================================
  // Client Mode Methods
  // ============================================================================

  private connectToMaster() {
    if (this.port || this.reconnectAttempts >= this.config.retryAttempts) {
      return
    }
    
    try {
      // Check if runtime is still valid
      if (!this.isChromeContextValid() || this.isExtensionContextInvalidated()) {
        this.logError('Cannot connect: extension context invalid')
        return
      }
      
      this.port = chrome.runtime.connect({ name: PORT_NAME })
      
      this.port.onMessage.addListener((msg: StateMessage) => {
        try {
          this.handleMasterMessage(msg)
        } catch (error) {
          this.logError('Error handling master message:', error)
        }
      })
      
      this.port.onDisconnect.addListener(() => {
        this.log('Disconnected from master')
        this.port = null
        
        // Check if disconnection was due to context invalidation
        if (this.isExtensionContextInvalidated()) {
          this.logError('Extension context invalidated, stopping reconnection attempts')
          return
        }
        
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
    
    // Exponential backoff with jitter
    const delay = this.config.retryDelay * Math.pow(2, Math.min(this.reconnectAttempts - 1, 5))
    const jitter = Math.random() * 1000 // Add up to 1 second of jitter
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connectToMaster()
    }, delay + jitter)
  }

  private handleMasterMessage(msg: StateMessage) {
    switch (msg.type) {
      case MESSAGE_TYPES.STATE_SYNC:
        this.state = msg.data
        this.log('Received full state sync')
        // Notify all listeners of the sync
        for (const namespace of Object.keys(this.state) as StateNamespace[]) {
          this.notifyListeners(namespace, this.state[namespace], this.state[namespace], {})
        }
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

  private async requestStateFromMaster(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId()
      const timeout = setTimeout(() => {
        chrome.runtime.onMessage.removeListener(handler)
        reject(new Error('State request timeout'))
      }, 5000)
      
      const handler = (msg: any) => {
        if (msg.type === MESSAGE_TYPES.STATE_RESPONSE && msg.requestId === requestId) {
          clearTimeout(timeout)
          chrome.runtime.onMessage.removeListener(handler)
          this.state = { ...this.state, ...msg.data }
          resolve(true)
        }
      }
      
      chrome.runtime.onMessage.addListener(handler)
      
      // Check if we can send messages
      if (!this.isChromeContextValid()) {
        clearTimeout(timeout)
        chrome.runtime.onMessage.removeListener(handler)
        reject(new Error('Chrome context not valid'))
        return
      }
      
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.STATE_REQUEST,
        requestId,
        timestamp: Date.now(),
        source: this.getSource()
      }).catch(error => {
        clearTimeout(timeout)
        chrome.runtime.onMessage.removeListener(handler)
        reject(error)
      })
    })
  }

  private handleStateResponse(msg: StateResponseMessage) {
    // Update local state with response
    Object.entries(msg.data).forEach(([namespace, value]) => {
      const ns = namespace as StateNamespace
      const oldState = this.state[ns]
      this.state[ns] = value as any
      this.notifyListeners(ns, value, oldState, {})
    })
  }

  // ============================================================================
  // Common Methods
  // ============================================================================

  private handleMessage(msg: any, sender: chrome.runtime.MessageSender, sendResponse: Function): boolean | void {
    if (!msg.type || !msg.type.startsWith('STATE_')) return
    
    try {
      if (this.config.mode === 'master') {
        // Handle as master
        switch (msg.type) {
          case MESSAGE_TYPES.STATE_UPDATE:
            this.handleStateUpdateRequest(msg.namespace, msg.data)
            sendResponse({ success: true })
            break
            
          case MESSAGE_TYPES.STATE_REQUEST:
            const responseData = msg.namespace 
              ? { [msg.namespace]: this.state[msg.namespace] } 
              : this.state
            
            sendResponse({
              type: MESSAGE_TYPES.STATE_RESPONSE,
              data: responseData,
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
    } catch (error) {
      this.logError('Error handling message:', error)
      sendResponse({ error: error.message })
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
    // Validate context before updating
    if (!this.isChromeContextValid()) {
      this.logError('Cannot update state: Chrome context invalid')
      return
    }
    
    const oldState = this.state[namespace]
    const newState = { ...oldState, ...update, lastUpdate: Date.now() } as ExtensionState[K]
    const changes = update
    
    if (this.config.mode === 'master') {
      // Update local state
      this.state[namespace] = newState
      
      // Persist if configured
      if (this.config.persistKeys.includes(namespace)) {
        await this.persistState(namespace, newState)
      }
      
      // Broadcast to all clients
      await this.broadcastStateChange(namespace, newState, oldState, changes)
      
      // Notify local listeners
      this.notifyListeners(namespace, newState, oldState, changes)
    } else {
      // Send update request to master
      if (this.port && this.port.sender) {
        try {
          this.port.postMessage({
            type: MESSAGE_TYPES.STATE_UPDATE,
            namespace,
            data: update,
            timestamp: Date.now(),
            source: this.getSource()
          })
        } catch (error) {
          this.logError('Failed to send update via port:', error)
          // Fallback to message
          await this.sendUpdateViaMessage(namespace, update)
        }
      } else {
        // Fallback to message
        await this.sendUpdateViaMessage(namespace, update)
      }
    }
  }

  private async sendUpdateViaMessage<K extends StateNamespace>(
    namespace: K,
    update: StateUpdate<K>
  ): Promise<void> {
    try {
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.STATE_UPDATE,
        namespace,
        data: update,
        timestamp: Date.now(),
        source: this.getSource()
      })
    } catch (error) {
      this.logError('Failed to send update via message:', error)
      
      // Last resort: update local state and persist
      const newState = { ...this.state[namespace], ...update }
      this.state[namespace] = newState
      await this.persistState(namespace, newState)
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
    
    // Immediately call with current state
    listener(this.state[namespace], this.state[namespace], {})
    
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
      } catch (error) {
        this.logError('Failed to persist state:', error)
      } finally {
        this.pendingUpdates.delete(namespace)
      }
    }, STORAGE_DEBOUNCE_DELAY)
  }

  private async loadPersistedState(): Promise<void> {
    try {
      if (!this.isChromeContextValid()) {
        this.log('Cannot load persisted state: Chrome context not valid')
        return
      }
      
      const keys = this.config.persistKeys.map(k => STORAGE_PREFIX + k)
      const stored = await chrome.storage.local.get(keys)
      
      Object.entries(stored).forEach(([key, value]) => {
        const namespace = key.replace(STORAGE_PREFIX, '') as StateNamespace
        if (this.isValidNamespace(namespace)) {
          this.state[namespace] = { ...DEFAULT_EXTENSION_STATE[namespace], ...value }
        }
      })
      
      this.log('Loaded persisted state')
    } catch (error) {
      this.logError('Failed to load persisted state:', error)
    }
  }

  private isValidNamespace(namespace: string): namespace is StateNamespace {
    return namespace in DEFAULT_EXTENSION_STATE
  }

  private getSource(): 'background' | 'popup' | 'content' | 'options' {
    const env = this.detectEnvironment()
    if (env === 'unknown') return 'content' // Default fallback
    return env as any
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private log(...args: any[]) {
    if (this.config.debugMode) {
      console.log(DEBUG_PREFIX, `[${this.config.mode}]`, `[${this.detectEnvironment()}]`, ...args)
    }
  }

  private logError(...args: any[]) {
    console.error(DEBUG_PREFIX, `[${this.config.mode}]`, `[${this.detectEnvironment()}]`, ...args)
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  public destroy() {
    // Remove event listeners
    if (this.messageHandler && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.removeListener(this.messageHandler)
    }
    
    if (this.config.mode === 'master') {
      if (this.portHandler && chrome.runtime?.onConnect) {
        chrome.runtime.onConnect.removeListener(this.portHandler)
      }
      
      if (this.storageHandler && chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(this.storageHandler)
      }
    }
    
    // Disconnect port
    if (this.port) {
      try {
        this.port.disconnect()
      } catch {
        // Ignore disconnect errors
      }
      this.port = null
    }
    
    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    
    if (this.storageDebounceTimer) {
      clearTimeout(this.storageDebounceTimer)
      this.storageDebounceTimer = null
    }
    
    // Clear collections
    this.listeners.clear()
    this.pendingUpdates.clear()
    
    this.isInitialized = false
    this.log('StateSyncManager destroyed')
  }
}