/**
 * State Management Constants
 */

// Storage keys
export const STORAGE_PREFIX = 'cogix_state_'
export const STORAGE_VERSION_KEY = 'cogix_state_version'
export const CURRENT_STATE_VERSION = '2.0.0'

// Message types
export const MESSAGE_TYPES = {
  STATE_UPDATE: 'STATE_UPDATE',
  STATE_REQUEST: 'STATE_REQUEST',
  STATE_RESPONSE: 'STATE_RESPONSE',
  STATE_SYNC: 'STATE_SYNC',
  STATE_BATCH_UPDATE: 'STATE_BATCH_UPDATE',
  STATE_RESET: 'STATE_RESET',
  STATE_SUBSCRIBE: 'STATE_SUBSCRIBE',
  STATE_UNSUBSCRIBE: 'STATE_UNSUBSCRIBE'
} as const

// Port names
export const PORT_NAME = 'cogix-state-sync'

// Timing constants
export const SYNC_INTERVAL = 1000 // 1 second
export const RECONNECT_DELAY = 500 // 500ms
export const MAX_RECONNECT_ATTEMPTS = 10
export const STORAGE_DEBOUNCE_DELAY = 100 // 100ms
export const BROADCAST_DELAY = 0 // Immediate

// Performance constants
export const MAX_STATE_SIZE = 5 * 1024 * 1024 // 5MB
export const MAX_LISTENERS_PER_NAMESPACE = 100
export const MAX_NOTIFICATION_COUNT = 50

// Debug constants
export const DEBUG_PREFIX = '[StateSync]'
export const ENABLE_DEBUG_LOGGING = process.env.NODE_ENV === 'development'