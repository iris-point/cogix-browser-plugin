/**
 * Centralized Project Storage Manager
 * 
 * Handles project selection storage and synchronization across popup and content script
 */

import { Storage } from "@plasmohq/storage"

const storage = new Storage()

export interface ProjectInfo {
  id: string;
  name: string;
  description?: string;
}

/**
 * Store selected project in both old and new formats for compatibility
 */
export async function storeSelectedProject(project: ProjectInfo): Promise<void> {
  try {
    console.log('💾 Storing selected project:', project.name, project.id);
    
    // Store in old format (for backward compatibility)
    await storage.set('selectedProjectId', project.id);
    await storage.set('selectedProjectName', project.name);
    
    // Store in new unified format (for validation)
    await chrome.storage.sync.set({
      selectedProject: {
        id: project.id,
        name: project.name,
        description: project.description || ''
      }
    });
    
    console.log('✅ Project stored successfully in both formats');
    
    // Broadcast change to all content scripts
    broadcastProjectChange(project);
    
  } catch (error) {
    console.error('❌ Failed to store selected project:', error);
    throw error;
  }
}

/**
 * Load selected project, trying new format first, then old format
 */
export async function loadSelectedProject(): Promise<ProjectInfo | null> {
  try {
    // Try new unified format first
    const projectData = await chrome.storage.sync.get(['selectedProject']);
    if (projectData.selectedProject) {
      console.log('📋 Loaded project from unified storage:', projectData.selectedProject.name);
      return projectData.selectedProject;
    }
    
    // Fallback to old format
    const storedProjectId = await storage.get('selectedProjectId');
    const storedProjectName = await storage.get('selectedProjectName');
    
    if (storedProjectId && storedProjectName) {
      const project: ProjectInfo = {
        id: storedProjectId,
        name: storedProjectName,
        description: ''
      };
      
      console.log('📋 Loaded project from old storage, migrating...', project.name);
      
      // Migrate to new format
      await storeSelectedProject(project);
      
      return project;
    }
    
    console.log('📋 No project found in storage');
    return null;
    
  } catch (error) {
    console.error('❌ Failed to load selected project:', error);
    return null;
  }
}

/**
 * Clear selected project from all storage formats
 */
export async function clearSelectedProject(): Promise<void> {
  try {
    console.log('🗑️ Clearing selected project...');
    
    // Clear old format
    await storage.remove('selectedProjectId');
    await storage.remove('selectedProjectName');
    
    // Clear new format
    await chrome.storage.sync.remove(['selectedProject']);
    
    console.log('✅ Project cleared from all storage formats');
    
    // Broadcast change
    broadcastProjectChange(null);
    
  } catch (error) {
    console.error('❌ Failed to clear selected project:', error);
    throw error;
  }
}

/**
 * Broadcast project change to all tabs/content scripts
 */
function broadcastProjectChange(project: ProjectInfo | null): void {
  try {
    // Query all tabs and send project update message
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'PROJECT_CHANGED',
            project: project
          }).catch(error => {
            // Ignore errors for tabs that don't have our content script
          });
        }
      });
    });
    
    console.log('📡 Broadcasted project change to all tabs:', project?.name || 'cleared');
  } catch (error) {
    console.warn('Failed to broadcast project change:', error);
  }
}

/**
 * Validate that a project is selected
 */
export async function validateProjectSelection(): Promise<ProjectInfo> {
  const project = await loadSelectedProject();
  
  if (!project) {
    throw new Error('No project selected. Please select a project first.');
  }
  
  if (!project.id || !project.name) {
    throw new Error('Invalid project data. Please reselect your project.');
  }
  
  return project;
}
