/**
 * State Management Public API
 * 
 * This is the main entry point for the state management system.
 * Import everything you need from here.
 */

// Core state manager
export { StateSyncManager } from './StateSyncManager'

// Types
export type {
  // State types
  ExtensionState,
  EyeTrackerState,
  RecordingState,
  UserState,
  UIState,
  SystemState,
  
  // Helper types
  StateNamespace,
  StateUpdate,
  StateListener,
  ProjectInfo,
  NotificationItem,
  OverlayPosition,
  
  // Message types
  StateMessage,
  StateUpdateMessage,
  StateRequestMessage,
  StateResponseMessage,
  
  // Config types
  StateSyncConfig
} from './types'

// Default states
export {
  DEFAULT_EXTENSION_STATE,
  DEFAULT_EYE_TRACKER_STATE,
  DEFAULT_RECORDING_STATE,
  DEFAULT_USER_STATE,
  DEFAULT_UI_STATE,
  DEFAULT_SYSTEM_STATE
} from './types'

// React hooks
export {
  // Generic hook
  useExtensionState,
  
  // Specific state hooks
  useEyeTrackerState,
  useRecordingState,
  useUserState,
  useUIState,
  useSystemState,
  useFullExtensionState,
  
  // Utility hooks
  useConnectionStatus,
  useRecordingStatus,
  useNotifications,
  useStateReset,
  
  // Direct access
  getStateManager
} from './hooks'

// Constants
export * from './constants'

// Re-export DeviceStatus from eye-tracking-core for convenience
export { DeviceStatus } from '@iris-point/eye-tracking-core'