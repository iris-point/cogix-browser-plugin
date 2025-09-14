/**
 * Enhanced Upload Progress UI for Browser Plugin
 * Shows real-time upload progress with detailed stage-by-stage feedback
 */

interface UploadProgressState {
  stage: 'token' | 'video_upload' | 'gaze_upload' | 'session_submit' | 'complete' | 'error';
  progress: number;    // 0-100
  message: string;
  videoProgress?: number;
  gazeProgress?: number;
  sessionId?: string;
  fileSize?: number;
  uploadSpeed?: number;
  timeRemaining?: number;
  errorDetails?: string;
}

let progressOverlay: HTMLDivElement | null = null;

export function showUploadProgress(state: UploadProgressState) {
  if (!progressOverlay) {
    createProgressOverlay();
  }
  
  updateProgressOverlay(state);
}

export function hideUploadProgress() {
  if (progressOverlay) {
    progressOverlay.remove();
    progressOverlay = null;
  }
}

function createProgressOverlay() {
  progressOverlay = document.createElement('div');
  progressOverlay.id = 'cogix-upload-progress';
  progressOverlay.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    width: 380px !important;
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%) !important;
    border: 1px solid #475569 !important;
    border-radius: 12px !important;
    padding: 20px !important;
    color: white !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    font-size: 14px !important;
    z-index: 2147483647 !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) !important;
    backdrop-filter: blur(8px) !important;
    animation: slideIn 0.3s ease-out !important;
  `;
  
  // Add slide-in animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(progressOverlay);
}

function updateProgressOverlay(state: UploadProgressState) {
  if (!progressOverlay) return;
  
  const stageColor = state.stage === 'error' ? '#ef4444' : 
                    state.stage === 'complete' ? '#10b981' : '#3b82f6';
  
  const stageIcon = state.stage === 'error' ? '❌' :
                   state.stage === 'complete' ? '✅' :
                   state.stage === 'token' ? '🔑' :
                   state.stage === 'video_upload' ? '🎥' :
                   state.stage === 'gaze_upload' ? '👁️' :
                   state.stage === 'session_submit' ? '📤' : '⏳';

  const stageName = state.stage === 'token' ? 'Authentication' :
                   state.stage === 'video_upload' ? 'Video Upload' :
                   state.stage === 'gaze_upload' ? 'Gaze Data Upload' :
                   state.stage === 'session_submit' ? 'Session Submission' :
                   state.stage === 'complete' ? 'Complete' :
                   state.stage === 'error' ? 'Error' : 'Processing';

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)}KB` : `${mb.toFixed(1)}MB`;
  };

  // Format time remaining
  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds || seconds < 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // Format upload speed
  const formatUploadSpeed = (bytesPerSec?: number) => {
    if (!bytesPerSec) return '';
    const mbps = bytesPerSec / (1024 * 1024);
    return mbps < 1 ? `${(bytesPerSec / 1024).toFixed(1)}KB/s` : `${mbps.toFixed(1)}MB/s`;
  };
  
  progressOverlay.innerHTML = `
    <!-- Header -->
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
      <div style="
        width: 32px; height: 32px; border-radius: 50%; 
        background: ${stageColor}; 
        display: flex; align-items: center; justify-content: center;
        font-size: 16px;
      ">${stageIcon}</div>
      <div>
        <div style="font-weight: 600; font-size: 16px;">Cogix Recording Upload</div>
        <div style="font-size: 12px; color: #94a3b8;">${stageName}</div>
      </div>
    </div>
    
    <!-- Status Message -->
    <div style="margin-bottom: 12px; color: #e2e8f0; font-weight: 500;">
      ${state.message}
    </div>
    
    <!-- Main Progress Bar -->
    <div style="background: #475569; border-radius: 6px; height: 10px; margin-bottom: 16px; overflow: hidden; position: relative;">
      <div style="
        background: linear-gradient(90deg, ${stageColor}, ${stageColor}dd); 
        height: 100%; 
        width: ${state.progress}%; 
        transition: width 0.3s ease;
        border-radius: 6px;
        box-shadow: 0 0 8px ${stageColor}40;
      "></div>
      <div style="
        position: absolute; 
        top: 50%; left: 50%; 
        transform: translate(-50%, -50%);
        font-size: 11px; 
        font-weight: 600; 
        color: white;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      ">${state.progress}%</div>
    </div>
    
    <!-- Detailed Progress -->
    ${state.videoProgress !== undefined || state.gazeProgress !== undefined ? `
      <div style="margin-bottom: 12px;">
        ${state.videoProgress !== undefined ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 12px; color: #94a3b8;">🎥 Video File</span>
            <span style="font-size: 12px; color: #e2e8f0; font-weight: 500;">${state.videoProgress}%</span>
          </div>
          <div style="background: #475569; border-radius: 3px; height: 6px; margin-bottom: 8px; overflow: hidden;">
            <div style="background: #3b82f6; height: 100%; width: ${state.videoProgress}%; transition: width 0.3s ease;"></div>
          </div>
        ` : ''}
        
        ${state.gazeProgress !== undefined ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 12px; color: #94a3b8;">👁️ Gaze Data</span>
            <span style="font-size: 12px; color: #e2e8f0; font-weight: 500;">${state.gazeProgress}%</span>
          </div>
          <div style="background: #475569; border-radius: 3px; height: 6px; margin-bottom: 8px; overflow: hidden;">
            <div style="background: #10b981; height: 100%; width: ${state.gazeProgress}%; transition: width 0.3s ease;"></div>
          </div>
        ` : ''}
      </div>
    ` : ''}
    
    <!-- Upload Stats -->
    ${state.fileSize || state.uploadSpeed || state.timeRemaining ? `
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px; font-size: 11px; color: #94a3b8;">
        ${state.fileSize ? `
          <div style="text-align: center; padding: 6px; background: rgba(255,255,255,0.05); border-radius: 4px;">
            <div style="color: #e2e8f0; font-weight: 500;">${formatFileSize(state.fileSize)}</div>
            <div>Size</div>
          </div>
        ` : '<div></div>'}
        
        ${state.uploadSpeed ? `
          <div style="text-align: center; padding: 6px; background: rgba(255,255,255,0.05); border-radius: 4px;">
            <div style="color: #e2e8f0; font-weight: 500;">${formatUploadSpeed(state.uploadSpeed)}</div>
            <div>Speed</div>
          </div>
        ` : '<div></div>'}
        
        ${state.timeRemaining ? `
          <div style="text-align: center; padding: 6px; background: rgba(255,255,255,0.05); border-radius: 4px;">
            <div style="color: #e2e8f0; font-weight: 500;">${formatTimeRemaining(state.timeRemaining)}</div>
            <div>Remaining</div>
          </div>
        ` : '<div></div>'}
      </div>
    ` : ''}
    
    <!-- Session ID -->
    ${state.sessionId ? `
      <div style="font-size: 11px; color: #64748b; margin-bottom: 8px; word-break: break-all;">
        Session: ${state.sessionId}
      </div>
    ` : ''}
    
    <!-- Success Message -->
    ${state.stage === 'complete' ? `
      <div style="
        margin-top: 12px; padding: 12px; 
        background: rgba(16, 185, 129, 0.1); 
        border: 1px solid rgba(16, 185, 129, 0.3);
        border-radius: 6px; 
        font-size: 13px; 
        color: #10b981;
        text-align: center;
      ">
        <div style="font-weight: 600; margin-bottom: 4px;">✅ Upload Completed!</div>
        <div style="font-size: 11px; opacity: 0.8;">Your recording has been saved successfully</div>
      </div>
    ` : ''}
    
    <!-- Error Message -->
    ${state.stage === 'error' ? `
      <div style="
        margin-top: 12px; padding: 12px; 
        background: rgba(239, 68, 68, 0.1); 
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 6px; 
        font-size: 13px; 
        color: #ef4444;
      ">
        <div style="font-weight: 600; margin-bottom: 4px;">❌ Upload Failed</div>
        ${state.errorDetails ? `
          <div style="font-size: 11px; opacity: 0.8; margin-top: 4px;">
            ${state.errorDetails}
          </div>
        ` : ''}
        <div style="font-size: 11px; opacity: 0.8; margin-top: 8px;">
          Recording saved locally for retry
        </div>
      </div>
    ` : ''}
  `;
  
  // Auto-hide after completion or error
  if (state.stage === 'complete') {
    setTimeout(() => {
      hideUploadProgress();
    }, 4000);
  } else if (state.stage === 'error') {
    setTimeout(() => {
      hideUploadProgress();
    }, 8000);
  }
}
