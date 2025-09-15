/**
 * Background Script Data-IO Client
 * 
 * Handles all data-io operations from the background script to avoid CORS issues.
 * Content scripts send messages to background script which makes the actual API calls.
 */

import type { 
  GazePoint, 
  RecordingMetadata, 
  SessionSubmissionMetadata, 
  EyeTrackingSessionData
} from '../types/eye-tracking-session';
import { EYE_TRACKING_CONSTANTS } from '../types/eye-tracking-session';

// Configuration - Browser plugin always uses production URLs
// IMPORTANT: Never use localhost - browser plugins should only connect to production APIs
const DATA_IO_URL = 'https://data-io.cogix.app';
const API_BASE_URL = 'https://api.cogix.app';

// Validate that we're not accidentally using localhost
if (DATA_IO_URL.includes('localhost') || API_BASE_URL.includes('localhost')) {
  console.error('❌ CONFIGURATION ERROR: Browser plugin should never use localhost URLs!');
  throw new Error('Invalid configuration: localhost URLs not allowed in browser plugin');
}

console.log('🔧 Background DataIO Client Configuration (Production Only):', {
  DATA_IO_URL,
  API_BASE_URL,
  extensionId: chrome.runtime.id,
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
}

/**
 * Background Script Data-IO Client
 * 
 * All methods run in the background script context, avoiding CORS issues
 */
export class BackgroundDataIOClient {
  
  /**
   * Get JWT token for data-io access
   */
  async _getToken(projectId: string, sessionId?: string): Promise<any> {
    const authData = await chrome.storage.sync.get(['clerkToken']);
    const token = authData.clerkToken;
    
    if (!token) {
      throw new Error('Not authenticated. Please sign in to the extension.');
    }

    const tokenUrl = `${API_BASE_URL}/api/v1/data-io/generate`;
    console.log('🔑 [BACKGROUND] Fetching JWT token from:', tokenUrl);
    console.log('🔑 [BACKGROUND] Extension origin:', `chrome-extension://${chrome.runtime.id}`);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        project_id: projectId,
        session_id: sessionId,
        expires_in_hours: 8,
        permissions: ['read', 'write']
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 [BACKGROUND] Token request failed:', {
        status: response.status,
        statusText: response.statusText,
        url: tokenUrl,
        errorText: errorText,
        projectId: projectId,
        sessionId: sessionId
      });
      
      // Try to parse error details
      let errorDetails = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = errorJson.detail || errorJson.message || errorText;
        console.error('🚨 [BACKGROUND] Parsed error details:', errorJson);
      } catch (e) {
        console.warn('🚨 [BACKGROUND] Could not parse error as JSON');
      }
      
      throw new Error(`Failed to get data-io token: ${response.status} ${errorDetails}`);
    }

    const tokenData = await response.json();
    console.log('✅ [BACKGROUND] JWT token received successfully');
    return tokenData;
  }

  /**
   * Upload file to data-io with progress tracking
   */
  async uploadFile(
    projectId: string, 
    sessionId: string, 
    file: File,
    participantId?: string,
    metadata?: { videoDuration?: number; [key: string]: any }
  ): Promise<any> {
    const tokenData = await this._getToken(projectId, sessionId);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', projectId);
    formData.append('session_id', sessionId);
    if (participantId) {
      formData.append('participant_id', participantId);
    }
    
    // Add video duration metadata if provided
    if (file.type.startsWith('video/')) {
      // Use 'duration' if provided, fallback to 'videoDuration'
      const duration = metadata?.duration || metadata?.videoDuration;
      if (duration) {
        formData.append('video_duration', duration.toString());
        console.log('📹 [BACKGROUND] Adding video duration to upload:', duration, 'seconds');
      }
    }
    
    // Add any other metadata fields that might be useful
    if (metadata?.duration) {
      formData.append('duration', metadata.duration.toString());
    }
    
    console.log('📁 [BACKGROUND] Uploading file to data-io:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    const response = await fetch(`${DATA_IO_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`File upload failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ [BACKGROUND] File uploaded successfully:', result.file_key);
    return result;
  }

  /**
   * Submit session data
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

    console.log('📤 [BACKGROUND] Submitting session to data-io:', {
      sessionId,
      projectId,
      participantId
    });

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

    const result = await response.json();
    console.log('✅ [BACKGROUND] Session submitted successfully');
    return result;
  }

  /**
   * Submit complete eye tracking session with progress callbacks
   */
  async submitEyeTrackingSession(
    projectId: string, 
    sessionId: string, 
    options: SessionUploadOptions & {
      onProgress?: (stage: string, progress: number, details?: any) => void;
    }
  ): Promise<any> {
    console.log('🎬 [BACKGROUND] Starting eye tracking session upload:', {
      sessionId,
      projectId,
      hasVideo: !!options.videoFile,
      hasGazeFile: !!options.gazeDataFile,
      gazeDataPoints: options.gazeData?.length || 0
    });

    let videoFileKey = '';
    let gazeDataFileKey = '';
    let gazeData = options.gazeData || [];

    // Upload video file if provided
    if (options.videoFile) {
      if (options.onProgress) options.onProgress('Uploading video file...', 20);
      console.log('📹 [BACKGROUND] Uploading video file...');
      
      // Extract video duration from metadata - try multiple fields for compatibility
      const videoDuration = options.metadata?.duration || 
                           options.metadata?.actualDuration || 
                           options.metadata?.video_duration ||
                           options.metadata?.calculatedDuration;
      
      if (videoDuration) {
        console.log('📏 [BACKGROUND] Video duration to be stored in R2 metadata:', videoDuration, 'seconds');
      } else {
        console.warn('⚠️ [BACKGROUND] No video duration found in metadata');
      }
      
      const videoResult = await this.uploadFile(
        projectId, 
        sessionId, 
        options.videoFile,
        options.participantId,
        {
          videoDuration: videoDuration,  // This will be sent as 'video_duration' in form data
          duration: videoDuration  // Also pass as 'duration' for consistency
        }
      );
      videoFileKey = videoResult.file_key;
      
      if (options.onProgress) options.onProgress('Video upload completed', 50);
    }

    // Upload gaze data file if provided
    if (options.gazeDataFile) {
      if (options.onProgress) options.onProgress('Uploading gaze data file...', 60);
      console.log('👁️ [BACKGROUND] Uploading gaze data file...');
      
      const gazeResult = await this.uploadFile(
        projectId, 
        sessionId, 
        options.gazeDataFile,
        options.participantId
      );
      gazeDataFileKey = gazeResult.file_key;
      
      if (options.onProgress) options.onProgress('Gaze data upload completed', 80);
      
      // Parse the data for quick access
      const gazeText = await options.gazeDataFile.text();
      try {
        gazeData = JSON.parse(gazeText);
      } catch (e) {
        console.warn('[BACKGROUND] Failed to parse gaze data as JSON, treating as raw data');
      }
    }

    // Prepare complete session data
    const sessionData = {
      data: {
        session_id: sessionId,
        video_file_key: videoFileKey,
        video_file_uploaded: !!videoFileKey,
        gaze_data_file_key: gazeDataFileKey,
        gaze_data_file_uploaded: !!gazeDataFileKey,
        gaze_data: gazeData,
        metadata: {
          // Duration information (multiple fields for compatibility)
          duration: options.metadata?.duration || options.metadata?.actualDuration || 60,
          session_duration: options.metadata?.duration || options.metadata?.actualDuration || 60,
          video_duration: options.metadata?.duration || options.metadata?.actualDuration,
          calculated_duration: options.metadata?.calculatedDuration,
          has_valid_duration: options.metadata?.hasValidDuration || false,
          
          // Screen and device info
          screen_width: options.metadata?.screen_width || 1920, // Default fallback for background script
          screen_height: options.metadata?.screen_height || 1080, // Default fallback for background script
          device: options.metadata?.device || 'browser-extension',
          source: 'browser-extension',
          
          // Data counts and availability
          gaze_points_count: gazeData.length,
          has_video: !!videoFileKey,
          has_gaze_file: !!gazeDataFileKey,
          storage_type: 'edge_r2' as const,
          
          // Browser-specific metadata
          url: options.metadata?.url || 'unknown',
          title: options.metadata?.title || 'unknown',
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
    console.log('📊 [BACKGROUND] Submitting complete session...');
    const result = await this.submitSession(projectId, sessionId, sessionData, options.participantId);
    
    if (options.onProgress) options.onProgress('Upload completed successfully', 100);
    console.log('✅ [BACKGROUND] Eye tracking session upload completed successfully');
    return result;
  }

  /**
   * Check data-io service health
   */
  async checkHealth(): Promise<any> {
    console.log('🏥 [BACKGROUND] Checking data-io health...');
    const response = await fetch(`${DATA_IO_URL}/health`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Health check failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ [BACKGROUND] Data-io health check passed');
    return result;
  }

  /**
   * Check backend API health (alternative endpoint to avoid database issues)
   */
  async checkBackendHealth(): Promise<any> {
    console.log('🏥 [BACKGROUND] Checking backend API health...');
    
    // Try the data-io info endpoint instead of health (doesn't use database pool info)
    const authData = await chrome.storage.sync.get(['clerkToken']);
    const token = authData.clerkToken;
    
    if (!token) {
      throw new Error('Not authenticated - cannot test backend health');
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/data-io/info`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend health check failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ [BACKGROUND] Backend API health check passed');
    return result;
  }

  /**
   * Test complete connection and authentication flow
   * Uses a real project if available, or creates a test scenario
   */
  async testConnectionAndAuth(projectId?: string, screenDimensions?: { width: number; height: number }): Promise<{
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

    // Determine project ID to use
    let testProjectId = projectId;
    if (!testProjectId) {
      // Try to get a real project from storage first
      try {
        const projectData = await chrome.storage.sync.get(['selectedProject']);
        if (projectData.selectedProject?.id) {
          testProjectId = projectData.selectedProject.id;
          console.log('🧪 [BACKGROUND] Using selected project:', testProjectId);
        } else {
          // Try to get user's first project
          const projects = await this.getUserProjects();
          if (projects.length > 0) {
            testProjectId = projects[0].id;
            console.log('🧪 [BACKGROUND] Using first available project:', testProjectId);
          } else {
            // No projects available - we'll add this as a test result
            console.warn('🧪 [BACKGROUND] No projects found - some tests will be skipped');
            testProjectId = null; // Will trigger specific handling
          }
        }
      } catch (error) {
        console.warn('🧪 [BACKGROUND] Failed to get project info:', error);
        testProjectId = null; // Will trigger specific handling
      }
    }

    console.log('🧪 [BACKGROUND] Starting connection and auth test for project:', testProjectId);

    // Step 0: Project validation
    results.push({
      step: 'Project Validation',
      success: !!testProjectId,
      duration: 0,
      details: testProjectId ? {
        projectId: testProjectId,
        source: projectId ? 'provided' : 'auto-detected'
      } : undefined,
      error: testProjectId ? undefined : 'No valid project available. Please create or select a project.'
    });

    // Step 1: Check data-io service health
    let stepStart = Date.now();
    try {
      const healthResult = await this.checkHealth();
      const duration = Date.now() - stepStart;
      
      results.push({
        step: 'Data-IO Service Health',
        success: true,
        duration,
        details: healthResult
      });
    } catch (error) {
      const duration = Date.now() - stepStart;
      results.push({
        step: 'Data-IO Service Health',
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't fail completely on health check - continue with other tests
      console.warn('🏥 [BACKGROUND] Data-IO health check failed, continuing with other tests...');
    }

    // Step 2: Check backend API health (alternative check)
    stepStart = Date.now();
    try {
      const backendHealthResult = await this.checkBackendHealth();
      const duration = Date.now() - stepStart;
      
      results.push({
        step: 'Backend API Health',
        success: true,
        duration,
        details: backendHealthResult
      });
    } catch (error) {
      const duration = Date.now() - stepStart;
      results.push({
        step: 'Backend API Health',
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      allSuccessful = false;
    }

    // Step 3: Test JWT token generation
    stepStart = Date.now();
    if (testProjectId) {
      try {
        const tokenData = await this._getToken(testProjectId, 'test-session');
        const duration = Date.now() - stepStart;
        
        results.push({
          step: 'JWT Token Generation',
          success: true,
          duration,
          details: {
            hasAccessToken: !!tokenData.access_token,
            hasUserInfo: !!tokenData.user_info,
            userId: tokenData.user_info?.user_id,
            expiresIn: tokenData.expires_in,
            projectId: testProjectId
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
    } else {
      results.push({
        step: 'JWT Token Generation',
        success: false,
        duration: 0,
        error: 'No valid project available for testing. Please create or select a project.'
      });
      allSuccessful = false;
    }

    // Step 4: Test file upload capability (small test file)
    if (allSuccessful && testProjectId) {
      stepStart = Date.now();
      try {
        const testData = JSON.stringify({
          test: true,
          timestamp: Date.now(),
          message: 'Test file upload from browser plugin background',
          projectId: testProjectId
        });
        const testFile = new File([testData], 'test-connection.json', { 
          type: 'application/json' 
        });
        
        const uploadResult = await this.uploadFile(
          testProjectId,
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

    // Step 5: Test session submission
    if (allSuccessful && testProjectId) {
      stepStart = Date.now();
      try {
        const testSessionData = {
          data: {
            session_id: 'test-connection-session',
            test_data: {
              message: 'Connection test from browser plugin background',
              timestamp: Date.now(),
              browser: navigator.userAgent,
              projectId: testProjectId
            },
            metadata: {
              duration: 1,
              screen_width: screenDimensions?.width || 1920, // Use actual screen dimensions from content script
              screen_height: screenDimensions?.height || 1080, // Use actual screen dimensions from content script
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
          testProjectId,
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

    const totalTime = Date.now() - startTime;
    const successfulSteps = results.filter(r => r.success).length;

    console.log('🧪 [BACKGROUND] Connection test completed:', {
      success: allSuccessful,
      successfulSteps,
      totalSteps: results.length,
      totalTime
    });

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
   * Check backend connectivity
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
      API_BASE_URL // Only test the production API URL
    ];

    const results = [];
    
    for (const url of urlsToTest) {
      const startTime = Date.now();
      try {
        console.log(`🔍 [BACKGROUND] Testing connectivity to: ${url}`);
        const response = await fetch(`${url}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        
        const responseTime = Date.now() - startTime;
        results.push({
          url,
          accessible: response.ok,
          responseTime,
          error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
        });
        
        console.log(`${response.ok ? '✅' : '❌'} [BACKGROUND] ${url}: ${response.status} (${responseTime}ms)`);
      } catch (error) {
        const responseTime = Date.now() - startTime;
        results.push({
          url,
          accessible: false,
          responseTime,
          error: error instanceof Error ? error.message : String(error)
        });
        
        console.log(`❌ [BACKGROUND] ${url}: ${error instanceof Error ? error.message : String(error)} (${responseTime}ms)`);
      }
    }

    return { results };
  }

  /**
   * Get user's projects to find a valid project ID for testing
   */
  async getUserProjects(): Promise<any[]> {
    const authData = await chrome.storage.sync.get(['clerkToken']);
    const token = authData.clerkToken;
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/projects/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 [BACKGROUND] Failed to get projects:', response.status, errorText);
      return [];
    }

    const projects = await response.json();
    console.log('📋 [BACKGROUND] User projects:', projects?.length || 0);
    return Array.isArray(projects) ? projects : [];
  }

  /**
   * Get configuration diagnostics
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
      env_DATA_IO_URL: process.env.PLASMO_PUBLIC_DATA_IO_URL,
      extensionId: chrome.runtime.id,
      extensionOrigin: `chrome-extension://${chrome.runtime.id}`
    };

    // Check authentication and project info
    const authData = await chrome.storage.sync.get(['clerkToken', 'clerkUser', 'selectedProject']);
    const authentication = {
      hasClerkToken: !!authData.clerkToken,
      clerkTokenLength: authData.clerkToken?.length || 0,
      hasClerkUser: !!authData.clerkUser,
      clerkUserId: authData.clerkUser?.id,
      selectedProject: authData.selectedProject ? {
        id: authData.selectedProject.id,
        name: authData.selectedProject.name
      } : null
    };

    // Test backend connectivity
    let backendConnectivity;
    try {
      console.log('🔍 [BACKGROUND] Testing backend health...');
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
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
}

// Export singleton instance
export const backgroundDataIOClient = new BackgroundDataIOClient();
export default backgroundDataIOClient;
