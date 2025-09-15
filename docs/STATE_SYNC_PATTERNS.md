# Chrome Extension State Synchronization Patterns

## Overview
When building Chrome extensions, you need to sync state across multiple contexts:
- Background script (service worker in MV3)
- Popup
- Content scripts
- Options page
- DevTools panels

## Common Patterns Comparison

### 1. **Chrome Storage API (Simple but Limited)**
```typescript
// Write
await chrome.storage.local.set({ key: value })

// Read
const result = await chrome.storage.local.get(['key'])

// Listen for changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.key) {
    console.log('New value:', changes.key.newValue)
  }
})
```

**Pros:**
- Built-in API, no extra code
- Persists across sessions
- Works offline

**Cons:**
- Not real-time (storage events can be delayed)
- Size limits (5MB for local, 100KB for sync)
- No type safety
- Can miss rapid updates

### 2. **Message Passing (Fast but Complex)**
```typescript
// Send message
chrome.runtime.sendMessage({ type: 'UPDATE', data: value })

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'UPDATE') {
    // Handle update
  }
})
```

**Pros:**
- Real-time updates
- No size limits
- Direct communication

**Cons:**
- Complex to manage
- No persistence
- Need to handle disconnections
- Manual broadcasting required

### 3. **Port Connections (Persistent but Fragile)**
```typescript
// Connect
const port = chrome.runtime.connect({ name: 'state-sync' })

// Send data
port.postMessage({ data: value })

// Listen
port.onMessage.addListener((msg) => {
  // Handle message
})
```

**Pros:**
- Persistent connection
- Bidirectional communication
- Lower overhead than repeated messages

**Cons:**
- Can disconnect unexpectedly
- Need reconnection logic
- Only between extension contexts

### 4. **Hybrid Approach (Recommended)**
Combines storage for persistence with messaging for real-time updates.

```typescript
class StateManager {
  // Use storage for persistence
  async save(key: string, value: any) {
    await chrome.storage.local.set({ [key]: value })
    // Broadcast change via message
    chrome.runtime.sendMessage({ type: 'STATE_CHANGE', key, value })
  }
  
  // Listen for both storage and messages
  subscribe(callback: Function) {
    // Storage changes (fallback)
    chrome.storage.onChanged.addListener(callback)
    // Message updates (real-time)
    chrome.runtime.onMessage.addListener(callback)
  }
}
```

## Best Practices

### 1. **Single Source of Truth**
Always designate the background script as the source of truth:

```typescript
// Background script owns the state
class BackgroundStateManager {
  private state = {}
  
  handleUpdate(key: string, value: any) {
    this.state[key] = value
    this.broadcast(key, value)
    this.persist(key, value)
  }
}
```

### 2. **Type Safety**
Use TypeScript interfaces for state:

```typescript
interface ExtensionState {
  user: UserState
  settings: SettingsState
  data: DataState
}
```

### 3. **Error Handling**
Always handle connection failures:

```typescript
async function sendUpdate(data: any) {
  try {
    await chrome.runtime.sendMessage(data)
  } catch (error) {
    if (error.message.includes('Extension context invalidated')) {
      // Extension was reloaded
      handleReload()
    } else {
      // Fall back to storage
      await chrome.storage.local.set(data)
    }
  }
}
```

### 4. **Debouncing**
Prevent update storms:

```typescript
const debouncedUpdate = debounce((key, value) => {
  stateManager.update(key, value)
}, 100)
```

### 5. **Validation**
Validate state before syncing:

```typescript
function validateState(state: any): boolean {
  return state && 
         typeof state === 'object' &&
         state.version === CURRENT_VERSION
}
```

## Performance Considerations

### Storage Performance
- `chrome.storage.local`: ~1ms read, ~5ms write
- `chrome.storage.sync`: ~10ms read, ~50ms write
- Message passing: <1ms

### Memory Usage
- Keep state minimal
- Use pagination for large datasets
- Clean up old data regularly

### Battery Impact
- Batch updates when possible
- Use passive event listeners
- Avoid polling

## Migration Guide

### From Storage-Only to Hybrid
```typescript
// Old
chrome.storage.local.set({ status: 'connected' })

// New
stateSync.set('eyeTracker', { 
  status: 'connected',
  lastUpdate: Date.now()
})
```

### From Polling to Events
```typescript
// Old
setInterval(async () => {
  const { status } = await chrome.storage.local.get(['status'])
  updateUI(status)
}, 1000)

// New
stateSync.subscribe('eyeTracker', (state) => {
  updateUI(state.status)
})
```

## Debugging Tips

### 1. **Chrome DevTools**
- Background: `chrome://extensions` → Service Worker
- Popup: Right-click popup → Inspect
- Content: Regular DevTools

### 2. **Logging State Changes**
```typescript
stateSync.subscribe('*', (namespace, newValue, oldValue) => {
  console.log(`[STATE] ${namespace}:`, { oldValue, newValue })
})
```

### 3. **State Inspector**
```typescript
// Add to background script console
window.inspectState = () => stateSync.getSnapshot()
```

## Common Pitfalls

1. **Not handling context invalidation**
   - Always check if extension context is valid
   - Show user-friendly reload messages

2. **Assuming synchronous updates**
   - State updates are async
   - Use callbacks or promises

3. **Storing sensitive data**
   - Never store passwords or tokens in storage
   - Use session storage for sensitive data

4. **Not cleaning up listeners**
   - Always remove listeners when done
   - Memory leaks can crash the extension

5. **Circular updates**
   - Prevent update loops
   - Use timestamps or versions

## Advanced Patterns

### State Machines
```typescript
class StateMachine {
  transitions = {
    IDLE: ['CONNECTING'],
    CONNECTING: ['CONNECTED', 'ERROR'],
    CONNECTED: ['CALIBRATING', 'DISCONNECTED'],
    // ...
  }
  
  canTransition(from: string, to: string): boolean {
    return this.transitions[from]?.includes(to) ?? false
  }
}
```

### Event Sourcing
```typescript
class EventStore {
  events: Event[] = []
  
  append(event: Event) {
    this.events.push(event)
    this.broadcast(event)
  }
  
  replay(): State {
    return this.events.reduce((state, event) => 
      applyEvent(state, event), initialState)
  }
}
```

### CQRS Pattern
```typescript
// Commands modify state
class CommandHandler {
  handle(command: Command) {
    // Validate and update state
  }
}

// Queries read state
class QueryHandler {
  handle(query: Query) {
    // Return current state
  }
}
```

## Conclusion

For production Chrome extensions, use a hybrid approach:
1. Background script as source of truth
2. Message passing for real-time updates
3. Storage for persistence and fallback
4. Type-safe state management
5. Proper error handling

The `StateSyncManager` class provided implements all these best practices and can be used as a drop-in solution for your extension.