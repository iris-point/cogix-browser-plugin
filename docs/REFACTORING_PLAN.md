# Chrome Extension State Management Refactoring Plan

## Executive Summary
Complete refactoring of the Cogix browser plugin state management system to implement industry-standard real-time synchronization across all extension contexts.

## Current State Analysis

### Problems with Current Implementation

1. **eyeTrackerState.ts Issues:**
   - Singleton initialization errors in popup context
   - Uses Proxy pattern as a workaround (hacky)
   - Relies solely on Chrome storage (not real-time)
   - State updates can be delayed or missed
   - Complex validation logic scattered throughout

2. **Multiple State Sources:**
   - Background script maintains its own state
   - Popup has separate state via React context
   - Content scripts have local state copies
   - No single source of truth

3. **Synchronization Issues:**
   - Calibration state not persisting correctly
   - Recording button shows wrong state
   - Status inconsistencies between popup and overlay
   - "Extension context invalidated" errors

4. **Code Duplication:**
   - State management logic repeated in multiple files
   - Similar storage access patterns everywhere
   - Redundant message handling code

## Proposed Architecture

### Core Principles
1. **Single Source of Truth**: Background script owns all state
2. **Real-time Sync**: Message-based updates with storage fallback
3. **Type Safety**: Full TypeScript interfaces for all state
4. **Resilience**: Automatic reconnection and error recovery
5. **Developer Experience**: Simple API with React hooks

### System Design

```
┌─────────────────────────────────────────────────────────┐
│                   Background Script                      │
│                  (Source of Truth)                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │           StateSyncManager (Master)              │   │
│  │  - Owns all state                                │   │
│  │  - Broadcasts changes                            │   │
│  │  - Persists to storage                           │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
           ┌────────────────┼────────────────┐
           │                │                │
           ▼                ▼                ▼
    ┌──────────┐     ┌──────────┐    ┌──────────┐
    │  Popup   │     │ Content  │    │ Options  │
    │          │     │ Scripts  │    │   Page   │
    └──────────┘     └──────────┘    └──────────┘
    StateSyncManager  StateSyncManager StateSyncManager
      (Client)          (Client)        (Client)
```

## Refactoring Steps

### Phase 1: Setup New Infrastructure
1. Create new state management system
2. Define TypeScript interfaces
3. Implement StateSyncManager
4. Add React hooks
5. Create migration utilities

### Phase 2: Migrate Background Script
1. Replace EyeTrackerManager state handling
2. Implement state broadcasting
3. Add storage persistence
4. Setup message handlers

### Phase 3: Migrate Popup
1. Replace EyeTrackerContext
2. Use new React hooks
3. Remove direct storage access
4. Update UI components

### Phase 4: Migrate Content Scripts
1. Replace local state management
2. Use client-side StateSyncManager
3. Update overlay components
4. Fix recording state sync

### Phase 5: Cleanup
1. Remove old state management code
2. Delete eyeTrackerState.ts
3. Remove redundant message handlers
4. Update documentation

## File Changes

### Files to Create
```
src/lib/state/
├── StateSyncManager.ts       # Core state sync implementation
├── types.ts                  # TypeScript interfaces
├── hooks.ts                  # React hooks
├── constants.ts              # State constants
└── index.ts                  # Public API
```

### Files to Modify
```
src/background.ts             # Use StateSyncManager as master
src/lib/eye-tracker-manager.ts # Remove state management
src/contexts/EyeTrackerContext.tsx # Use new hooks
src/contents/unified-overlay.ts # Use client StateSyncManager
src/popup/pages/*.tsx         # Update to use new hooks
```

### Files to Delete
```
src/lib/eyeTrackerState.ts   # Replaced by StateSyncManager
```

## State Structure

```typescript
interface ExtensionState {
  // Eye Tracker State
  eyeTracker: {
    status: DeviceStatus
    isConnected: boolean
    isCalibrated: boolean
    isTracking: boolean
    calibrationProgress: number | null
    lastUpdate: number
    wsUrl: string
    error: string | null
  }
  
  // Recording State
  recording: {
    isRecording: boolean
    isPaused: boolean
    sessionId: string | null
    projectId: string | null
    startTime: number | null
    duration: number
    gazeDataCount: number
    videoSize: number
  }
  
  // User State
  user: {
    isAuthenticated: boolean
    userId: string | null
    email: string | null
    selectedProject: {
      id: string
      name: string
      description: string
    } | null
  }
  
  // UI State
  ui: {
    overlayVisible: boolean
    overlayPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    debugMode: boolean
    stateDisplayVisible: boolean
  }
  
  // System State
  system: {
    version: string
    lastError: string | null
    isReady: boolean
    contextValid: boolean
  }
}
```

## API Design

### Background Script API
```typescript
// Initialize as master
const stateManager = new StateSyncManager({ mode: 'master' })

// Update state
await stateManager.update('eyeTracker', {
  status: DeviceStatus.CONNECTED,
  isConnected: true,
  // ...
})

// Listen for client requests
stateManager.onClientRequest((request, respond) => {
  // Handle state update requests from clients
})
```

### Client API (Popup/Content)
```typescript
// Initialize as client
const stateManager = new StateSyncManager({ mode: 'client' })

// Get current state
const state = stateManager.get('eyeTracker')

// Subscribe to changes
stateManager.subscribe('eyeTracker', (newState, oldState) => {
  console.log('State changed:', newState)
})

// Update state (sends to background)
await stateManager.update('eyeTracker', { isConnected: true })
```

### React Hooks API
```typescript
// In React components
function MyComponent() {
  const [eyeTracker, updateEyeTracker] = useExtensionState('eyeTracker')
  const [recording, updateRecording] = useExtensionState('recording')
  
  return (
    <div>
      <p>Status: {eyeTracker.status}</p>
      <button onClick={() => updateEyeTracker({ isConnected: true })}>
        Connect
      </button>
    </div>
  )
}
```

## Migration Strategy

### Step-by-Step Migration

1. **Parallel Implementation**
   - Build new system alongside old one
   - No breaking changes initially
   - Test thoroughly before switching

2. **Feature Flags**
   ```typescript
   const USE_NEW_STATE_SYNC = true // Toggle during migration
   ```

3. **Gradual Rollout**
   - Start with non-critical features
   - Monitor for issues
   - Roll back if needed

4. **Data Migration**
   ```typescript
   // Migrate old state format to new
   function migrateState(oldState: any): ExtensionState {
     return {
       eyeTracker: {
         status: oldState.deviceStatus || DeviceStatus.DISCONNECTED,
         // ... map other fields
       }
     }
   }
   ```

## Testing Plan

### Unit Tests
- StateSyncManager core functionality
- Message passing logic
- Storage operations
- State validation

### Integration Tests
- Background ↔ Popup communication
- Background ↔ Content script communication
- Storage persistence
- Error recovery

### End-to-End Tests
1. Connect eye tracker → Verify state in all contexts
2. Start calibration → Check progress updates
3. Complete calibration → Verify persistence
4. Start recording → Check UI updates
5. Reload extension → Verify state recovery

## Success Metrics

### Performance
- State update latency < 10ms
- Memory usage < 10MB
- CPU usage < 1%

### Reliability
- Zero state inconsistencies
- Automatic recovery from errors
- No data loss on reload

### Developer Experience
- Simple, intuitive API
- Full TypeScript support
- Clear error messages
- Comprehensive logging

## Risk Mitigation

### Potential Risks
1. **Breaking existing functionality**
   - Mitigation: Parallel implementation, extensive testing

2. **Performance degradation**
   - Mitigation: Benchmark before/after, optimize hot paths

3. **Browser compatibility issues**
   - Mitigation: Test on Chrome, Edge, Brave

4. **State corruption**
   - Mitigation: State validation, versioning, backups

## Timeline

### Week 1
- [ ] Create new state management system
- [ ] Write unit tests
- [ ] Implement background script integration

### Week 2
- [ ] Migrate popup components
- [ ] Migrate content scripts
- [ ] Integration testing

### Week 3
- [ ] Fix any issues found
- [ ] Performance optimization
- [ ] Documentation updates

### Week 4
- [ ] Remove old code
- [ ] Final testing
- [ ] Release

## Post-Refactor Benefits

1. **Reliability**
   - No more state sync issues
   - Consistent behavior across contexts
   - Automatic error recovery

2. **Performance**
   - Real-time updates
   - Reduced memory usage
   - Faster state access

3. **Maintainability**
   - Single source of truth
   - Clear separation of concerns
   - Type-safe operations

4. **Developer Experience**
   - Simple API
   - Better debugging
   - Clear documentation

## Rollback Plan

If issues arise:
1. Keep old code in separate branch
2. Use feature flag to toggle systems
3. Gradual rollback if needed
4. Document lessons learned

## Approval

This refactoring plan addresses all current issues while providing a robust, scalable solution for state management in the Chrome extension.

**Ready to proceed?** ✅