/**
 * Project Validation Utilities
 * 
 * Ensures users have selected a valid project before performing operations
 */

export interface ProjectInfo {
  id: string;
  name: string;
  description?: string;
}

/**
 * Check if we're on a restricted Chrome page
 */
function isRestrictedPage(): boolean {
  const url = window.location.href;
  return url.startsWith('chrome://') || 
         url.startsWith('chrome-extension://') ||
         url.startsWith('edge://') ||
         url.startsWith('about:') ||
         url === 'about:blank' ||
         url === '';
}

/**
 * Check if extension context is still valid
 */
function isExtensionContextValid(): boolean {
  try {
    // Try to access chrome.runtime.id - this will throw if context is invalid
    return chrome?.runtime?.id !== undefined;
  } catch {
    return false;
  }
}

/**
 * Get the currently selected project from storage
 */
export async function getSelectedProject(): Promise<ProjectInfo | null> {
  // Check if we're on a restricted page or context is invalid
  if (isRestrictedPage() || !isExtensionContextValid()) {
    console.warn('Cannot access extension storage on restricted page or invalid context');
    return null;
  }
  
  try {
    const data = await chrome.storage.sync.get(['selectedProject']);
    return data.selectedProject || null;
  } catch (error: any) {
    // Handle specific error cases
    if (error?.message?.includes('Extension context invalidated')) {
      console.warn('Extension was reloaded. Please refresh the page.');
      // Show user-friendly message instead of throwing error
      showExtensionReloadedNotification();
      return null;
    }
    console.error('Failed to get selected project:', error);
    return null;
  }
}

/**
 * Validate that a project is selected and show error if not
 * Uses real-time validation to avoid storage sync delays
 */
export async function validateProjectSelection(): Promise<ProjectInfo> {
  // Try multiple storage sources to handle sync delays
  let project = await getSelectedProject();
  
  // If no project found, try requesting fresh data from popup
  if (!project) {
    try {
      console.log('🔄 No project in storage, requesting fresh data...');
      
      // Send message to background to get fresh project data
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SELECTED_PROJECT'
      });
      
      if (response?.project) {
        project = response.project;
        console.log('📋 Got fresh project data:', project.name);
      }
    } catch (error) {
      console.warn('Failed to get fresh project data:', error);
    }
  }
  
  if (!project) {
    showProjectSelectionRequired();
    throw new Error('No project selected. Please select a project first.');
  }
  
  if (!project.id || !project.name) {
    showProjectSelectionRequired();
    throw new Error('Invalid project data. Please reselect your project.');
  }
  
  console.log('✅ Project validation passed:', project.name);
  return project;
}

/**
 * Show extension reloaded notification
 */
export function showExtensionReloadedNotification(): void {
  // Remove any existing notification
  const existingNotification = document.getElementById('extension-reloaded-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  const notification = document.createElement('div');
  notification.id = 'extension-reloaded-notification';
  notification.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    width: 360px !important;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
    color: white !important;
    padding: 16px !important;
    border-radius: 12px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    font-size: 14px !important;
    z-index: 2147483647 !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
    animation: slideInFromTop 0.3s ease-out !important;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: start; gap: 12px;">
      <div style="font-size: 20px;">⚠️</div>
      <div style="flex: 1;">
        <div style="font-weight: 600; margin-bottom: 4px;">Extension Updated</div>
        <div style="font-size: 13px; opacity: 0.9; margin-bottom: 12px;">
          The extension was reloaded. Please refresh this page to reconnect.
        </div>
        <button id="refresh-page-button" style="
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        ">Refresh Page</button>
      </div>
      <button id="close-reload-notification" style="
        background: transparent;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0;
        font-size: 18px;
        line-height: 1;
        opacity: 0.7;
        transition: opacity 0.2s ease;
      ">×</button>
    </div>
  `;
  
  // Add animation styles if not already present
  if (!document.getElementById('extension-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'extension-notification-styles';
    style.textContent = `
      @keyframes slideInFromTop {
        from {
          transform: translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      @keyframes slideInFromBottom {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  // Add event listeners
  const refreshButton = document.getElementById('refresh-page-button');
  if (refreshButton) {
    refreshButton.onclick = () => {
      window.location.reload();
    };
  }
  
  const closeButton = document.getElementById('close-reload-notification');
  if (closeButton) {
    closeButton.onclick = () => {
      notification.remove();
    };
  }
  
  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.remove();
    }
  }, 10000);
}

/**
 * Show project selection required notification
 */
export function showProjectSelectionRequired(): void {
  // Remove any existing notification
  const existingNotification = document.getElementById('project-selection-required');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  const notification = document.createElement('div');
  notification.id = 'project-selection-required';
  notification.style.cssText = `
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    width: 420px !important;
    max-width: 90vw !important;
    background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%) !important;
    color: white !important;
    padding: 24px !important;
    border-radius: 16px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    font-size: 14px !important;
    z-index: 2147483647 !important;
    box-shadow: 0 20px 64px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1) !important;
    backdrop-filter: blur(12px) !important;
    animation: projectModalSlideIn 0.3s ease-out !important;
    text-align: center !important;
  `;
  
  notification.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
    
    <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600;">
      Project Selection Required
    </h2>
    
    <p style="margin: 0 0 20px 0; color: rgba(255, 255, 255, 0.9); line-height: 1.5;">
      You need to select a project before you can start recording or run connection tests.
    </p>
    
    <div style="
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
      text-align: left;
    ">
      <div style="font-weight: 600; margin-bottom: 8px;">How to select a project:</div>
      <div style="font-size: 13px; color: rgba(255, 255, 255, 0.8);">
        1. Click the extension icon in your browser toolbar<br>
        2. Go to the "Home" or "Eye Tracking" tab<br>
        3. Choose a project from the dropdown<br>
        4. Return to this page and try again
      </div>
    </div>
    
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button id="open-extension-popup" style="
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      ">Open Extension</button>
      
      <button id="dismiss-project-notification" style="
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      ">Dismiss</button>
    </div>
  `;
  
  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes projectModalSlideIn {
      from {
        transform: translate(-50%, -50%) scale(0.9);
        opacity: 0;
      }
      to {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  // Add event listeners
  const openExtensionButton = document.getElementById('open-extension-popup');
  if (openExtensionButton) {
    openExtensionButton.onclick = () => {
      // Send message to background script to open popup
      chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
      notification.remove();
    };
  }
  
  const dismissButton = document.getElementById('dismiss-project-notification');
  if (dismissButton) {
    dismissButton.onclick = () => {
      notification.remove();
    };
  }
  
  // Close on escape key
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      notification.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
  
  // Close on backdrop click
  notification.onclick = (e) => {
    if (e.target === notification) {
      notification.remove();
    }
  };
  
  // Auto-dismiss after 15 seconds
  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.remove();
    }
  }, 15000);
}

/**
 * Show project selection success notification
 */
export function showProjectSelected(project: ProjectInfo): void {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed !important;
    bottom: 20px !important;
    right: 20px !important;
    width: 320px !important;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
    color: white !important;
    padding: 16px !important;
    border-radius: 12px !important;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif !important;
    font-size: 14px !important;
    z-index: 2147483647 !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
    animation: slideInFromBottom 0.3s ease-out !important;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="font-size: 20px;">✅</div>
      <div>
        <div style="font-weight: 600;">Project Selected</div>
        <div style="font-size: 12px; opacity: 0.9;">${project.name}</div>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.remove();
    }
  }, 3000);
}

/**
 * Check if project selection has changed and show notification
 */
export async function monitorProjectSelection(): Promise<void> {
  // Don't monitor on restricted pages
  if (isRestrictedPage()) {
    console.log('Skipping project monitoring on restricted page');
    return;
  }
  
  let lastProjectId: string | null = null;
  
  // Check every 2 seconds for project changes
  const intervalId = setInterval(async () => {
    // Stop monitoring if context becomes invalid
    if (!isExtensionContextValid()) {
      clearInterval(intervalId);
      console.warn('Extension context invalid, stopping project monitoring');
      return;
    }
    
    const project = await getSelectedProject();
    const currentProjectId = project?.id || null;
    
    if (currentProjectId !== lastProjectId) {
      if (currentProjectId && project) {
        showProjectSelected(project);
      }
      lastProjectId = currentProjectId;
    }
  }, 2000);
}

// Start monitoring when module loads (only on valid pages)
if (!isRestrictedPage() && isExtensionContextValid()) {
  monitorProjectSelection();
}
