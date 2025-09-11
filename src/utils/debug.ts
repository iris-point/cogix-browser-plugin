/**
 * Debug utilities for Chrome Extension
 */

export const DEBUG = true; // Temporarily force debug mode on

export function debugLog(category: string, message: string, data?: any) {
  if (!DEBUG) return;
  
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${category}]`;
  
  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
  
  // Also store in chrome.storage for persistent debugging
  chrome.storage.local.get(['debugLogs'], (result) => {
    const logs = result.debugLogs || [];
    logs.push({
      timestamp,
      category,
      message,
      data: data ? JSON.stringify(data) : null
    });
    
    // Keep only last 100 logs
    if (logs.length > 100) {
      logs.shift();
    }
    
    chrome.storage.local.set({ debugLogs: logs });
  });
}

export function clearDebugLogs() {
  chrome.storage.local.remove('debugLogs');
  console.log('[DEBUG] Logs cleared');
}

export async function getDebugLogs() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['debugLogs'], (result) => {
      resolve(result.debugLogs || []);
    });
  });
}