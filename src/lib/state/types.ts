/**
 * State Type Definitions
 * Central type definitions for the extension's state management
 */

import { DeviceStatus } from '@iris-point/eye-tracking-core'

// ============================================================================
// Eye Tracker State
// ============================================================================

export interface EyeTrackerState {
  status: DeviceStatus
  isConnected: boolean
  isCalibrated: boolean
  isTracking: boolean
  calibrationProgress: number | null
  calibrationPoints: number
  lastUpdate: number
  wsUrl: string
  error: string | null
}

// ============================================================================
// Recording State
// ============================================================================

export interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  sessionId: string | null
  projectId: string | null
  startTime: number | null
  duration: number
  gazeDataCount: number
  videoSize: number
  lastDataPoint: number | null
}

// ============================================================================
// User State
// ============================================================================

export interface ProjectInfo {
  id: string
  name: string
  description: string
}

export interface UserState {
  isAuthenticated: boolean
  userId: string | null
  email: string | null
  selectedProject: ProjectInfo | null
  token: string | null
}

// ============================================================================
// UI State
// ============================================================================

export type OverlayPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface UIState {
  overlayVisible: boolean
  overlayPosition: OverlayPosition
  overlayExpanded: boolean
  debugMode: boolean
  stateDisplayVisible: boolean
  calibrationUIVisible: boolean
  notifications: NotificationItem[]
}

export interface NotificationItem {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
  timestamp: number
  autoClose: boolean
}

// ============================================================================
// System State
// ============================================================================

export interface SystemState {
  version: string
  lastError: string | null
  isReady: boolean
  contextValid: boolean
  installedAt: number
  lastActiveAt: number
}

// ============================================================================
// Complete Extension State
// ============================================================================

export interface ExtensionState {
  eyeTracker: EyeTrackerState
  recording: RecordingState
  user: UserState
  ui: UIState
  system: SystemState
}

// ============================================================================
// State Update Types
// ============================================================================

export type StateNamespace = keyof ExtensionState

export type StateUpdate<K extends StateNamespace> = Partial<ExtensionState[K]>

export type StateListener<K extends StateNamespace> = (
  newState: ExtensionState[K],
  oldState: ExtensionState[K],
  changes: Partial<ExtensionState[K]>
) => void

// ============================================================================
// Message Types
// ============================================================================

export interface StateMessage {
  type: 'STATE_UPDATE' | 'STATE_REQUEST' | 'STATE_RESPONSE' | 'STATE_SYNC'
  namespace?: StateNamespace
  data?: any
  timestamp: number
  source: 'background' | 'popup' | 'content' | 'options'
}

export interface StateUpdateMessage extends StateMessage {
  type: 'STATE_UPDATE'
  namespace: StateNamespace
  data: any
  changes: any
}

export interface StateRequestMessage extends StateMessage {
  type: 'STATE_REQUEST'
  namespace?: StateNamespace
  requestId: string
}

export interface StateResponseMessage extends StateMessage {
  type: 'STATE_RESPONSE'
  data: Partial<ExtensionState>
  requestId: string
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface StateSyncConfig {
  mode: 'master' | 'client'
  persistKeys?: StateNamespace[]
  debugMode?: boolean
  syncInterval?: number
  retryAttempts?: number
  retryDelay?: number
}

// ============================================================================
// Default States
// ============================================================================

export const DEFAULT_EYE_TRACKER_STATE: EyeTrackerState = {
  status: DeviceStatus.DISCONNECTED,
  isConnected: false,
  isCalibrated: false,
  isTracking: false,
  calibrationProgress: null,
  calibrationPoints: 5,
  lastUpdate: Date.now(),
  wsUrl: 'wss://127.0.0.1:8443',
  error: null
}

export const DEFAULT_RECORDING_STATE: RecordingState = {
  isRecording: false,
  isPaused: false,
  sessionId: null,
  projectId: null,
  startTime: null,
  duration: 0,
  gazeDataCount: 0,
  videoSize: 0,
  lastDataPoint: null
}

export const DEFAULT_USER_STATE: UserState = {
  isAuthenticated: false,
  userId: null,
  email: null,
  selectedProject: null,
  token: null
}

export const DEFAULT_UI_STATE: UIState = {
  overlayVisible: true,
  overlayPosition: 'bottom-right',
  overlayExpanded: false,
  debugMode: false,
  stateDisplayVisible: false,
  calibrationUIVisible: false,
  notifications: []
}

export const DEFAULT_SYSTEM_STATE: SystemState = {
  version: '1.0.0', // Will be updated at runtime
  lastError: null,
  isReady: false,
  contextValid: true,
  installedAt: Date.now(),
  lastActiveAt: Date.now()
}

export const DEFAULT_EXTENSION_STATE: ExtensionState = {
  eyeTracker: DEFAULT_EYE_TRACKER_STATE,
  recording: DEFAULT_RECORDING_STATE,
  user: DEFAULT_USER_STATE,
  ui: DEFAULT_UI_STATE,
  system: DEFAULT_SYSTEM_STATE
}