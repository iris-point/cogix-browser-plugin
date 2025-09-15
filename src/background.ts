import { debugLog } from './utils/debug'
import { EyeTrackerManager } from './lib/eye-tracker-manager'
import { backgroundDataIOClient } from './lib/backgroundDataIOClient'
import { eyeTrackerState } from './lib/eyeTrackerState'

// Log when background script starts
debugLog('BACKGROUND', 'Background script initialized');

// Initialize persistent eye tracker
const eyeTrackerManager = EyeTrackerManager.getInstance()

// Global Recording State Manager (persists across tabs like Loom)
interface GlobalRecordingState {
  isRecording: boolean
  recordingStartTime: number | null
  projectId: string | null
  sessionId: string | null
  streamId: string | null
  activeTabId: number | null
  gazeDataBuffer: any[]
  recordingMetadata: any
}

const globalRecordingState: GlobalRecordingState = {
  isRecording: false,
  recordingStartTime: null,
  projectId: null,
  sessionId: null,
  streamId: null,
  activeTabId: null,
  gazeDataBuffer: [],
  recordingMetadata: {}
}

// Restore recording state from storage on startup
chrome.storage.local.get(['globalRecordingState'], (result) => {
  if (result.globalRecordingState) {
    Object.assign(globalRecordingState, result.globalRecordingState)
    debugLog('BACKGROUND', 'Restored recording state', globalRecordingState)

    // Notify all tabs about the current recording state
    if (globalRecordingState.isRecording) {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'RECORDING_STATE_UPDATE',
              state: globalRecordingState
            }).catch(() => {
              // Tab might not have content script loaded
            })
          }
        })
      })
    }
  }
})

// Save recording state to storage whenever it changes
function saveRecordingState() {
  chrome.storage.local.set({ globalRecordingState }, () => {
    debugLog('BACKGROUND', 'Recording state saved', globalRecordingState)
  })
}

// Broadcast recording state to all tabs
function broadcastRecordingState() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'RECORDING_STATE_UPDATE',
          state: globalRecordingState
        }).catch(() => {
          // Tab might not have content script loaded
        })
      }
    })
  })
}

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  debugLog('BACKGROUND', 'Extension installed/updated', { reason: details.reason });
  
  if (details.reason === 'install') {
    // Open welcome page on first install
    chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
  }
});

// API base URL - Browser plugin always uses production (no localhost)
// IMPORTANT: Never use localhost - browser plugins should only connect to production APIs
const API_BASE_URL = 'https://api.cogix.app';

// Validate configuration
if (API_BASE_URL.includes('localhost')) {
  console.error('❌ CONFIGURATION ERROR: Browser plugin should never use localhost URLs!');
  throw new Error('Invalid configuration: localhost URLs not allowed in browser plugin');
}

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

    case 'GET_SELECTED_PROJECT':
      // Get fresh project data to avoid storage sync delays
      chrome.storage.sync.get(['selectedProject'], (result) => {
        debugLog('BACKGROUND', 'Selected project retrieved', {
          hasProject: !!result.selectedProject,
          projectName: result.selectedProject?.name
        });
        sendResponse({
          project: result.selectedProject || null
        });
      });
      return true;
      
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
      // Handle recording toggle - now uses global state
      const { isRecording, projectId } = request;
      debugLog('BACKGROUND', 'Toggle recording', { isRecording, projectId });

      if (isRecording) {
        // Start recording globally
        globalRecordingState.isRecording = true
        globalRecordingState.recordingStartTime = Date.now()
        globalRecordingState.projectId = projectId
        globalRecordingState.sessionId = `session-${Date.now()}`
        globalRecordingState.activeTabId = sender.tab?.id || null
        globalRecordingState.gazeDataBuffer = []
        globalRecordingState.recordingMetadata = {}

        // Save and broadcast state to all tabs
        saveRecordingState()
        broadcastRecordingState()

        debugLog('BACKGROUND', 'Started global recording', globalRecordingState)
      } else {
        // Stop recording globally
        globalRecordingState.isRecording = false

        // Save and broadcast state to all tabs
        saveRecordingState()
        broadcastRecordingState()

        debugLog('BACKGROUND', 'Stopped global recording')
      }

      sendResponse({ success: true, state: globalRecordingState });
      return true;
      
    case 'GET_RECORDING_STATE':
      // Return current global recording state
      sendResponse({ success: true, state: globalRecordingState });
      return true;

    case 'UPDATE_RECORDING_METADATA':
      // Update recording metadata (e.g., when switching tabs)
      if (globalRecordingState.isRecording) {
        Object.assign(globalRecordingState.recordingMetadata, request.metadata || {})
        globalRecordingState.activeTabId = sender.tab?.id || globalRecordingState.activeTabId
        saveRecordingState()
        debugLog('BACKGROUND', 'Updated recording metadata', globalRecordingState.recordingMetadata)
      }
      sendResponse({ success: true });
      return true;

    case 'ADD_GAZE_DATA':
      // Add gaze data to global buffer
      if (globalRecordingState.isRecording && request.gazeData) {
        globalRecordingState.gazeDataBuffer.push(request.gazeData)
        // Keep buffer size reasonable (last 1000 points)
        if (globalRecordingState.gazeDataBuffer.length > 1000) {
          globalRecordingState.gazeDataBuffer.shift()
        }
      }
      sendResponse({ success: true });
      return true;

    case 'REQUEST_SCREEN_CAPTURE':
      // Handle screen capture request
      const { sources } = request;
      debugLog('BACKGROUND', 'Screen capture request received', { sources, tabId: sender.tab?.id });
      
      // For Chrome extensions, we need to pass the tab ID for proper permission dialog
      // If no tab ID (e.g., from popup), use chrome.tabs API
      if (sender.tab?.id) {
        // Request from content script - use the sender's tab
        chrome.desktopCapture.chooseDesktopMedia(
          sources || ['screen', 'window', 'tab'],
          sender.tab,
          (streamId) => {
            debugLog('BACKGROUND', 'Screen capture response', { 
              streamId: !!streamId,
              streamIdValue: streamId 
            });
            
            if (streamId) {
              // Store the streamId temporarily for verification
              chrome.storage.local.set({ 
                lastStreamId: streamId,
                lastStreamTimestamp: Date.now() 
              });
            }
            
            sendResponse({ 
              streamId: streamId || null,
              success: !!streamId 
            });
          }
        );
      } else {
        // Request from popup or background - get active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length > 0) {
            chrome.desktopCapture.chooseDesktopMedia(
              sources || ['screen', 'window', 'tab'],
              tabs[0],
              (streamId) => {
                debugLog('BACKGROUND', 'Screen capture response (from popup)', { 
                  streamId: !!streamId 
                });
                sendResponse({ 
                  streamId: streamId || null,
                  success: !!streamId 
                });
              }
            );
          } else {
            sendResponse({ 
              streamId: null,
              success: false,
              error: 'No active tab found' 
            });
          }
        });
      }
      return true;
      
    case 'EYE_TRACKER_CONNECT':
      // Connect to eye tracker
      debugLog('BACKGROUND', 'Connecting to eye tracker');
      eyeTrackerManager.connect()
        .then(() => {
          debugLog('BACKGROUND', 'Eye tracker connected successfully');
          sendResponse({ success: true });
        })
        .catch((error) => {
          debugLog('BACKGROUND', 'Eye tracker connection failed', { error: error.message });
          sendResponse({ success: false, error: error.message });
        });
      return true;
      
    case 'EYE_TRACKER_DISCONNECT':
      // Disconnect eye tracker
      debugLog('BACKGROUND', 'Disconnecting eye tracker');
      (async () => {
        await eyeTrackerManager.disconnect();
        sendResponse({ success: true });
      })();
      return true;
      
    case 'EYE_TRACKER_STATUS':
      // Get state from centralized state manager
      (async () => {
        const state = await eyeTrackerState.getStateAsync()
        console.log('EYE_TRACKER_STATUS response from centralized state:', state)
        
        sendResponse({
          status: state.status,
          isConnected: state.isConnected,
          isCalibrated: state.isCalibrated,
          isTracking: state.isTracking,
          canRecord: state.canRecord,
          displayStatus: state.displayStatus
        })
      })()
      return true; // Will respond asynchronously
      
    case 'EYE_TRACKER_SET_URL':
      // Set WebSocket URL
      const { url } = request;
      eyeTrackerManager.setWsUrl(url);
      debugLog('BACKGROUND', 'Eye tracker URL updated', { url });
      sendResponse({ success: true });
      return true;
      
    case 'GET_CAMERA_FRAME':
      // Get latest camera frame for popup
      const latestFrame = eyeTrackerManager.getLatestCameraFrame();
      sendResponse({ frame: latestFrame });
      return true;
      
    case 'START_EYE_TRACKER_CALIBRATION':
      // Start calibration
      debugLog('BACKGROUND', 'Starting eye tracker calibration');
      try {
        eyeTrackerManager.startCalibration();
        sendResponse({ success: true });
      } catch (error: any) {
        debugLog('BACKGROUND', 'Failed to start calibration', { error: error.message });
        sendResponse({ success: false, error: error.message });
      }
      return true;
      
    case 'STOP_EYE_TRACKER_CALIBRATION':
      // Stop/cancel calibration
      debugLog('BACKGROUND', 'Stopping eye tracker calibration');
      (async () => {
        try {
          await eyeTrackerManager.cancelCalibration();
          sendResponse({ success: true });
        } catch (error: any) {
          debugLog('BACKGROUND', 'Failed to stop calibration', { error: error.message });
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'DATA_IO_TEST_CONNECTION':
      // Test data-io connection from background script (avoids CORS)
      const { screenDimensions: testScreenDimensions } = request;
      debugLog('BACKGROUND', 'Testing data-io connection', {
        projectId: request.projectId,
        screenDimensions: testScreenDimensions
      });
      (async () => {
        try {
          const diagnostics = await backgroundDataIOClient.diagnoseConfiguration();
          const connectivity = await backgroundDataIOClient.testBackendConnectivity();
          const testResults = await backgroundDataIOClient.testConnectionAndAuth(request.projectId, testScreenDimensions);
          
          sendResponse({ 
            success: true, 
            diagnostics,
            connectivity,
            testResults
          });
        } catch (error) {
          debugLog('BACKGROUND', 'Data-io test failed', { error: error.message });
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : String(error)
          });
        }
      })();
      return true;

    case 'DATA_IO_UPLOAD_SESSION_INDEXED':
      // Handle large video upload via IndexedDB reference
      const { uploadId: indexedUploadId, projectId: indexedProjectId, sessionId: indexedSessionId, videoBlobId, videoBlobSize, gazeData: indexedGazeData, metadata: indexedMetadata, screenDimensions: indexedScreenDims } = request;
      debugLog('BACKGROUND', 'Large video upload via IndexedDB', { 
        uploadId: indexedUploadId,
        videoBlobId,
        videoBlobSize,
        sessionId: indexedSessionId
      });
      
      (async () => {
        try {
          // Open IndexedDB and retrieve the video blob
          debugLog('BACKGROUND', 'Opening IndexedDB to retrieve video blob', { videoBlobId });
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('CogixVideoDB', 2); // Match version from content script
            
            request.onsuccess = () => {
              debugLog('BACKGROUND', 'IndexedDB opened successfully');
              resolve(request.result);
            };
            
            request.onerror = () => {
              debugLog('BACKGROUND', 'Failed to open IndexedDB', { error: request.error });
              reject(request.error);
            };
            
            // Handle upgrade if needed (shouldn't happen in background, but just in case)
            request.onupgradeneeded = (event) => {
              debugLog('BACKGROUND', 'IndexedDB upgrade needed');
              const db = (event.target as IDBOpenDBRequest).result;
              if (!db.objectStoreNames.contains('videos')) {
                db.createObjectStore('videos', { keyPath: 'id' });
                debugLog('BACKGROUND', 'Created videos object store');
              }
            };
          });
          
          // Get video blob from IndexedDB
          debugLog('BACKGROUND', 'Creating transaction to retrieve video');
          const transaction = db.transaction(['videos'], 'readonly');
          const store = transaction.objectStore('videos');
          const getRequest = store.get(videoBlobId);
          
          const videoData = await new Promise<any>((resolve, reject) => {
            getRequest.onsuccess = () => {
              const result = getRequest.result;
              debugLog('BACKGROUND', 'IndexedDB get request completed', { 
                found: !!result,
                hasBlob: !!(result && result.blob),
                id: result?.id
              });
              resolve(result);
            };
            getRequest.onerror = () => {
              debugLog('BACKGROUND', 'IndexedDB get request failed', { error: getRequest.error });
              reject(getRequest.error);
            };
          });
          
          if (!videoData || !videoData.blob) {
            // List all keys in the store for debugging
            const allKeys = await new Promise<any[]>((resolve, reject) => {
              const keysRequest = store.getAllKeys();
              keysRequest.onsuccess = () => resolve(keysRequest.result);
              keysRequest.onerror = () => reject(keysRequest.error);
            });
            debugLog('BACKGROUND', 'Available keys in IndexedDB', { keys: allKeys, requestedKey: videoBlobId });
            throw new Error(`Video blob not found in IndexedDB. Requested ID: ${videoBlobId}, Available IDs: ${allKeys.join(', ')}`);
          }
          
          debugLog('BACKGROUND', 'Retrieved video blob from IndexedDB', { 
            size: videoData.blob.size 
          });
          
          // Create File from Blob
          const videoFile = new File([videoData.blob], `recording-${indexedSessionId}.webm`, { 
            type: 'video/webm' 
          });
          
          // Wrap gaze data with metadata for the JSON file
          const gazeDataWithMetadata = indexedGazeData ? {
            session_id: indexedSessionId,
            project_id: indexedProjectId,
            participant_id: 'browser-extension',
            metadata: {
              duration: indexedMetadata?.duration || indexedMetadata?.actualDuration,
              screen_width: indexedScreenDims?.width || 1920,
              screen_height: indexedScreenDims?.height || 1080,
              gaze_points_count: indexedGazeData.length,
              recorded_at: new Date().toISOString()
            },
            gaze_data: indexedGazeData
          } : null;
          
          const gazeFile = gazeDataWithMetadata ? new File([JSON.stringify(gazeDataWithMetadata)], `gaze-data-${indexedSessionId}.json`, { 
            type: 'application/json' 
          }) : undefined;
          
          // Upload using backgroundDataIOClient
          const result = await backgroundDataIOClient.submitEyeTrackingSession(
            indexedProjectId,
            indexedSessionId,
            {
              videoFile,
              gazeDataFile: gazeFile,
              gazeData: indexedGazeData,
              participantId: 'browser-extension',
              metadata: {
                ...indexedMetadata,
                screen_width: indexedScreenDims?.width || 1920,
                screen_height: indexedScreenDims?.height || 1080
              }
            }
          );
          
          debugLog('BACKGROUND', 'IndexedDB video upload successful', { sessionId: indexedSessionId });
          
          // Clean up the video from IndexedDB after successful upload
          try {
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
              const request = indexedDB.open('CogixVideoDB', 2); // Match version
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
              request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('videos')) {
                  db.createObjectStore('videos', { keyPath: 'id' });
                }
              };
            });
            
            const deleteTransaction = db.transaction(['videos'], 'readwrite');
            const deleteStore = deleteTransaction.objectStore('videos');
            deleteStore.delete(videoBlobId);
            
            await new Promise((resolve, reject) => {
              deleteTransaction.oncomplete = () => {
                debugLog('BACKGROUND', 'Cleaned up video from IndexedDB', { videoBlobId });
                resolve(undefined);
              };
              deleteTransaction.onerror = () => reject(deleteTransaction.error);
            });
            
            db.close();
          } catch (cleanupError) {
            debugLog('BACKGROUND', 'Failed to cleanup IndexedDB', { error: cleanupError.message });
            // Non-critical error, don't fail the upload
          }
          
          sendResponse({ success: true, result });
          
        } catch (error) {
          debugLog('BACKGROUND', 'IndexedDB video upload failed', { error: error.message });
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : String(error)
          });
        }
      })();
      return true;
      
    case 'DATA_IO_UPLOAD_SESSION_BLOB_URL':
      // Handle upload using blob URL
      const { uploadId: blobUploadId, projectId: blobProjectId, sessionId: blobSessionId, videoBlobUrl, videoBlobSize: blobVideoSize, gazeData: blobGazeData, metadata: blobMetadata, screenDimensions: blobScreenDims } = request;
      debugLog('BACKGROUND', 'Upload via blob URL', { 
        uploadId: blobUploadId,
        blobUrl: videoBlobUrl,
        size: blobVideoSize,
        sessionId: blobSessionId
      });
      
      (async () => {
        try {
          // Fetch the blob from the URL
          debugLog('BACKGROUND', 'Fetching blob from URL');
          const response = await fetch(videoBlobUrl);
          const videoBlob = await response.blob();
          
          debugLog('BACKGROUND', 'Blob fetched successfully', { size: videoBlob.size });
          
          // Create File from Blob
          const videoFile = new File([videoBlob], `recording-${blobSessionId}.webm`, { 
            type: 'video/webm' 
          });
          
          // Wrap gaze data with metadata for the JSON file
          const gazeDataWithMetadata = blobGazeData ? {
            session_id: blobSessionId,
            project_id: blobProjectId,
            participant_id: 'browser-extension',
            metadata: {
              duration: blobMetadata?.duration || blobMetadata?.actualDuration,
              screen_width: blobScreenDims?.width || 1920,
              screen_height: blobScreenDims?.height || 1080,
              gaze_points_count: blobGazeData.length,
              recorded_at: new Date().toISOString()
            },
            gaze_data: blobGazeData
          } : null;
          
          const gazeFile = gazeDataWithMetadata ? new File([JSON.stringify(gazeDataWithMetadata)], `gaze-data-${blobSessionId}.json`, { 
            type: 'application/json' 
          }) : undefined;
          
          // Upload using backgroundDataIOClient
          const result = await backgroundDataIOClient.submitEyeTrackingSession(
            blobProjectId,
            blobSessionId,
            {
              videoFile,
              gazeDataFile: gazeFile,
              gazeData: blobGazeData,
              participantId: 'browser-extension',
              metadata: {
                ...blobMetadata,
                screen_width: blobScreenDims?.width || 1920,
                screen_height: blobScreenDims?.height || 1080
              }
            }
          );
          
          debugLog('BACKGROUND', 'Blob URL upload successful', { sessionId: blobSessionId });
          sendResponse({ success: true, result });
          
        } catch (error) {
          debugLog('BACKGROUND', 'Blob URL upload failed', { error: error.message });
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : String(error)
          });
        }
      })();
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

      // Clear data-io token cache when auth changes or is removed
      if (key === 'clerkToken' && (!newValue || newValue !== oldValue)) {
        // Import dynamically to avoid circular dependencies
        import('./lib/dataIOClient').then(({ dataIOClient }) => {
          dataIOClient.clearTokenCache();
          debugLog('BACKGROUND', 'Cleared data-io token cache due to auth change');
        }).catch(error => {
          debugLog('BACKGROUND', 'Failed to clear token cache:', error);
        });
      }
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