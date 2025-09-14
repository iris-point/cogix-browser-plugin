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
 * Get the currently selected project from storage
 */
export async function getSelectedProject(): Promise<ProjectInfo | null> {
  try {
    const data = await chrome.storage.sync.get(['selectedProject']);
    return data.selectedProject || null;
  } catch (error) {
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
  let lastProjectId: string | null = null;
  
  // Check every 2 seconds for project changes
  setInterval(async () => {
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

// Start monitoring when module loads
monitorProjectSelection();
