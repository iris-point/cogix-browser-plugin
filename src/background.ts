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

// API base URL
const API_BASE_URL = 'https://api.cogix.app';

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  debugLog('BACKGROUND', 'Message received', { 
    type: request.type, 
    from: sender.tab ? `Tab ${sender.tab.id}` : 'Extension'
  });
  
  switch (request.type) {
    case 'API_REQUEST':
      // Handle API requests from popup to avoid CORS issues
      const { endpoint, token, options = {} } = request;
      
      debugLog('BACKGROUND', 'Making API request', { endpoint, hasToken: !!token });
      
      // Set a timeout to ensure we always respond
      let responded = false;
      const timeoutId = setTimeout(() => {
        if (!responded) {
          responded = true;
          debugLog('BACKGROUND', 'API request timed out', { endpoint });
          sendResponse({ error: 'Request timed out after 30 seconds' });
        }
      }, 30000); // 30 second timeout
      
      // Ensure we always send a response
      (async () => {
        try {
          // Build request options
          const fetchOptions: RequestInit = {
            method: options.method || 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          };
          
          // Only add body for non-GET requests
          if (options.body && options.method !== 'GET') {
            fetchOptions.body = options.body;
          }
          
          const response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);
          
          const responseText = await response.text();
          debugLog('BACKGROUND', 'API response received', { 
            status: response.status, 
            ok: response.ok,
            contentLength: responseText.length 
          });
          
          if (!response.ok) {
            let errorMessage = `Request failed: ${response.status}`;
            try {
              const errorData = JSON.parse(responseText);
              errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch (e) {
              // Response wasn't JSON
              errorMessage = responseText || errorMessage;
            }
            throw new Error(errorMessage);
          }
          
          // Parse JSON response
          let data;
          try {
            data = JSON.parse(responseText);
          } catch (e) {
            // Response wasn't JSON, return as-is
            data = responseText;
          }
          
          if (!responded) {
            responded = true;
            clearTimeout(timeoutId);
            debugLog('BACKGROUND', 'API request successful', { endpoint });
            sendResponse({ data });
          }
        } catch (error: any) {
          if (!responded) {
            responded = true;
            clearTimeout(timeoutId);
            debugLog('BACKGROUND', 'API request failed', { 
              endpoint,
              error: error.message 
            });
            sendResponse({ error: error.message });
          }
        }
      })();
      
      return true; // Keep message channel open for async response
      
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
      
    case 'OPEN_POPUP':
      // Open the extension popup
      chrome.action.openPopup().catch(() => {
        // If openPopup fails (not supported), open in a new window
        chrome.windows.create({
          url: chrome.runtime.getURL('popup.html'),
          type: 'popup',
          width: 400,
          height: 640
        });
      });
      sendResponse({ success: true });
      return true;
      
    case 'TOGGLE_RECORDING':
      // Handle recording toggle from content script
      const { isRecording, projectId } = request;
      debugLog('BACKGROUND', 'Toggle recording', { isRecording, projectId });
      
      if (isRecording) {
        // Start recording - forward to active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'START_RECORDING',
              projectId: projectId
            }).catch((error) => {
              debugLog('BACKGROUND', 'Failed to start recording', { error: error.message });
            });
          }
        });
      } else {
        // Stop recording - forward to active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'STOP_RECORDING'
            }).catch((error) => {
              debugLog('BACKGROUND', 'Failed to stop recording', { error: error.message });
            });
          }
        });
      }
      
      sendResponse({ success: true });
      return true;
      
    case 'REQUEST_SCREEN_CAPTURE':
      // Handle screen capture request
      const { sources } = request;
      chrome.desktopCapture.chooseDesktopMedia(sources || ['screen', 'window', 'tab'], (streamId) => {
        debugLog('BACKGROUND', 'Screen capture response', { streamId: !!streamId });
        sendResponse({ streamId: streamId || null });
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