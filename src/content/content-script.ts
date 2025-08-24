/**
 * Content Script for Cogix Eye Tracking Extension
 * Injects eye tracking functionality into web pages
 */

import { CogixContentManager } from './CogixContentManager';

// Initialize content manager
const contentManager = new CogixContentManager();

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('[Cogix Content] Received message:', request.action);
  
  switch (request.action) {
    case 'startRecording':
      console.log('[Cogix Content] Processing startRecording with:', request);
      contentManager.startRecording(request.projectId, {
        mode: request.mode,
        provider: request.provider,
        enableAudio: request.enableAudio
      })
        .then(result => {
          console.log('[Cogix Content] Recording started successfully:', result);
          sendResponse({ success: true, data: result });
        })
        .catch(error => {
          console.error('[Cogix Content] Failed to start recording:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case 'stopRecording':
      contentManager.stopRecording()
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'startCalibration':
      contentManager.startCalibration()
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'checkConnection':
      contentManager.checkConnection()
        .then(status => sendResponse({ success: true, ...status }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'getStatus':
      sendResponse({ 
        success: true, 
        data: contentManager.getStatus() 
      });
      break;

    case 'toggleOverlay':
      console.log('[Cogix Content] Toggling overlay', request);
      contentManager.toggleOverlay(
        request.isAuthenticated,
        request.user,
        request.currentProjectId
      );
      sendResponse({ success: true });
      break;

    case 'getSDKStatus':
      sendResponse({ 
        success: true, 
        status: contentManager.getSDKStatus(),
        error: contentManager.getLastError()
      });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Initialize on page load
window.addEventListener('load', () => {
  contentManager.initialize();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  contentManager.cleanup();
});

export {};