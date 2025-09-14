/**
 * Error Handling and Retry Mechanisms for Browser Plugin
 * 
 * Provides comprehensive error handling, retry logic, and recovery mechanisms
 * for upload failures and network issues.
 */

export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryCondition?: (error: Error) => boolean;
}

export interface FailedSession {
  sessionId: string;
  projectId: string;
  videoBlob: number[]; // Serialized Uint8Array
  gazeData: any[];
  metadata: any;
  uploadFailed: boolean;
  error: string;
  timestamp: number;
  retryCount: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryCondition: (error: Error) => {
    // Retry on network errors, timeouts, and 5xx server errors
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('fetch') ||
      message.includes('5') || // 5xx errors
      message.includes('temporarily unavailable')
    );
  }
};

/**
 * Enhanced retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;
  let delay = config.initialDelay;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry if this is the last attempt or retry condition fails
      if (attempt === config.maxAttempts || 
          (config.retryCondition && !config.retryCondition(lastError))) {
        break;
      }

      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Exponential backoff with max delay cap
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
    }
  }

  throw lastError;
}

/**
 * Store failed session for later retry
 */
export async function storeFailedSession(
  sessionId: string,
  projectId: string,
  videoBlob: Blob,
  gazeData: any[],
  metadata: any,
  error: Error
): Promise<void> {
  try {
    // Convert blob to serializable format
    const videoArray = Array.from(new Uint8Array(await videoBlob.arrayBuffer()));
    
    const failedSession: FailedSession = {
      sessionId,
      projectId,
      videoBlob: videoArray,
      gazeData,
      metadata: {
        ...metadata,
        originalSize: videoBlob.size,
        originalType: videoBlob.type
      },
      uploadFailed: true,
      error: error.message,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    // Get existing failed sessions
    const failedSessions = getFailedSessions();
    failedSessions.push(failedSession);
    
    // Keep only the last 10 failed sessions to avoid storage bloat
    if (failedSessions.length > 10) {
      failedSessions.splice(0, failedSessions.length - 10);
    }
    
    localStorage.setItem('failedRecordings', JSON.stringify(failedSessions));
    console.log('Session stored locally for retry:', sessionId);
    
    // Show notification about failed upload
    showRetryNotification(sessionId);
    
  } catch (storageError) {
    console.error('Failed to store session locally:', storageError);
  }
}

/**
 * Get all failed sessions from local storage
 */
export function getFailedSessions(): FailedSession[] {
  try {
    return JSON.parse(localStorage.getItem('failedRecordings') || '[]');
  } catch (error) {
    console.error('Failed to parse failed sessions:', error);
    return [];
  }
}

/**
 * Remove a failed session from local storage
 */
export function removeFailedSession(sessionId: string): void {
  try {
    const failedSessions = getFailedSessions();
    const filtered = failedSessions.filter(session => session.sessionId !== sessionId);
    localStorage.setItem('failedRecordings', JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to remove failed session:', error);
  }
}

/**
 * Retry a failed session upload
 */
export async function retryFailedSession(
  sessionId: string,
  uploadFunction: (videoFile: File, gazeFile: File, metadata: any) => Promise<any>
): Promise<boolean> {
  try {
    const failedSessions = getFailedSessions();
    const session = failedSessions.find(s => s.sessionId === sessionId);
    
    if (!session) {
      console.error('Failed session not found:', sessionId);
      return false;
    }

    // Increment retry count
    session.retryCount++;
    
    // Convert back to blob and files
    const videoBlob = new Blob([new Uint8Array(session.videoBlob)], { 
      type: session.metadata.originalType || 'video/webm' 
    });
    
    const videoFile = new File([videoBlob], `recording-${sessionId}.webm`, { 
      type: videoBlob.type 
    });
    
    const gazeFile = new File([JSON.stringify(session.gazeData)], `gaze-data-${sessionId}.json`, { 
      type: 'application/json' 
    });

    console.log(`Retrying upload for session ${sessionId} (attempt ${session.retryCount})`);

    // Attempt retry with backoff
    await retryWithBackoff(
      () => uploadFunction(videoFile, gazeFile, session.metadata),
      {
        maxAttempts: 3,
        initialDelay: 2000, // Start with 2 seconds for retries
        retryCondition: (error) => {
          // More conservative retry condition for manual retries
          const message = error.message.toLowerCase();
          return (
            message.includes('network') ||
            message.includes('timeout') ||
            message.includes('temporarily')
          );
        }
      }
    );

    // Success - remove from failed sessions
    removeFailedSession(sessionId);
    console.log('Retry successful for session:', sessionId);
    
    // Show success notification
    showSuccessNotification(sessionId);
    
    return true;
    
  } catch (error) {
    console.error('Retry failed for session:', sessionId, error);
    
    // Update retry count in storage
    const failedSessions = getFailedSessions();
    const sessionIndex = failedSessions.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex !== -1) {
      failedSessions[sessionIndex].retryCount++;
      failedSessions[sessionIndex].error = error instanceof Error ? error.message : String(error);
      localStorage.setItem('failedRecordings', JSON.stringify(failedSessions));
    }
    
    return false;
  }
}

/**
 * Show notification about failed upload with retry option
 */
function showRetryNotification(sessionId: string): void {
  const notification = document.createElement('div');
  notification.id = `retry-notification-${sessionId}`;
  notification.style.cssText = `
    position: fixed !important;
    bottom: 20px !important;
    right: 20px !important;
    width: 350px !important;
    background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%) !important;
    color: white !important;
    padding: 16px !important;
    border-radius: 8px !important;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif !important;
    font-size: 14px !important;
    z-index: 2147483647 !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
    animation: slideInFromBottom 0.3s ease-out !important;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
      <div style="font-size: 18px;">⚠️</div>
      <div>
        <div style="font-weight: 600;">Upload Failed</div>
        <div style="font-size: 12px; opacity: 0.9;">Session saved for retry</div>
      </div>
    </div>
    
    <div style="font-size: 12px; opacity: 0.8; margin-bottom: 12px;">
      Session: ${sessionId.substring(0, 20)}...
    </div>
    
    <div style="display: flex; gap: 8px;">
      <button id="retry-${sessionId}" style="
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        flex: 1;
      ">Retry Now</button>
      
      <button id="dismiss-${sessionId}" style="
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        flex: 1;
      ">Dismiss</button>
    </div>
  `;
  
  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
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
  
  document.body.appendChild(notification);
  
  // Add event listeners
  const retryButton = document.getElementById(`retry-${sessionId}`);
  const dismissButton = document.getElementById(`dismiss-${sessionId}`);
  
  if (retryButton) {
    retryButton.onclick = () => {
      // This would need to be connected to the actual retry function
      console.log('Retry requested for session:', sessionId);
      notification.remove();
    };
  }
  
  if (dismissButton) {
    dismissButton.onclick = () => {
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
 * Show success notification after successful retry
 */
function showSuccessNotification(sessionId: string): void {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed !important;
    bottom: 20px !important;
    right: 20px !important;
    width: 300px !important;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
    color: white !important;
    padding: 16px !important;
    border-radius: 8px !important;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif !important;
    font-size: 14px !important;
    z-index: 2147483647 !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
    animation: slideInFromBottom 0.3s ease-out !important;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="font-size: 18px;">✅</div>
      <div>
        <div style="font-weight: 600;">Retry Successful</div>
        <div style="font-size: 12px; opacity: 0.9;">Session uploaded successfully</div>
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
 * Get retry statistics
 */
export function getRetryStats(): {
  totalFailed: number;
  totalRetries: number;
  oldestFailure: number | null;
} {
  const failedSessions = getFailedSessions();
  
  return {
    totalFailed: failedSessions.length,
    totalRetries: failedSessions.reduce((sum, session) => sum + session.retryCount, 0),
    oldestFailure: failedSessions.length > 0 
      ? Math.min(...failedSessions.map(s => s.timestamp))
      : null
  };
}

/**
 * Clean up old failed sessions (older than 7 days)
 */
export function cleanupOldFailedSessions(): void {
  try {
    const failedSessions = getFailedSessions();
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    const filtered = failedSessions.filter(session => session.timestamp > weekAgo);
    
    if (filtered.length !== failedSessions.length) {
      localStorage.setItem('failedRecordings', JSON.stringify(filtered));
      console.log(`Cleaned up ${failedSessions.length - filtered.length} old failed sessions`);
    }
  } catch (error) {
    console.error('Failed to cleanup old sessions:', error);
  }
}

// Auto-cleanup on module load
cleanupOldFailedSessions();
