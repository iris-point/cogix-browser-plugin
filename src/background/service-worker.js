/**
 * Background Service Worker for Cogix Browser Extension
 * Handles authentication, API communication, and message passing
 */

// Configuration
const CONFIG = {
  API_URL: 'http://localhost:8000',
  DATA_API_URL: 'http://localhost:8001',
  FRONTEND_URL: 'http://localhost:3000'
};

// Global state
let authState = {
  token: null,
  user: null,
  currentProjectId: null
};

// Initialize extension on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Cogix Eye Tracking Extension installed');
  loadAuthState();
});

// Load auth state from storage
async function loadAuthState() {
  const stored = await chrome.storage.local.get(['authToken', 'user', 'currentProjectId']);
  if (stored.authToken) {
    authState.token = stored.authToken;
    authState.user = stored.user;
    authState.currentProjectId = stored.currentProjectId;
  }
}

// Save auth state to storage
async function saveAuthState() {
  await chrome.storage.local.set({
    authToken: authState.token,
    user: authState.user,
    currentProjectId: authState.currentProjectId
  });
}

// API Client
class CogixAPIClient {
  constructor(baseURL = CONFIG.API_URL) {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (authState.token) {
      headers['Authorization'] = `Bearer ${authState.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // Authentication
  async login(email, password) {
    const response = await fetch(`${this.baseURL}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();
    authState.token = data.token;
    authState.user = data.user;
    await saveAuthState();
    return data;
  }

  async logout() {
    authState.token = null;
    authState.user = null;
    authState.currentProjectId = null;
    await chrome.storage.local.clear();
  }

  // Projects
  async getProjects() {
    return this.request('/api/v1/projects');
  }

  async selectProject(projectId) {
    authState.currentProjectId = projectId;
    await saveAuthState();
    return { success: true, projectId };
  }

  // File upload for eye tracking sessions
  async uploadSession(sessionData) {
    if (!authState.currentProjectId) {
      throw new Error('No project selected');
    }

    const formData = new FormData();
    
    // Convert session data to file
    const sessionBlob = new Blob([JSON.stringify(sessionData)], { type: 'application/json' });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `eye-tracking-session-${timestamp}.json`;
    
    formData.append('file', sessionBlob, filename);
    formData.append('file_type', 'eye_tracking_session');
    formData.append('description', `Eye tracking session recorded from ${sessionData.url || 'browser'}`);

    const response = await fetch(
      `${this.baseURL}/api/v1/projects/${authState.currentProjectId}/files/upload`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authState.token}`
        },
        body: formData
      }
    );

    if (!response.ok) {
      throw new Error('Failed to upload session');
    }

    return await response.json();
  }
}

const apiClient = new CogixAPIClient();

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);

  switch (request.action) {
    case 'login':
      apiClient.login(request.email, request.password)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response

    case 'logout':
      apiClient.logout()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'getAuthState':
      sendResponse({ 
        success: true, 
        data: {
          isAuthenticated: !!authState.token,
          user: authState.user,
          currentProjectId: authState.currentProjectId
        }
      });
      break;

    case 'getProjects':
      apiClient.getProjects()
        .then(projects => sendResponse({ success: true, data: projects }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'selectProject':
      apiClient.selectProject(request.projectId)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'uploadSession':
      apiClient.uploadSession(request.sessionData)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'startRecording':
      // Inject recording UI into current tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          // Check if the URL is accessible (not chrome://, chrome-extension://, etc.)
          const url = tabs[0].url;
          if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://')) {
            sendResponse({ success: false, error: 'Cannot record on browser internal pages' });
            return;
          }
          chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'startRecording',
            projectId: authState.currentProjectId 
          }, (response) => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              sendResponse(response);
            }
          });
        } else {
          sendResponse({ success: false, error: 'No active tab' });
        }
      });
      return true;

    case 'stopRecording':
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          // Check if the URL is accessible
          const url = tabs[0].url;
          if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://')) {
            sendResponse({ success: false, error: 'Cannot access browser internal pages' });
            return;
          }
          chrome.tabs.sendMessage(tabs[0].id, { action: 'stopRecording' }, (response) => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              sendResponse(response);
            }
          });
        } else {
          sendResponse({ success: false, error: 'No active tab' });
        }
      });
      return true;

    case 'getRecordingStatus':
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          // Check if the URL is accessible
          const url = tabs[0].url;
          if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://')) {
            sendResponse({ success: false, error: 'Cannot access browser internal pages', isRecording: false });
            return;
          }
          chrome.tabs.sendMessage(tabs[0].id, { action: 'getStatus' }, (response) => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: chrome.runtime.lastError.message, isRecording: false });
            } else {
              sendResponse(response);
            }
          });
        } else {
          sendResponse({ success: false, error: 'No active tab' });
        }
      });
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Handle extension icon click (when popup is not set)
chrome.action.onClicked.addListener((tab) => {
  // Could open options page or toggle recording
  console.log('Extension icon clicked');
});

// Keep service worker alive
const keepAlive = () => setInterval(() => {
  chrome.storage.local.get('keepAlive', () => {});
}, 20000);

keepAlive();