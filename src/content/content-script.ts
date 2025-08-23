/**
 * Content Script for Cogix Eye Tracking Extension
 * Injects eye tracking functionality into web pages
 */

import { CogixContentManager } from './CogixContentManager';

// Initialize content manager
const contentManager = new CogixContentManager();

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Cogix Content] Received message:', request.action);
  
  switch (request.action) {
    case 'startRecording':
      contentManager.startRecording(request.projectId)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
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