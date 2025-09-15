import { debugLog } from './utils/debug'
import { EyeTrackerManager } from './lib/eye-tracker-manager'
import { backgroundDataIOClient } from './lib/backgroundDataIOClient'
import { eyeTrackerState } from './lib/eyeTrackerState'

// Log when background script starts
debugLog('BACKGROUND', 'Background script initialized');

// Initialize persistent eye tracker
const eyeTrackerManager = EyeTrackerManager.getInstance()

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

    case 'DATA_IO_UPLOAD_SESSION':
      // Upload complete eye tracking session from background script
      const { uploadId, projectId: uploadProjectId, sessionId: uploadSessionId, videoBlob, gazeData, metadata, screenDimensions } = request;
      debugLog('BACKGROUND', 'Uploading eye tracking session', { 
        uploadId,
        sessionId: uploadSessionId, 
        projectId: uploadProjectId,
        videoSize: videoBlob?.length || 0,
        gazePoints: gazeData?.length || 0
      });
      
      (async () => {
        try {
          // Send progress update to content script
          const sendProgressUpdate = (percent: number, message: string) => {
            chrome.tabs.query({}, (tabs) => {
              tabs.forEach(tab => {
                if (tab.id) {
                  chrome.tabs.sendMessage(tab.id, {
                    type: 'UPLOAD_PROGRESS',
                    uploadId,
                    percent,
                    message
                  }).catch(() => {
                    // Ignore errors
                  });
                }
              });
            });
          };
          
          sendProgressUpdate(30, 'Preparing data for upload...');
          
          // Convert serialized blob data back to File objects
          const videoFile = videoBlob ? new File([new Uint8Array(videoBlob)], `recording-${uploadSessionId}.webm`, { 
            type: 'video/webm' 
          }) : undefined;
          
          const gazeFile = gazeData ? new File([JSON.stringify(gazeData)], `gaze-data-${uploadSessionId}.json`, { 
            type: 'application/json' 
          }) : undefined;

          console.log('📁 [BACKGROUND] Created files for upload:', {
            video: videoFile ? `${videoFile.name} (${videoFile.size} bytes)` : 'None',
            gaze: gazeFile ? `${gazeFile.name} (${gazeFile.size} bytes)` : 'None'
          });

          const result = await backgroundDataIOClient.submitEyeTrackingSession(
            uploadProjectId,
            uploadSessionId,
            {
              videoFile,
              gazeDataFile: gazeFile,
              gazeData: gazeData,
              participantId: 'browser-extension',
              metadata: {
                ...metadata,
                // Use screen dimensions from content script if provided
                screen_width: screenDimensions?.width || metadata?.screen_width || 1920,
                screen_height: screenDimensions?.height || metadata?.screen_height || 1080
              },
              onProgress: (stage: string, progress: number, details?: any) => {
                // Send progress updates back to content script
                let message = 'Uploading...';
                let percent = progress;
                
                if (stage === 'preparing') {
                  message = 'Preparing upload...';
                  percent = Math.min(30, progress * 0.3);
                } else if (stage === 'uploading') {
                  message = 'Uploading data to server...';
                  percent = 30 + (progress * 0.6); // 30-90%
                } else if (stage === 'processing') {
                  message = 'Processing on server...';
                  percent = 90 + (progress * 0.1); // 90-100%
                }
                
                sendProgressUpdate(percent, message);
                
                // Also send detailed progress for debugging
                if (sender.tab?.id) {
                  chrome.tabs.sendMessage(sender.tab.id, {
                    type: 'UPLOAD_PROGRESS_DETAIL',
                    uploadId,
                    sessionId: uploadSessionId,
                    stage,
                    progress,
                    details
                  }).catch(() => {
                    // Ignore errors
                  });
                }
              }
            }
          );
          
          debugLog('BACKGROUND', 'Session upload successful', { sessionId: uploadSessionId, result });
          sendResponse({ success: true, result });
        } catch (error) {
          debugLog('BACKGROUND', 'Session upload failed', { sessionId: uploadSessionId, error: error.message });
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