/**
 * Bundled Content Script for Cogix Eye Tracking Extension
 * All-in-one content script without ES module imports
 */

// Inline the CogixContentManager class
class CogixContentManager {
  private overlayContainer: HTMLElement | null = null;

  constructor() {
    console.log('[Cogix Content] Manager initialized');
  }

  toggleOverlay(isAuthenticated: boolean, user: any, currentProjectId: string | null) {
    console.log('[Cogix Content] Toggle overlay called', { isAuthenticated, user, currentProjectId });
    
    // If overlay exists, remove it
    if (this.overlayContainer) {
      this.closeOverlay();
      return;
    }
    
    // Create overlay container
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.id = 'cogix-extension-overlay';
    this.overlayContainer.className = 'cogix-extension-overlay';
    
    // Add styles
    this.injectOverlayStyles();
    
    // Create the overlay content
    this.overlayContainer.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483647;
      ">
        <div style="
          background: white;
          border-radius: 12px;
          padding: 32px;
          max-width: 500px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
        ">
          <button id="cogix-close-btn" style="
            position: absolute;
            top: 16px;
            right: 16px;
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
          ">×</button>
          
          <h2 style="margin: 0 0 24px 0; color: #333;">Cogix Eye Tracking</h2>
          
          ${!isAuthenticated ? `
            <div>
              <h3 style="margin: 0 0 16px 0; color: #666;">Login Required</h3>
              <p style="color: #666; margin-bottom: 24px;">Please login to your Cogix account to start recording.</p>
              <button id="cogix-login-btn" style="
                background: #3b82f6;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 16px;
                width: 100%;
              ">Open Login Page</button>
            </div>
          ` : `
            <div>
              <p style="color: #666; margin-bottom: 16px;">Logged in as: <strong>${user?.email || 'Unknown'}</strong></p>
              
              <div style="margin-bottom: 24px;">
                <label style="display: block; margin-bottom: 8px; color: #666;">Select Project:</label>
                <select id="cogix-project-select" style="
                  width: 100%;
                  padding: 8px;
                  border: 1px solid #ddd;
                  border-radius: 4px;
                  font-size: 14px;
                ">
                  <option value="">Loading projects...</option>
                </select>
              </div>
              
              <div style="margin-bottom: 24px;">
                <label style="display: block; margin-bottom: 8px; color: #666;">Eye Tracking Provider:</label>
                <select id="cogix-provider-select" style="
                  width: 100%;
                  padding: 8px;
                  border: 1px solid #ddd;
                  border-radius: 4px;
                  font-size: 14px;
                ">
                  <option value="hh">HH Hardware Tracker</option>
                  <option value="webgazer">WebGazer (Webcam)</option>
                </select>
              </div>
              
              <button id="cogix-start-btn" style="
                background: #10b981;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 16px;
                width: 100%;
              ">Start Recording</button>
            </div>
          `}
        </div>
      </div>
    `;
    
    // Append to body
    document.body.appendChild(this.overlayContainer);
    
    // Add event listeners
    this.setupEventListeners(isAuthenticated);
    
    // Load projects if authenticated
    if (isAuthenticated) {
      this.loadProjects();
    }
  }
  
  private closeOverlay() {
    if (this.overlayContainer) {
      this.overlayContainer.remove();
      this.overlayContainer = null;
    }
  }
  
  private setupEventListeners(isAuthenticated: boolean) {
    // Close button
    const closeBtn = document.getElementById('cogix-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeOverlay());
    }
    
    // ESC key to close
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.closeOverlay();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
    
    if (!isAuthenticated) {
      // Login button
      const loginBtn = document.getElementById('cogix-login-btn');
      if (loginBtn) {
        loginBtn.addEventListener('click', () => {
          chrome.runtime.sendMessage({ action: 'openLoginPage' });
          this.closeOverlay();
        });
      }
    } else {
      // Start button
      const startBtn = document.getElementById('cogix-start-btn');
      if (startBtn) {
        startBtn.addEventListener('click', () => {
          const projectSelect = document.getElementById('cogix-project-select') as HTMLSelectElement;
          const providerSelect = document.getElementById('cogix-provider-select') as HTMLSelectElement;
          
          if (projectSelect?.value) {
            chrome.runtime.sendMessage({
              action: 'selectProject',
              projectId: projectSelect.value
            });
            
            chrome.runtime.sendMessage({
              action: 'startRecording',
              provider: providerSelect?.value || 'hh'
            });
            
            this.closeOverlay();
          } else {
            alert('Please select a project first');
          }
        });
      }
    }
  }
  
  private async loadProjects() {
    try {
      chrome.runtime.sendMessage({ action: 'getProjects' }, (response) => {
        if (response?.success && response.data) {
          const select = document.getElementById('cogix-project-select') as HTMLSelectElement;
          if (select) {
            select.innerHTML = '<option value="">Select a project...</option>';
            
            // The API returns { projects: [...], total: number, ... }
            // Extract the projects array from the response
            let projects: any[] = [];
            if (Array.isArray(response.data)) {
              projects = response.data;
            } else if (response.data.projects && Array.isArray(response.data.projects)) {
              projects = response.data.projects;
            } else if (response.data.items && Array.isArray(response.data.items)) {
              projects = response.data.items;
            }
            
            if (projects.length > 0) {
              projects.forEach((project: any) => {
                const option = document.createElement('option');
                option.value = project.id;
                option.textContent = project.name || project.title || `Project ${project.id}`;
                select.appendChild(option);
              });
            } else {
              console.log('[Cogix Content] No projects found in response:', response.data);
              const option = document.createElement('option');
              option.value = "";
              option.textContent = "No projects available";
              option.disabled = true;
              select.appendChild(option);
            }
          }
        } else if (response && !response.success) {
          console.error('[Cogix Content] Failed to load projects:', response.error);
        }
      });
    } catch (error) {
      console.error('[Cogix Content] Failed to load projects:', error);
    }
  }
  
  private injectOverlayStyles() {
    if (document.getElementById('cogix-overlay-styles')) {
      return; // Already injected
    }
    
    const style = document.createElement('style');
    style.id = 'cogix-overlay-styles';
    style.textContent = `
      .cogix-extension-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        z-index: 2147483647 !important;
        pointer-events: auto !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }
      
      .cogix-extension-overlay * {
        box-sizing: border-box !important;
        font-family: inherit !important;
      }
      
      #cogix-close-btn:hover {
        color: #000 !important;
      }
      
      #cogix-login-btn:hover,
      #cogix-start-btn:hover {
        opacity: 0.9 !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Stub methods for other functionality
  async startRecording(projectId: string) {
    console.log('[Cogix Content] Starting recording for project:', projectId);
    return { success: true };
  }

  async stopRecording() {
    console.log('[Cogix Content] Stopping recording');
    return { success: true };
  }

  async startCalibration() {
    console.log('[Cogix Content] Starting calibration');
    return { success: true };
  }

  async checkConnection() {
    return {
      connected: false,
      calibrated: false
    };
  }

  getStatus() {
    return {
      isRecording: false,
      connected: false,
      calibrated: false,
      projectId: null,
      duration: 0
    };
  }
}

// Initialize content manager
const contentManager = new CogixContentManager();

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request: any, _sender: any, sendResponse: any) => {
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

    case 'toggleOverlay':
      console.log('[Cogix Content] Toggling overlay', request);
      contentManager.toggleOverlay(
        request.isAuthenticated,
        request.user,
        request.currentProjectId
      );
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

console.log('[Cogix Content Script] Loaded and ready');