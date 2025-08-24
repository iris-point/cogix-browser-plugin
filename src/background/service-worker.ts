/**
 * Background Service Worker for Cogix Browser Extension
 * Handles authentication, API communication, and message passing
 */

import { sessionManager } from '../lib/SessionManager';
import { CogixAPIClient } from '../lib/CogixAPIClient';
import { configManager } from '../lib/config';

// Global error handler
self.addEventListener('error', (event) => {
  console.error('[Service Worker] Global error:', event.error);
  console.error('Error details:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[Service Worker] Unhandled rejection:', event.reason);
});

// Global state
let currentProjectId: string | null = null;

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async () => {
  try {
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
  } catch (error) {
    console.error('[Service Worker] Error during initialization:', error);
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
}).catch(error => {
  console.error('[Service Worker] Failed to initialize API client:', error);
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
    
    // Wrap everything in try-catch to capture any errors
    try {
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
        // Forward recording request to content script in active tab
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          if (tabs[0]?.id) {
            // Use projectId from request, fall back to currentProjectId
            const projectId = request.projectId || currentProjectId;
            console.log('[Service Worker] Starting recording for project:', projectId);
            
            // Check if URL is accessible
            const url = tabs[0].url;
            if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://')) {
              sendResponse({ success: false, error: 'Cannot record on browser internal pages' });
              return;
            }
            
            // Try to inject content script first if not already injected
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                files: ['content/content-script.js']
              });
              console.log('[Service Worker] Content script injected');
            } catch (error) {
              console.log('[Service Worker] Content script may already be injected or injection failed:', error);
            }
            
            // Send message with retry logic
            const sendMessageWithRetry = (retries = 2) => {
              chrome.tabs.sendMessage(tabs[0].id!, { 
                action: 'startRecording',
                projectId: projectId,
                mode: request.mode,
                provider: request.provider,
                enableAudio: request.enableAudio
              }, (response) => {
                if (chrome.runtime.lastError) {
                  console.error('[Service Worker] Error sending message:', chrome.runtime.lastError);
                  const errorMessage = chrome.runtime.lastError.message || 'Unknown error';
                  if (retries > 0 && errorMessage.includes('Receiving end does not exist')) {
                    // Try injecting content script and retry
                    chrome.scripting.executeScript({
                      target: { tabId: tabs[0].id! },
                      files: ['content/content-script.js']
                    }).then(() => {
                      setTimeout(() => sendMessageWithRetry(retries - 1), 100);
                    }).catch(() => {
                      sendResponse({ success: false, error: 'Failed to inject content script' });
                    });
                  } else {
                    sendResponse({ success: false, error: errorMessage });
                  }
                } else {
                  console.log('[Service Worker] Recording started:', response);
                  sendResponse(response || { success: true });
                }
              });
            };
            
            sendMessageWithRetry();
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

      case 'ping':
        sendResponse({ success: true, data: { pong: true } });
        return true;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('[Service Worker] Error in message handler:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      });
    }
  }
);

// Handle extension icon click - inject overlay into current tab
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;
  
  // Check if the URL is accessible (not chrome://, chrome-extension://, etc.)
  if (tab.url.startsWith('chrome://') || 
      tab.url.startsWith('chrome-extension://') || 
      tab.url.startsWith('edge://') ||
      tab.url.startsWith('about:')) {
    console.warn('Cannot inject content script into browser internal pages');
    // Show a notification or open popup instead
    chrome.action.openPopup?.();
    return;
  }
  
  // Check if we're authenticated first
  const session = await sessionManager.getSession();
  
  // Always try to inject content script first to ensure it's loaded
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content-script.js']
    });
    console.log('[Service Worker] Content script injected for overlay');
  } catch (error) {
    console.log('[Service Worker] Content script may already be injected:', error);
  }
  
  // Small delay to let content script initialize
  setTimeout(() => {
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'toggleOverlay',
        isAuthenticated: !!session,
        user: session?.user || null,
        currentProjectId
      }).catch((error) => {
        console.error('[Service Worker] Failed to show overlay:', error);
        // Try one more time after a longer delay
        setTimeout(() => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              action: 'toggleOverlay',
              isAuthenticated: !!session,
              user: session?.user || null,
              currentProjectId
            }).catch(() => {
              console.error('[Service Worker] Failed to show overlay after retry');
            });
          }
        }, 500);
      });
    }
  }, 100);
});

// Keep service worker alive
const keepAlive = () => setInterval(() => {
  chrome.storage.local.get('keepAlive', () => {});
}, 20000);

keepAlive();

export {};