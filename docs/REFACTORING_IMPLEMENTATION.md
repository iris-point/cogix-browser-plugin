# Refactoring Implementation Guide

## Overview
This document provides the step-by-step implementation guide for migrating the Cogix browser plugin to the new state management system.

## ✅ Phase 1: Infrastructure (COMPLETED)
Created the following files:
- `src/lib/state/types.ts` - Type definitions
- `src/lib/state/constants.ts` - Constants
- `src/lib/state/StateSyncManager.ts` - Core state manager
- `src/lib/state/hooks.ts` - React hooks
- `src/lib/state/index.ts` - Public API

## 📝 Phase 2: Background Script Migration

### Step 1: Update background.ts
Replace the current state management with the new system:

```typescript
// src/background.ts
import { StateSyncManager, DeviceStatus } from './lib/state'
import { EyeTrackerManager } from './lib/eye-tracker-manager'

// Initialize state manager as master
const stateManager = new StateSyncManager({ mode: 'master' })

// Initialize eye tracker (without state management)
const eyeTrackerManager = EyeTrackerManager.getInstance()

// Handle eye tracker events and update state
eyeTrackerManager.on('statusChanged', async (status: DeviceStatus) => {
  await stateManager.updateState('eyeTracker', { 
    status,
    isConnected: status !== DeviceStatus.DISCONNECTED,
    lastUpdate: Date.now()
  })
})

eyeTrackerManager.on('calibrationComplete', async () => {
  await stateManager.updateState('eyeTracker', {
    isCalibrated: true,
    isTracking: true,
    calibrationProgress: null
  })
})
```

### Step 2: Update EyeTrackerManager
Remove internal state management from `src/lib/eye-tracker-manager.ts`:

```typescript
// Before
class EyeTrackerManager {
  private isConnected: boolean = false
  private isCalibrated: boolean = false
  // ... other state
}

// After
class EyeTrackerManager {
  // Remove all state properties
  // Only keep the tracker instance
  private tracker: EyeTracker | null = null
  
  // Emit events instead of managing state
  async connect() {
    await this.tracker.connect()
    this.emit('connected')
  }
}
```

## 📝 Phase 3: Popup Migration

### Step 1: Replace EyeTrackerContext
Update `src/contexts/EyeTrackerContext.tsx`:

```typescript
// Delete this file entirely
// Replace with direct hook usage in components
```

### Step 2: Update Popup Components
Update `src/popup/pages/eye-tracking.tsx`:

```typescript
import { useEyeTrackerState, useConnectionStatus } from '@/lib/state'

export const EyeTrackingPage = () => {
  const [eyeTracker, updateEyeTracker] = useEyeTrackerState()
  const { isConnected, isCalibrated, canRecord } = useConnectionStatus()
  
  const handleConnect = async () => {
    await updateEyeTracker({ 
      status: DeviceStatus.CONNECTING 
    })
    
    // Send message to background to actually connect
    chrome.runtime.sendMessage({ 
      type: 'EYE_TRACKER_CONNECT' 
    })
  }
  
  return (
    <div>
      <p>Status: {eyeTracker?.status}</p>
      <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
      <button onClick={handleConnect}>Connect</button>
    </div>
  )
}
```

### Step 3: Update Root Layout
Update `src/popup/layouts/root-layout.tsx`:

```typescript
// Remove EyeTrackerProvider
// State is now managed globally

export const RootLayout = ({ children }) => {
  // No providers needed for state
  return <>{children}</>
}
```

## 📝 Phase 4: Content Script Migration

### Step 1: Update Overlay
Update `src/contents/unified-overlay.ts`:

```typescript
import { StateSyncManager } from '@/lib/state'

// Initialize as client
const stateManager = new StateSyncManager({ mode: 'client' })

// Subscribe to state changes
stateManager.subscribe('eyeTracker', (state) => {
  updateOverlayUI(state)
})

stateManager.subscribe('recording', (state) => {
  updateRecordingButton(state.isRecording)
})

// Check recording capability
function canStartRecording() {
  const eyeTracker = stateManager.getState('eyeTracker')
  return eyeTracker.isConnected && 
         (eyeTracker.isCalibrated || eyeTracker.isTracking)
}
```

## 📝 Phase 5: Message Handlers

### Update Background Message Handlers
Simplify message handling in `src/background.ts`:

```typescript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'EYE_TRACKER_CONNECT':
      eyeTrackerManager.connect()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ error: error.message }))
      return true
      
    case 'START_CALIBRATION':
      eyeTrackerManager.startCalibration()
      sendResponse({ success: true })
      return true
      
    // Remove all state-related message handlers
    // State is now handled by StateSyncManager
  }
})
```

## 📝 Phase 6: Testing

### Unit Tests
```typescript
// src/lib/state/__tests__/StateSyncManager.test.ts
describe('StateSyncManager', () => {
  it('should sync state between master and client', async () => {
    const master = new StateSyncManager({ mode: 'master' })
    const client = new StateSyncManager({ mode: 'client' })
    
    await master.updateState('eyeTracker', { isConnected: true })
    
    // Client should receive update
    expect(client.getState('eyeTracker').isConnected).toBe(true)
  })
})
```

### Integration Tests
1. Open extension popup
2. Connect to eye tracker
3. Verify status shows in popup and content script
4. Start calibration
5. Verify progress updates in real-time
6. Complete calibration
7. Verify state persists after reload

## 📝 Phase 7: Cleanup

### Files to Delete
- `src/lib/eyeTrackerState.ts`
- `src/contexts/EyeTrackerContext.tsx`
- Old state management code from background.ts

### Code to Remove
- Direct chrome.storage access for state
- Manual message broadcasting for state
- Redundant state synchronization logic

## Migration Checklist

### Background Script
- [ ] Initialize StateSyncManager as master
- [ ] Remove state from EyeTrackerManager
- [ ] Update event handlers to use state manager
- [ ] Remove old message handlers

### Popup
- [ ] Replace EyeTrackerContext with hooks
- [ ] Update all components to use new hooks
- [ ] Remove providers from root layout
- [ ] Test all UI updates

### Content Scripts
- [ ] Initialize StateSyncManager as client
- [ ] Subscribe to relevant state changes
- [ ] Update UI based on state
- [ ] Test overlay functionality

### Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing complete
- [ ] Performance benchmarks meet targets

## Common Issues and Solutions

### Issue: State not syncing
**Solution**: Check that StateSyncManager is initialized with correct mode

### Issue: Popup shows old state
**Solution**: Ensure popup uses hooks, not direct storage access

### Issue: Content script not receiving updates
**Solution**: Verify content script has proper permissions

### Issue: State lost on reload
**Solution**: Check persistKeys configuration includes necessary namespaces

## Performance Optimization

### Debouncing Updates
```typescript
// For frequent updates, debounce
const debouncedUpdate = debounce(
  (update) => stateManager.updateState('eyeTracker', update),
  100
)
```

### Selective Subscriptions
```typescript
// Only subscribe to what you need
stateManager.subscribe('eyeTracker', (state) => {
  // Only update if relevant fields changed
  if (state.isConnected !== lastConnected) {
    updateUI()
  }
})
```

### Batch Updates
```typescript
// Update multiple fields at once
await stateManager.updateState('eyeTracker', {
  isConnected: true,
  isCalibrated: true,
  isTracking: true
})
```

## Verification Steps

1. **State Persistence**
   - Set calibration state
   - Reload extension
   - Verify state persists

2. **Real-time Sync**
   - Open popup and content script
   - Change state in popup
   - Verify immediate update in content

3. **Error Recovery**
   - Disconnect from background
   - Verify fallback to storage
   - Reconnect and verify sync resumes

4. **Performance**
   - Monitor memory usage
   - Check update latency
   - Verify no memory leaks

## Next Steps

After successful migration:
1. Monitor for issues in production
2. Gather performance metrics
3. Document any edge cases found
4. Consider additional optimizations

## Support

For questions or issues during migration:
1. Check the error logs
2. Review the state in Chrome DevTools
3. Use debug mode for detailed logging
4. Test with minimal example first