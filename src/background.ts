import { debugLog } from './utils/debug'

// Log when background script starts
debugLog('BACKGROUND', 'Background script initialized');

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  debugLog('BACKGROUND', 'Extension installed/updated', { reason: details.reason });
  
  if (details.reason === 'install') {
    // Open welcome page on first install
    chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  debugLog('BACKGROUND', 'Message received', { 
    type: request.type, 
    from: sender.tab ? `Tab ${sender.tab.id}` : 'Extension'
  });
  
  switch (request.type) {
    case 'GET_AUTH_STATUS':
      // Check authentication status
      chrome.storage.sync.get(['clerkToken', 'clerkUser'], (result) => {
        debugLog('BACKGROUND', 'Auth status retrieved', {
          hasToken: !!result.clerkToken,
          hasUser: !!result.clerkUser
        });
        sendResponse({
          isAuthenticated: !!result.clerkToken,
          user: result.clerkUser
        });
      });
      return true; // Keep message channel open for async response
      
    case 'DEBUG_INFO':
      // Get debug information
      chrome.storage.local.get(['debugLogs'], (result) => {
        sendResponse({
          logs: result.debugLogs || [],
          extensionId: chrome.runtime.id,
          manifestVersion: chrome.runtime.getManifest().version
        });
      });
      return true;
      
    case 'CLEAR_AUTH':
      // Clear authentication data
      chrome.storage.sync.remove(['clerkToken', 'clerkUser'], () => {
        debugLog('BACKGROUND', 'Auth data cleared');
        sendResponse({ success: true });
      });
      return true;
      
    default:
      debugLog('BACKGROUND', 'Unknown message type', { type: request.type });
  }
});

// Monitor auth token changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
    if (key === 'clerkToken' || key === 'clerkUser') {
      debugLog('BACKGROUND', `Storage change: ${key}`, {
        namespace,
        hadValue: !!oldValue,
        hasValue: !!newValue
      });
    }
  }
});

// Export for debugging in console
(globalThis as any).cogixDebug = {
  getLogs: async () => {
    const result = await chrome.storage.local.get(['debugLogs']);
    return result.debugLogs || [];
  },
  clearLogs: () => {
    chrome.storage.local.remove('debugLogs');
    console.log('Debug logs cleared');
  },
  getAuthStatus: async () => {
    const result = await chrome.storage.sync.get(['clerkToken', 'clerkUser']);
    return {
      hasToken: !!result.clerkToken,
      user: result.clerkUser
    };
  }
};