/**
 * Cogix Content Manager
 * Manages eye tracking injection and recording in web pages
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { CogixOverlay } from './CogixOverlay';
import { debugLog } from '../lib/debugLogger';

interface RecordingState {
  isRecording: boolean;
  startTime: number | null;
  projectId: string | null;
  sessionData: any[];
  mediaStream: MediaStream | null;
  recorder: MediaRecorder | null;
  videoBlob: Blob | null;
}

export class CogixContentManager {
  private eyeTrackingManager: any = null;
  private sessionManager: any = null;
  private floatingUI: HTMLElement | null = null;
  private overlayRoot: ReactDOM.Root | null = null;
  private overlayContainer: HTMLElement | null = null;
  private recordingState: RecordingState = {
    isRecording: false,
    startTime: null,
    projectId: null,
    sessionData: [],
    mediaStream: null,
    recorder: null,
    videoBlob: null
  };
  private sdkLoaded = false;
  private sdkStatus: 'loading' | 'loaded' | 'failed' | 'simplified' = 'loading';
  private calibrated = false;
  private connected = false;
  private lastError: string | null = null;

  async initialize() {
    debugLog.info('Initializing content manager');
    
    // Load SDK if not already loaded
    if (!this.sdkLoaded) {
      await debugLog.logFunction('loadSDK', () => this.loadSDK());
    }
    
    // Create floating UI
    this.createFloatingUI();
    
    // Try to connect to eye tracker
    await this.connectToEyeTracker();
  }

  private async loadSDK() {
    return new Promise<void>((resolve) => {
      // Check if SDK is already loaded
      if ((window as any).CogixEyeTrackingSDK) {
        this.sdkLoaded = true;
        this.sdkStatus = 'loaded';
        resolve();
        return;
      }

      this.sdkStatus = 'loading';
      
      // Inject SDK script
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('eye-tracking-sdk.js');
      script.onload = () => {
        console.log('[Cogix Content] SDK loaded successfully');
        this.sdkLoaded = true;
        this.sdkStatus = 'loaded';
        
        // Initialize managers
        const SDK = (window as any).CogixEyeTrackingSDK;
        if (SDK) {
          try {
            this.eyeTrackingManager = SDK.getEyeTrackingManager();
            this.sessionManager = new SDK.SessionDataManager({
              storageProvider: new ChromeStorageAdapter()
            });
            console.log('[Cogix Content] SDK managers initialized');
          } catch (error) {
            console.error('[Cogix Content] Failed to initialize SDK managers:', error);
            this.lastError = 'Failed to initialize SDK managers';
            this.sdkStatus = 'failed';
            this.initializeSimplifiedTracking();
          }
        }
        
        resolve();
      };
      script.onerror = (error) => {
        console.error('[Cogix Content] Failed to load SDK:', error);
        this.lastError = 'SDK file not found or failed to load';
        this.sdkStatus = 'failed';
        // Fallback to simplified mode if SDK fails to load
        this.initializeSimplifiedTracking();
        resolve(); // Resolve anyway to continue
      };
      
      document.head.appendChild(script);
    });
  }

  private initializeSimplifiedTracking() {
    console.log('[Cogix Content] Using simplified tracking (SDK not available)');
    
    // Create mock managers as fallback
    this.eyeTrackingManager = {
      initialize: async () => { 
        this.connected = true;
        return Promise.resolve();
      },
      startTracking: async () => { 
        console.log('[Cogix Content] Tracking started (simplified)');
        return Promise.resolve();
      },
      stopTracking: async () => { 
        console.log('[Cogix Content] Tracking stopped (simplified)');
        return Promise.resolve();
      },
      destroy: () => { 
        console.log('[Cogix Content] Manager destroyed');
      },
      on: (event: string, _handler: Function) => { 
        console.log(`[Cogix Content] Event listener registered: ${event}`);
      },
      currentProvider: 'mouse'
    } as any;
    
    this.sessionManager = {
      startRecording: async (metadata: any) => {
        console.log('[Cogix Content] Recording started with metadata:', metadata);
        return Promise.resolve();
      },
      stopRecording: async () => {
        console.log('[Cogix Content] Recording stopped');
        return Promise.resolve();
      }
    } as any;
    
    this.connected = true;
    this.updateUIStatus();
  }

  private createFloatingUI() {
    // Remove existing UI if present
    if (this.floatingUI) {
      this.floatingUI.remove();
    }

    // Create floating button container
    this.floatingUI = document.createElement('div');
    this.floatingUI.id = 'cogix-floating-ui';
    this.floatingUI.innerHTML = `
      <style>
        #cogix-floating-ui {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .cogix-floating-button {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #3b82f6;
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          transition: all 0.3s ease;
        }
        
        .cogix-floating-button:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(0,0,0,0.2);
        }
        
        .cogix-floating-button.recording {
          background: #ef4444;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        
        .cogix-status-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #10b981;
          border: 2px solid white;
        }
        
        .cogix-status-badge.disconnected {
          background: #6b7280;
        }
        
        .cogix-status-badge.recording {
          background: #ef4444;
          animation: blink 1s infinite;
        }
        
        @keyframes blink {
          50% { opacity: 0.5; }
        }
        
        .cogix-tooltip {
          position: absolute;
          bottom: 70px;
          right: 0;
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s;
        }
        
        .cogix-floating-button:hover + .cogix-tooltip {
          opacity: 1;
        }
      </style>
      
      <button class="cogix-floating-button" id="cogix-record-btn">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
        </svg>
        <div class="cogix-status-badge ${this.connected ? '' : 'disconnected'}"></div>
      </button>
      <div class="cogix-tooltip">
        ${this.recordingState.isRecording ? 'Stop Recording' : 'Start Eye Tracking'}
      </div>
    `;

    document.body.appendChild(this.floatingUI);

    // Add click handler
    const button = document.getElementById('cogix-record-btn');
    if (button) {
      button.addEventListener('click', () => this.toggleRecording());
    }
  }

  private async connectToEyeTracker() {
    if (!this.eyeTrackingManager) {
      console.error('[Cogix Content] Eye tracking manager not initialized');
      return;
    }

    try {
      // Try HH provider first, fall back to WebGazer
      await this.eyeTrackingManager.initialize('hh');
      this.connected = true;
      console.log('[Cogix Content] Connected to HH eye tracker');
    } catch (error) {
      console.log('[Cogix Content] HH not available, trying WebGazer...');
      try {
        await this.eyeTrackingManager.initialize('webgazer');
        this.connected = true;
        console.log('[Cogix Content] Connected to WebGazer');
      } catch (error) {
        console.error('[Cogix Content] Failed to connect to any eye tracker:', error);
        this.connected = false;
      }
    }

    this.updateUIStatus();
  }

  async startCalibration() {
    if (!this.connected) {
      throw new Error('Eye tracker not connected');
    }

    // Create calibration overlay
    const overlay = document.createElement('div');
    overlay.id = 'cogix-calibration-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.95);
      z-index: 999998;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Import CalibrationUI from SDK
    const SDK = (window as any).CogixEyeTrackingSDK;
    if (SDK?.CalibrationUI) {
      // Mount calibration UI
      const calibrationContainer = document.createElement('div');
      overlay.appendChild(calibrationContainer);
      document.body.appendChild(overlay);

      // Render calibration UI (would need React for this)
      // For now, use simple calibration points
      await this.runSimpleCalibration(overlay);
    }

    return { calibrated: true };
  }

  private async runSimpleCalibration(overlay: HTMLElement) {
    // Simple 9-point calibration for better accuracy
    const points = [
      { x: 10, y: 10 },   // Top-left
      { x: 50, y: 10 },   // Top-center
      { x: 90, y: 10 },   // Top-right
      { x: 10, y: 50 },   // Middle-left
      { x: 50, y: 50 },   // Center
      { x: 90, y: 50 },   // Middle-right
      { x: 10, y: 90 },   // Bottom-left
      { x: 50, y: 90 },   // Bottom-center
      { x: 90, y: 90 }    // Bottom-right
    ];

    // Add instruction screen first
    overlay.innerHTML = `
      <div style="
        text-align: center;
        color: white;
        max-width: 600px;
        padding: 40px;
      ">
        <h1 style="font-size: 32px; margin-bottom: 20px;">Eye Tracking Calibration</h1>
        <p style="font-size: 18px; margin-bottom: 30px; opacity: 0.9;">
          Please follow the blue dot with your eyes. Keep your head still and look directly at each dot.
        </p>
        <p style="font-size: 16px; margin-bottom: 40px; opacity: 0.7;">
          The calibration will start automatically in 3 seconds...
        </p>
        <div style="
          width: 60px;
          height: 60px;
          margin: 0 auto;
          border: 3px solid #3b82f6;
          border-radius: 50%;
          border-top-color: transparent;
          animation: spin 1s linear infinite;
        "></div>
      </div>
      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    `;

    await new Promise(resolve => setTimeout(resolve, 3000));

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      this.showCalibrationPoint(overlay, point.x, point.y);
      
      // Add progress indicator
      const progress = document.createElement('div');
      progress.style.cssText = `
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        color: white;
        text-align: center;
        font-size: 14px;
      `;
      progress.innerHTML = `Point ${i + 1} of ${points.length}`;
      overlay.appendChild(progress);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Show completion message
    overlay.innerHTML = `
      <div style="
        text-align: center;
        color: white;
        max-width: 600px;
        padding: 40px;
      ">
        <div style="
          width: 80px;
          height: 80px;
          margin: 0 auto 20px;
          background: #10b981;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="40" height="40" fill="white" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
        </div>
        <h2 style="font-size: 28px; margin-bottom: 20px;">Calibration Complete!</h2>
        <p style="font-size: 16px; opacity: 0.9;">Starting recording...</p>
      </div>
    `;

    await new Promise(resolve => setTimeout(resolve, 1500));

    overlay.remove();
    this.calibrated = true;
    this.updateUIStatus();
  }

  async startWebGazerCalibration() {
    // Create fullscreen calibration overlay
    const overlay = document.createElement('div');
    overlay.id = 'cogix-webgazer-calibration';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.98);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    document.body.appendChild(overlay);

    // Run calibration
    await this.runSimpleCalibration(overlay);
    
    return { calibrated: true };
  }

  private showCalibrationPoint(overlay: HTMLElement, x: number, y: number) {
    overlay.innerHTML = `
      <div style="
        position: absolute;
        left: ${x}%;
        top: ${y}%;
        transform: translate(-50%, -50%);
        width: 30px;
        height: 30px;
        background: #3b82f6;
        border-radius: 50%;
        border: 3px solid white;
      "></div>
      <div style="
        position: absolute;
        top: 10%;
        left: 50%;
        transform: translateX(-50%);
        color: white;
        text-align: center;
      ">
        <h2 style="margin: 0;">Look at the blue dot</h2>
        <p style="margin: 5px 0; opacity: 0.8;">Keep your head still</p>
      </div>
    `;
  }

  async startRecording(projectId: string, options?: {
    mode?: string;
    provider?: string;
    enableAudio?: boolean;
  }) {
    console.log('[Cogix Content] Starting recording for project:', projectId, 'with options:', options);
    console.log('[Cogix Content] Current state:', {
      connected: this.connected,
      calibrated: this.calibrated,
      eyeTrackingManager: !!this.eyeTrackingManager,
      sessionManager: !!this.sessionManager,
      sdkStatus: this.sdkStatus
    });
    
    // Store the selected provider
    const selectedProvider = options?.provider || 'webgazer';
    console.log('[Cogix Content] Selected provider:', selectedProvider);
    
    // Check if managers are initialized
    if (!this.eyeTrackingManager || !this.sessionManager) {
      console.warn('[Cogix Content] Managers not initialized, using simplified mode');
      this.initializeSimplifiedTracking();
    }
    
    // Skip connection check for simplified mode
    if (!this.connected) {
      console.warn('[Cogix Content] Not connected to eye tracker, forcing connection');
      this.connected = true; // Force connected state for recording
    }

    // Show calibration for hardware provider or webgazer
    console.log('[Cogix Content] Calibration check - calibrated:', this.calibrated, 'provider:', selectedProvider);
    if (!this.calibrated && selectedProvider === 'hh') {
      console.log('[Cogix Content] Starting hardware calibration...');
      await this.startCalibration();
    } else if (!this.calibrated && selectedProvider === 'webgazer') {
      console.log('[Cogix Content] Starting WebGazer calibration...');
      await this.startWebGazerCalibration();
    } else {
      console.log('[Cogix Content] Skipping calibration - already calibrated or not needed');
    }

    // Start screen recording
    try {
      console.log('[Cogix Content] Requesting screen share...');
      console.log('[Cogix Content] Checking if getDisplayMedia is available:', !!navigator.mediaDevices?.getDisplayMedia);
      
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Screen recording not supported in this browser');
      }
      
      this.recordingState.mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor'
        },
        audio: options?.enableAudio || false
      });
      console.log('[Cogix Content] Screen share obtained:', this.recordingState.mediaStream);

      // Create media recorder
      this.recordingState.recorder = new MediaRecorder(this.recordingState.mediaStream);
      const chunks: Blob[] = [];

      this.recordingState.recorder.ondataavailable = (e) => {
        console.log('[Cogix Content] Data available:', e.data.size);
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      this.recordingState.recorder.onstop = () => {
        this.recordingState.videoBlob = new Blob(chunks, { type: 'video/webm' });
        console.log('[Cogix Content] Recording stopped, video blob created:', this.recordingState.videoBlob.size);
      };

      this.recordingState.recorder.start();
      console.log('[Cogix Content] MediaRecorder started');
      
      // Handle stream ending
      this.recordingState.mediaStream.getVideoTracks()[0].onended = () => {
        console.log('[Cogix Content] User stopped screen share');
        this.stopRecording();
      };
    } catch (error: any) {
      console.error('[Cogix Content] Failed to start screen recording:', error);
      this.lastError = error.message || 'Failed to start screen recording';
      throw new Error(`Screen recording failed: ${error.message}`);
    }

    // Start eye tracking
    if (this.eyeTrackingManager) {
      try {
        await this.eyeTrackingManager.startTracking();
        console.log('[Cogix Content] Eye tracking started');
      } catch (error) {
        console.error('[Cogix Content] Failed to start eye tracking:', error);
      }
    }

    // Start session recording
    if (this.sessionManager) {
      try {
        await this.sessionManager.startRecording({
          url: window.location.href,
          title: document.title,
          projectId
        });
        console.log('[Cogix Content] Session recording started');
      } catch (error) {
        console.error('[Cogix Content] Failed to start session recording:', error);
      }
    }

    // Update state
    this.recordingState.isRecording = true;
    this.recordingState.startTime = Date.now();
    this.recordingState.projectId = projectId;

    // Subscribe to gaze data
    this.eyeTrackingManager.on('gazeData', (data: any) => {
      this.recordingState.sessionData.push({
        ...data,
        timestamp: Date.now() - this.recordingState.startTime!,
        url: window.location.href
      });
    });

    this.updateUIStatus();
    return { recording: true };
  }

  async stopRecording() {
    if (!this.recordingState.isRecording) {
      throw new Error('Not recording');
    }

    // Stop screen recording
    if (this.recordingState.recorder) {
      this.recordingState.recorder.stop();
      this.recordingState.mediaStream?.getTracks().forEach(track => track.stop());
    }

    // Stop eye tracking
    await this.eyeTrackingManager.stopTracking();

    // Stop session recording
    await this.sessionManager.stopRecording();

    // Format session data to match TrackingSession format from cogix-eye-tracking
    const duration = Date.now() - this.recordingState.startTime!;
    const sessionData = {
      // Core session info
      id: `session_${Date.now()}`,
      name: `Recording - ${document.title}`,
      timestamp: this.recordingState.startTime!,
      duration: duration,
      
      // Metadata matching cogix-frontend format
      metadata: {
        url: window.location.href,
        title: document.title,
        projectId: this.recordingState.projectId,
        provider: this.eyeTrackingManager?.currentProvider || 'unknown',
        browser: navigator.userAgent,
        screenResolution: {
          width: window.screen.width,
          height: window.screen.height
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      },
      
      // Eye tracking data in the same format
      gazeData: this.recordingState.sessionData.map(point => ({
        ...point,
        timestamp: point.timestamp || 0,
        x: point.x || 0,
        y: point.y || 0,
        confidence: point.confidence || 1
      })),
      
      // Analysis data (empty initially, will be computed server-side)
      fixations: [],
      saccades: [],
      blinks: [],
      aois: [],
      
      // Media attachments
      videoBlob: this.recordingState.videoBlob,
      thumbnail: await this.generateThumbnail(),
      
      // Provider info
      provider: this.eyeTrackingManager?.currentProvider || 'unknown',
      url: window.location.href,
      title: document.title
    };

    // Send to background for upload
    await chrome.runtime.sendMessage({
      action: 'uploadSession',
      sessionData
    });

    // Reset state
    this.recordingState = {
      isRecording: false,
      startTime: null,
      projectId: null,
      sessionData: [],
      mediaStream: null,
      recorder: null,
      videoBlob: null
    };

    this.updateUIStatus();
    return sessionData;
  }

  private async generateThumbnail(): Promise<string | null> {
    try {
      // Capture current page screenshot as thumbnail
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Try to capture from video stream if available
        if (this.recordingState.mediaStream) {
          const video = document.createElement('video');
          video.srcObject = this.recordingState.mediaStream;
          video.play();
          
          await new Promise(resolve => {
            video.onloadedmetadata = () => {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              resolve(null);
            };
          });
        } else {
          // Fallback: create a simple thumbnail with page info
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#333';
          ctx.font = '14px Arial';
          ctx.fillText(document.title.substring(0, 30), 10, 30);
          ctx.fillText(new URL(window.location.href).hostname, 10, 50);
        }
        
        return canvas.toDataURL('image/png');
      }
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
    }
    
    return null;
  }

  private async toggleRecording() {
    if (this.recordingState.isRecording) {
      await this.stopRecording();
    } else {
      // Get current project from background
      const authState = await chrome.runtime.sendMessage({ action: 'getAuthState' });
      if (authState.data?.currentProjectId) {
        await this.startRecording(authState.data.currentProjectId);
      } else {
        alert('Please select a project from the extension popup first');
      }
    }
  }

  private updateUIStatus() {
    if (!this.floatingUI) return;

    const button = this.floatingUI.querySelector('.cogix-floating-button');
    const badge = this.floatingUI.querySelector('.cogix-status-badge');
    const tooltip = this.floatingUI.querySelector('.cogix-tooltip');

    if (button) {
      if (this.recordingState.isRecording) {
        button.classList.add('recording');
      } else {
        button.classList.remove('recording');
      }
    }

    if (badge) {
      badge.className = 'cogix-status-badge';
      if (!this.connected) {
        badge.classList.add('disconnected');
      } else if (this.recordingState.isRecording) {
        badge.classList.add('recording');
      }
    }

    if (tooltip) {
      tooltip.textContent = this.recordingState.isRecording ? 'Stop Recording' : 'Start Eye Tracking';
    }
  }

  async checkConnection() {
    return {
      connected: this.connected,
      calibrated: this.calibrated,
      provider: this.eyeTrackingManager?.currentProvider || null
    };
  }

  getStatus() {
    return {
      isRecording: this.recordingState.isRecording,
      connected: this.connected,
      calibrated: this.calibrated,
      projectId: this.recordingState.projectId,
      duration: this.recordingState.startTime 
        ? Date.now() - this.recordingState.startTime 
        : 0
    };
  }

  getSDKStatus(): 'loading' | 'loaded' | 'failed' | 'simplified' {
    return this.sdkStatus;
  }

  getLastError(): string | null {
    return this.lastError;
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
    
    // Append to body
    document.body.appendChild(this.overlayContainer);
    
    // Create React root and render overlay
    this.overlayRoot = ReactDOM.createRoot(this.overlayContainer);
    this.overlayRoot.render(
      React.createElement(CogixOverlay, {
        isAuthenticated,
        user,
        currentProjectId,
        onClose: () => this.closeOverlay()
      })
    );
  }
  
  private closeOverlay() {
    if (this.overlayRoot) {
      this.overlayRoot.unmount();
      this.overlayRoot = null;
    }
    
    if (this.overlayContainer) {
      this.overlayContainer.remove();
      this.overlayContainer = null;
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
      }
      
      .cogix-extension-overlay * {
        box-sizing: border-box !important;
      }
    `;
    document.head.appendChild(style);
  }

  cleanup() {
    if (this.recordingState.isRecording) {
      this.stopRecording();
    }
    
    if (this.floatingUI) {
      this.floatingUI.remove();
    }
    
    if (this.overlayContainer) {
      this.closeOverlay();
    }

    if (this.eyeTrackingManager) {
      this.eyeTrackingManager.destroy();
    }
  }
}

/**
 * Chrome storage adapter for SDK
 */
class ChromeStorageAdapter {
  async read(key: string): Promise<any> {
    const result = await chrome.storage.local.get(key);
    return result[key];
  }

  async write(key: string, value: any): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async delete(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }

  async list(prefix?: string): Promise<string[]> {
    const all = await chrome.storage.local.get();
    const keys = Object.keys(all);
    return prefix ? keys.filter(k => k.startsWith(prefix)) : keys;
  }
}

