/**
 * Browser Plugin Data-IO Client
 * 
 * Reuses the same patterns and logic as cogixAPIClient.dataIO from the frontend
 * for consistent behavior across the platform.
 */

import type { 
  GazePoint, 
  RecordingMetadata, 
  SessionSubmissionMetadata, 
  EyeTrackingSessionData
} from '../types/eye-tracking-session';
import { EYE_TRACKING_CONSTANTS } from '../types/eye-tracking-session';
import { retryWithBackoff, storeFailedSession, DEFAULT_RETRY_OPTIONS } from './errorHandling';

// Configuration - Browser plugin always uses production URLs (no localhost)
// IMPORTANT: Never use localhost - browser plugins should only connect to production APIs
const DATA_IO_URL = 'https://data-io.cogix.app';
const API_BASE_URL = 'https://api.cogix.app';

// Validate that we're not accidentally using localhost
if (DATA_IO_URL.includes('localhost') || API_BASE_URL.includes('localhost')) {
  console.error('❌ CONFIGURATION ERROR: Browser plugin should never use localhost URLs!');
  throw new Error('Invalid configuration: localhost URLs not allowed in browser plugin');
}

// Debug configuration
console.log('🔧 DataIO Client Configuration (Production Only):', {
  DATA_IO_URL,
  API_BASE_URL,
  note: 'Browser plugin uses production URLs only (no localhost)'
});

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface SessionUploadOptions {
  videoFile?: File;
  gazeDataFile?: File;
  gazeData?: Array<GazePoint>;
  participantId?: string;
  metadata?: Partial<RecordingMetadata>;
  onProgress?: (stage: string, progress: number, details?: any) => void;
}

/**
 * Browser Plugin Data-IO Client
 * 
 * Mirrors the functionality of cogixAPIClient.dataIO but adapted for browser extension environment
 */
export class BrowserDataIOClient {
  
  /**
   * Test CORS preflight request
   */
  private async testCORSPreflight(url: string): Promise<boolean> {
    try {
      console.log('🔍 Testing CORS preflight for:', url);
      const response = await fetch(url, {
        method: 'OPTIONS',
        headers: {
          'Origin': `chrome-extension://${chrome.runtime.id}`,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization,content-type'
        }
      });
      
      console.log('🔍 CORS preflight response:', {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      return response.ok;
    } catch (error) {
      console.error('🚨 CORS preflight failed:', error);
      return false;
    }
  }

  /**
   * Get JWT token for data-io access (same as cogixAPIClient.dataIO._getToken)
   * Enhanced with retry logic for network failures
   */
  private async _getToken(projectId: string, sessionId?: string): Promise<any> {
    return retryWithBackoff(async () => {
      const authData = await chrome.storage.sync.get(['clerkToken']);
      const token = authData.clerkToken;
      
      if (!token) {
        throw new Error('Not authenticated. Please sign in to the extension.');
      }

      const tokenUrl = `${API_BASE_URL}/api/v1/data-io/generate`;
      console.log('🔑 Fetching JWT token from:', tokenUrl);
      console.log('🔑 Using API_BASE_URL:', API_BASE_URL);
      console.log('🔑 Clerk token length:', token?.length || 0);
      console.log('🔑 Request body:', { project_id: projectId, session_id: sessionId });

      // Test CORS preflight first
      const corsOk = await this.testCORSPreflight(tokenUrl);
      if (!corsOk) {
        console.warn('⚠️ CORS preflight failed, but continuing with request...');
      }

      const requestBody = {
        project_id: projectId,
        session_id: sessionId,
        expires_in_hours: 8,
        permissions: ['read', 'write']
      };

      console.log('🔑 Making fetch request to:', tokenUrl);
      console.log('🔑 Request headers:', {
        'Authorization': `Bearer ${token?.substring(0, 20)}...`,
        'Content-Type': 'application/json'
      });
      console.log('🔑 Request body:', requestBody);

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Origin': `chrome-extension://${chrome.runtime.id}`, // Explicitly set origin
        },
        body: JSON.stringify(requestBody)
      }).catch(fetchError => {
        console.error('🚨 Fetch request failed:', fetchError);
        console.error('🚨 Error type:', fetchError.constructor.name);
        console.error('🚨 Error message:', fetchError.message);
        console.error('🚨 Extension ID:', chrome.runtime.id);
        console.error('🚨 Extension Origin:', `chrome-extension://${chrome.runtime.id}`);
        throw fetchError;
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🚨 Token request failed:', {
          status: response.status,
          statusText: response.statusText,
          url: tokenUrl,
          errorText: errorText,
          extensionId: chrome.runtime.id,
          extensionOrigin: `chrome-extension://${chrome.runtime.id}`
        });
        
        const error = new Error(`Failed to get data-io token: ${response.status} ${errorText || response.statusText}`);
        
        // Don't retry auth errors (401, 403)
        if (response.status === 401 || response.status === 403) {
          (error as any).noRetry = true;
        }
        
        throw error;
      }

      const tokenData = await response.json();
      console.log('✅ JWT token received successfully');
      return tokenData;
    }, {
      ...DEFAULT_RETRY_OPTIONS,
      retryCondition: (error: Error) => {
        // Don't retry auth errors
        if ((error as any).noRetry) return false;
        return DEFAULT_RETRY_OPTIONS.retryCondition!(error);
      }
    });
  }

  /**
   * Upload file to data-io with progress tracking (same as cogixAPIClient.dataIO.uploadFile)
   */
  async uploadFile(
    projectId: string, 
    sessionId: string, 
    file: File,
    participantId?: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<any> {
    const tokenData = await this._getToken(projectId, sessionId);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', projectId);
    formData.append('session_id', sessionId);
    if (participantId) {
      formData.append('participant_id', participantId);
    }
    
    // Use XMLHttpRequest for progress tracking (same as cogixAPIClient)
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage
          });
        }
      });
      
      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            resolve(result);
          } catch (error) {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          reject(new Error(`File upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      });
      
      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during file upload'));
      });
      
      xhr.addEventListener('abort', () => {
        reject(new Error('File upload was aborted'));
      });
      
      // Start upload - simplified URL (same as cogixAPIClient)
      xhr.open('POST', `${DATA_IO_URL}/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${tokenData.access_token}`);
      xhr.send(formData);
    });
  }

  /**
   * Submit session data (same as cogixAPIClient.dataIO.submitSession)
   */
  async submitSession(
    projectId: string, 
    sessionId: string, 
    data: {
      data: any;
      metadata?: any;
    }, 
    participantId?: string
  ): Promise<any> {
    const tokenData = await this._getToken(projectId, sessionId);
    
    const requestBody = {
      project_id: projectId,
      session_id: sessionId,
      participant_id: participantId,
      data: data.data,
      metadata: data.metadata
    };

    const response = await fetch(`${DATA_IO_URL}/submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Session submission failed: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  /**
   * Submit complete eye tracking session (same as cogixAPIClient.dataIO.submitEyeTrackingSession)
   * Enhanced with comprehensive error handling and automatic retry on failure
   */
  async submitEyeTrackingSession(
    projectId: string, 
    sessionId: string, 
    options: SessionUploadOptions
  ): Promise<any> {
    try {
      let videoFileKey = '';
      let gazeDataFileKey = '';
      let gazeData = options.gazeData || [];

      // Upload video file if provided - store file key, not URL
      if (options.videoFile) {
        if (options.onProgress) options.onProgress('Uploading video file...', 20);
        
        const videoResult = await retryWithBackoff(async () => {
          return this.uploadFile(
            projectId, 
            sessionId, 
            options.videoFile!,
            options.participantId,
            (progress) => {
              if (options.onProgress) {
                options.onProgress(`Uploading video: ${progress.percentage}%`, 20 + (progress.percentage * 0.3), {
                  videoProgress: progress.percentage
                });
              }
            }
          );
        }, {
          maxAttempts: 3,
          initialDelay: 2000,
          retryCondition: (error) => {
            // Retry on network issues but not on file size or auth errors
            const message = error.message.toLowerCase();
            return (
              message.includes('network') ||
              message.includes('timeout') ||
              message.includes('fetch')
            ) && !message.includes('too large') && !message.includes('unauthorized');
          }
        });
        
        videoFileKey = videoResult.file_key; // Store file key, not URL
        
        if (options.onProgress) options.onProgress('Video upload completed', 50);
      }

      // Upload or parse gaze data - store file key, not URL
      if (options.gazeDataFile) {
        if (options.onProgress) options.onProgress('Uploading gaze data file...', 60);
        
        const gazeResult = await retryWithBackoff(async () => {
          return this.uploadFile(
            projectId, 
            sessionId, 
            options.gazeDataFile!,
            options.participantId,
            (progress) => {
              if (options.onProgress) {
                options.onProgress(`Uploading gaze data: ${progress.percentage}%`, 60 + (progress.percentage * 0.2), {
                  gazeProgress: progress.percentage
                });
              }
            }
          );
        });
        
        gazeDataFileKey = gazeResult.file_key; // Store file key, not URL
        
        if (options.onProgress) options.onProgress('Gaze data upload completed', 80);
        
        // Also parse the data for quick access
        const gazeText = await options.gazeDataFile.text();
        try {
          gazeData = JSON.parse(gazeText);
        } catch (e) {
          // Try parsing as CSV
          const lines = gazeText.split('\n').slice(1); // Skip header
          gazeData = lines
            .filter(line => line.trim())
            .map((line, index) => {
              const [timestamp, x, y, confidence] = line.split(',');
              return {
                timestamp: parseFloat(timestamp) || index * 16.67,
                x: parseFloat(x) || 0,
                y: parseFloat(y) || 0,
                confidence: parseFloat(confidence) || 0.8
              };
            });
        }
      }

      // Prepare complete session data (same structure as cogixAPIClient)
      const sessionData = {
        data: {
          session_id: sessionId,
          video_file_key: videoFileKey,
          video_file_uploaded: !!videoFileKey,
          gaze_data_file_key: gazeDataFileKey,
          gaze_data_file_uploaded: !!gazeDataFileKey,
          gaze_data: gazeData,
          metadata: {
            duration: options.metadata?.duration || 60,
            screen_width: options.metadata?.screen_width || screen.width,
            screen_height: options.metadata?.screen_height || screen.height,
            device: options.metadata?.device || 'browser-extension',
            source: 'browser-extension',
            gaze_points_count: gazeData.length,
            has_video: !!videoFileKey,
            has_gaze_file: !!gazeDataFileKey,
            storage_type: 'edge_r2' as const,
            
            // Browser-specific metadata
            url: window.location.href,
            title: document.title,
            user_agent: navigator.userAgent,
            
            // Recording settings
            recording_settings: {
              fps: EYE_TRACKING_CONSTANTS.DEFAULT_VIDEO_FPS,
              resolution: '1280x720',
              codec: 'video/webm'
            },
            
            // Eye tracking settings
            eye_tracking_settings: {
              sampling_rate: EYE_TRACKING_CONSTANTS.DEFAULT_SAMPLING_RATE,
              tracker_model: 'hardware'
            },
            
            ...options.metadata
          }
        },
        metadata: {
          source: 'browser-extension' as const,
          type: 'eye_tracking_session' as const,
          storage_method: 'edge_worker' as const,
          submitted_at: new Date().toISOString(),
          extension_version: chrome.runtime.getManifest().version
        }
      };

      if (options.onProgress) options.onProgress('Submitting session data...', 90);
      
      const result = await retryWithBackoff(async () => {
        return this.submitSession(projectId, sessionId, sessionData, options.participantId);
      });
      
      if (options.onProgress) options.onProgress('Session submitted successfully', 100);
      
      return result;
      
    } catch (error) {
      console.error('Eye tracking session upload failed:', error);
      
      // Store failed session for retry if we have the necessary files
      if (options.videoFile && options.gazeData) {
        try {
          await storeFailedSession(
            sessionId,
            projectId,
            options.videoFile,
            options.gazeData,
            options.metadata || {},
            error instanceof Error ? error : new Error(String(error))
          );
        } catch (storeError) {
          console.error('Failed to store session for retry:', storeError);
        }
      }
      
      // Re-throw the error for the caller to handle
      throw error;
    }
  }

  /**
   * Check data-io service health
   */
  async checkHealth(): Promise<any> {
    const response = await fetch(`${DATA_IO_URL}/health`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Health check failed: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  /**
   * Diagnostic method to check authentication and configuration
   */
  async diagnoseConfiguration(): Promise<{
    configuration: any;
    authentication: any;
    backendConnectivity: any;
  }> {
    // Check configuration
    const configuration = {
      API_BASE_URL,
      DATA_IO_URL,
      env_API_BASE_URL: process.env.PLASMO_PUBLIC_API_URL,
      env_DATA_IO_URL: process.env.PLASMO_PUBLIC_DATA_IO_URL
    };

    // Check authentication
    const authData = await chrome.storage.sync.get(['clerkToken', 'clerkUser']);
    const authentication = {
      hasClerkToken: !!authData.clerkToken,
      clerkTokenLength: authData.clerkToken?.length || 0,
      hasClerkUser: !!authData.clerkUser,
      clerkUserId: authData.clerkUser?.id
    };

    // Test backend connectivity with extension origin
    let backendConnectivity;
    try {
      console.log('🔍 Testing backend health endpoint...');
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Origin': `chrome-extension://${chrome.runtime.id}`
        },
        signal: AbortSignal.timeout(5000)
      });
      
      console.log('🔍 Backend health response:', {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      backendConnectivity = {
        accessible: response.ok,
        status: response.status,
        statusText: response.statusText,
        url: `${API_BASE_URL}/health`,
        extensionId: chrome.runtime.id,
        extensionOrigin: `chrome-extension://${chrome.runtime.id}`
      };
    } catch (error) {
      console.error('🚨 Backend health check failed:', error);
      backendConnectivity = {
        accessible: false,
        error: error instanceof Error ? error.message : String(error),
        url: `${API_BASE_URL}/health`,
        extensionId: chrome.runtime.id,
        extensionOrigin: `chrome-extension://${chrome.runtime.id}`
      };
    }

    return {
      configuration,
      authentication,
      backendConnectivity
    };
  }

  /**
   * Test backend connectivity with different URLs
   */
  async testBackendConnectivity(): Promise<{
    results: Array<{
      url: string;
      accessible: boolean;
      responseTime: number;
      error?: string;
    }>;
  }> {
    const urlsToTest = [
      'https://api.cogix.app',
      'https://cogix-backend.herokuapp.com', // Alternative production URL
      API_BASE_URL // Always production URL now
    ];

    const results = [];
    
    for (const url of urlsToTest) {
      const startTime = Date.now();
      try {
        const response = await fetch(`${url}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        const responseTime = Date.now() - startTime;
        results.push({
          url,
          accessible: response.ok,
          responseTime,
          error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
        });
      } catch (error) {
        const responseTime = Date.now() - startTime;
        results.push({
          url,
          accessible: false,
          responseTime,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return { results };
  }

  /**
   * Test complete connection and authentication flow
   * This creates a test project session to verify all components are working
   */
  async testConnectionAndAuth(projectId: string = 'test-project'): Promise<{
    success: boolean;
    results: Array<{
      step: string;
      success: boolean;
      duration: number;
      details?: any;
      error?: string;
    }>;
    summary: {
      totalSteps: number;
      successfulSteps: number;
      totalTime: number;
    };
  }> {
    const results: Array<{
      step: string;
      success: boolean;
      duration: number;
      details?: any;
      error?: string;
    }> = [];
    
    const startTime = Date.now();
    let allSuccessful = true;

    // Step 1: Check service health
    let stepStart = Date.now();
    try {
      const healthResult = await this.checkHealth();
      const duration = Date.now() - stepStart;
      
      results.push({
        step: 'Service Health Check',
        success: true,
        duration,
        details: healthResult
      });
    } catch (error) {
      const duration = Date.now() - stepStart;
      results.push({
        step: 'Service Health Check',
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      allSuccessful = false;
    }

    // Step 2: Test JWT token generation
    stepStart = Date.now();
    try {
      const tokenData = await this._getToken(projectId, 'test-session');
      const duration = Date.now() - stepStart;
      
      results.push({
        step: 'JWT Token Generation',
        success: true,
        duration,
        details: {
          hasAccessToken: !!tokenData.access_token,
          hasUserInfo: !!tokenData.user_info,
          userId: tokenData.user_info?.user_id,
          expiresIn: tokenData.expires_in
        }
      });
    } catch (error) {
      const duration = Date.now() - stepStart;
      results.push({
        step: 'JWT Token Generation',
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      allSuccessful = false;
    }

    // Step 3: Test file upload capability (small test file)
    if (allSuccessful) {
      stepStart = Date.now();
      try {
        const testData = JSON.stringify({
          test: true,
          timestamp: Date.now(),
          message: 'Test file upload from browser plugin'
        });
        const testFile = new File([testData], 'test-connection.json', { 
          type: 'application/json' 
        });
        
        const uploadResult = await this.uploadFile(
          projectId,
          'test-connection-session',
          testFile,
          'test-participant'
        );
        const duration = Date.now() - stepStart;
        
        results.push({
          step: 'File Upload Test',
          success: true,
          duration,
          details: {
            fileKey: uploadResult.file_key,
            fileSize: testFile.size,
            fileName: testFile.name
          }
        });
      } catch (error) {
        const duration = Date.now() - stepStart;
        results.push({
          step: 'File Upload Test',
          success: false,
          duration,
          error: error instanceof Error ? error.message : String(error)
        });
        allSuccessful = false;
      }
    } else {
      results.push({
        step: 'File Upload Test',
        success: false,
        duration: 0,
        error: 'Skipped due to previous failures'
      });
    }

    // Step 4: Test session submission
    if (allSuccessful) {
      stepStart = Date.now();
      try {
        const testSessionData = {
          data: {
            session_id: 'test-connection-session',
            test_data: {
              message: 'Connection test from browser plugin',
              timestamp: Date.now(),
              browser: navigator.userAgent,
              url: window.location.href
            },
            metadata: {
              duration: 1,
              screen_width: screen.width,
              screen_height: screen.height,
              device: 'browser-extension-test',
              source: 'connection-test',
              gaze_points_count: 0,
              has_video: false,
              has_gaze_file: false,
              storage_type: 'edge_r2' as const
            }
          },
          metadata: {
            source: 'browser-extension' as const,
            type: 'connection_test' as any,
            storage_method: 'edge_worker' as const,
            submitted_at: new Date().toISOString(),
            extension_version: chrome.runtime.getManifest().version
          }
        };
        
        const sessionResult = await this.submitSession(
          projectId,
          'test-connection-session',
          testSessionData,
          'test-participant'
        );
        const duration = Date.now() - stepStart;
        
        results.push({
          step: 'Session Submission Test',
          success: true,
          duration,
          details: sessionResult
        });
      } catch (error) {
        const duration = Date.now() - stepStart;
        results.push({
          step: 'Session Submission Test',
          success: false,
          duration,
          error: error instanceof Error ? error.message : String(error)
        });
        allSuccessful = false;
      }
    } else {
      results.push({
        step: 'Session Submission Test',
        success: false,
        duration: 0,
        error: 'Skipped due to previous failures'
      });
    }

    // Step 5: Test session retrieval
    if (allSuccessful) {
      stepStart = Date.now();
      try {
        const retrievalResult = await this.getSession(
          projectId,
          'test-connection-session',
          'test-participant'
        );
        const duration = Date.now() - stepStart;
        
        results.push({
          step: 'Session Retrieval Test',
          success: true,
          duration,
          details: {
            hasData: !!retrievalResult.data,
            sessionId: retrievalResult.session_id
          }
        });
      } catch (error) {
        const duration = Date.now() - stepStart;
        results.push({
          step: 'Session Retrieval Test',
          success: false,
          duration,
          error: error instanceof Error ? error.message : String(error)
        });
        allSuccessful = false;
      }
    } else {
      results.push({
        step: 'Session Retrieval Test',
        success: false,
        duration: 0,
        error: 'Skipped due to previous failures'
      });
    }

    const totalTime = Date.now() - startTime;
    const successfulSteps = results.filter(r => r.success).length;

    return {
      success: allSuccessful,
      results,
      summary: {
        totalSteps: results.length,
        successfulSteps,
        totalTime
      }
    };
  }

  /**
   * List sessions for a project
   */
  async listSessions(projectId: string, options?: {
    limit?: number;
    offset?: number;
    participantId?: string;
    forceFresh?: boolean;
  }): Promise<any> {
    const tokenData = await this._getToken(projectId);
    
    const params = new URLSearchParams();
    params.append('project_id', projectId);
    if (options?.participantId) params.append('participant_id', options.participantId);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    
    // Add cache-busting parameter when fresh data needed
    if (options?.forceFresh) {
      params.append('_t', Date.now().toString());
    }
    
    const url = `${DATA_IO_URL}/list?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        ...(options?.forceFresh && {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        })
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { results: [], total: 0 }; // No sessions found
      }
      const errorText = await response.text();
      throw new Error(`Session listing failed: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get a specific session
   */
  async getSession(projectId: string, sessionId: string, participantId?: string): Promise<any> {
    const tokenData = await this._getToken(projectId, sessionId);
    
    const params = new URLSearchParams();
    params.append('project_id', projectId);
    params.append('session_id', sessionId);
    if (participantId) params.append('participant_id', participantId);
    
    const response = await fetch(`${DATA_IO_URL}/retrieve?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Session retrieval failed: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  /**
   * Delete a session
   */
  async deleteSession(projectId: string, sessionId: string, participantId?: string): Promise<any> {
    const tokenData = await this._getToken(projectId, sessionId);
    
    const requestBody = {
      project_id: projectId,
      session_id: sessionId,
      participant_id: participantId
    };

    const response = await fetch(`${DATA_IO_URL}/delete`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Session deletion failed: ${response.status} ${errorText}`);
    }

    return response.json();
  }
}

// Export singleton instance
export const dataIOClient = new BrowserDataIOClient();
export default dataIOClient;
