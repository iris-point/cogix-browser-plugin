/**
 * Background Service Worker for Cogix Browser Extension
 * Handles authentication, API communication, and message passing
 */

import { sessionManager } from '../lib/SessionManager';
import { CogixAPIClient } from '../lib/CogixAPIClient';
import { configManager } from '../lib/config';

// Global state
let currentProjectId: string | null = null;

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Cogix Eye Tracking Extension installed');
  
  // Initialize configuration
  const config = await configManager.init();
  console.log('Using backend:', config.API_URL);
  
  // Check for existing session
  const session = await sessionManager.getSession();
  if (session) {
    console.log('Existing session found:', session.user.email);
  }
  
  // Load saved project
  const stored = await chrome.storage.local.get('currentProjectId');
  if (stored.currentProjectId) {
    currentProjectId = stored.currentProjectId;
  }
});

// Listen for tab updates to detect Cogix website login
chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const url = new URL(tab.url);
    const config = configManager.current;
    const cogixDomain = new URL(config.FRONTEND_URL).hostname;
    
    // Check if user just logged in on Cogix website
    if (url.hostname === cogixDomain && 
        (url.pathname === '/dashboard' || url.pathname.includes('/projects'))) {
      // User likely just logged in, check session
      const session = await sessionManager.checkSession();
      if (session) {
        console.log('Session detected from Cogix website');
        
        // Notify popup if it's open
        chrome.runtime.sendMessage({ 
          action: 'sessionUpdated', 
          session 
        }).catch(() => {
          // Popup might not be open, ignore error
        });
      }
    }
  }
});

// Initialize API client with dynamic configuration
let apiClient: CogixAPIClient;
configManager.init().then(config => {
  apiClient = new CogixAPIClient(config.API_URL, sessionManager);
});

// Message handler with TypeScript types
interface MessageRequest {
  action: string;
  [key: string]: any;
}

interface MessageResponse {
  success: boolean;
  data?: any;
  error?: string;
}

chrome.runtime.onMessage.addListener(
  (request: MessageRequest, _sender: chrome.runtime.MessageSender, sendResponse: (response: MessageResponse) => void) => {
    console.log('Background received message:', request.action);

    switch (request.action) {
      case 'login':
        // Try website login first, fall back to direct API
        sessionManager.login(request.email, request.password)
          .catch(() => sessionManager.loginDirect(request.email, request.password))
          .then(session => sendResponse({ 
            success: true, 
            data: { session, user: session.user, token: session.accessToken }
          }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'logout':
        sessionManager.logout()
          .then(() => {
            currentProjectId = null;
            chrome.storage.local.remove('currentProjectId');
            sendResponse({ success: true });
          })
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'getAuthState':
        sessionManager.getSession()
          .then(session => sendResponse({ 
            success: true, 
            data: {
              isAuthenticated: !!session,
              user: session?.user || null,
              currentProjectId
            }
          }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'openLoginPage':
        sessionManager.openLoginPage()
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'getProjects':
        apiClient.getProjects()
          .then(projects => sendResponse({ success: true, data: projects }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'selectProject':
        currentProjectId = request.projectId;
        chrome.storage.local.set({ currentProjectId })
          .then(() => sendResponse({ success: true, data: { projectId: currentProjectId } }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'uploadSession':
        if (!currentProjectId) {
          sendResponse({ success: false, error: 'No project selected' });
          return;
        }
        
        apiClient.uploadSession(currentProjectId, request.sessionData)
          .then(result => sendResponse({ success: true, data: result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'startRecording':
        // Inject recording UI into current tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { 
              action: 'startRecording',
              projectId: currentProjectId 
            }, sendResponse);
          } else {
            sendResponse({ success: false, error: 'No active tab' });
          }
        });
        return true;

      case 'stopRecording':
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'stopRecording' }, sendResponse);
          } else {
            sendResponse({ success: false, error: 'No active tab' });
          }
        });
        return true;

      case 'getRecordingStatus':
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'getStatus' }, sendResponse);
          } else {
            sendResponse({ success: false, error: 'No active tab' });
          }
        });
        return true;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }
);

// Handle extension icon click - inject overlay into current tab
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  
  // Check if we're authenticated first
  const session = await sessionManager.getSession();
  
  // Send message to content script to show overlay
  chrome.tabs.sendMessage(tab.id, {
    action: 'toggleOverlay',
    isAuthenticated: !!session,
    user: session?.user || null,
    currentProjectId
  }).catch(() => {
    // Content script might not be loaded, inject it
    chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      files: ['content/content-script.js']
    }).then(() => {
      // Try again after injection
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'toggleOverlay',
          isAuthenticated: !!session,
          user: session?.user || null,
          currentProjectId
        });
      }
    });
  });
});

// Keep service worker alive
const keepAlive = () => setInterval(() => {
  chrome.storage.local.get('keepAlive', () => {});
}, 20000);

keepAlive();

export {};