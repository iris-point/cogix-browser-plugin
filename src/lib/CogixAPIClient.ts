/**
 * Cogix API Client for Browser Extension
 * Uses the same API structure as the main Cogix website
 */

import { SessionManager } from './SessionManager';

export class CogixAPIClient {
  private baseURL: string;
  private sessionManager: SessionManager;

  constructor(baseURL: string, sessionManager: SessionManager) {
    this.baseURL = baseURL;
    this.sessionManager = sessionManager;
  }

  /**
   * Make authenticated API request
   */
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    // Get auth token from session manager
    const token = await this.sessionManager.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (response.status === 401) {
        // Token expired, try to refresh session
        const session = await this.sessionManager.checkSession();
        if (!session) {
          throw new Error('Session expired. Please login again.');
        }
        
        // Retry with new token
        const newToken = await this.sessionManager.getAuthToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          const retryResponse = await fetch(url, { ...options, headers });
          if (!retryResponse.ok) {
            throw new Error(`API Error: ${retryResponse.status}`);
          }
          return await retryResponse.json();
        }
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || `API Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  /**
   * Get user's projects
   */
  async getProjects() {
    return this.request('/api/v1/projects');
  }

  /**
   * Get project details
   */
  async getProject(projectId: string) {
    return this.request(`/api/v1/projects/${projectId}`);
  }

  /**
   * Get project files
   */
  async getProjectFiles(projectId: string, path?: string) {
    const params = path ? `?path=${encodeURIComponent(path)}` : '';
    return this.request(`/api/v1/projects/${projectId}/files${params}`);
  }

  /**
   * Upload eye tracking session - matches cogix-frontend implementation
   */
  async uploadSession(projectId: string, sessionData: any) {
    await this.sessionManager.getAuthToken();
    
    // First, get a signed URL for the session file (same as cogix-frontend)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionFilename = `eye-tracking-sessions/${timestamp}/session.json`;
    
    // Get signed URL for session data
    const signedUrlResponse = await this.request(
      `/api/v1/projects/${projectId}/files/signed-upload-url`,
      {
        method: 'POST',
        body: JSON.stringify({
          filename: sessionFilename,
          content_type: 'application/json',
          file_type: 'eye_tracking_session'
        })
      }
    );

    if (!signedUrlResponse.upload_url) {
      throw new Error('Failed to get upload URL');
    }

    // Upload session data to signed URL
    const uploadResponse = await fetch(signedUrlResponse.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(sessionData)
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload session data');
    }

    // If there's a video, upload it too
    let videoUrl = null;
    if (sessionData.videoBlob) {
      const videoFilename = `eye-tracking-sessions/${timestamp}/recording.webm`;
      
      const videoSignedUrlResponse = await this.request(
        `/api/v1/projects/${projectId}/files/signed-upload-url`,
        {
          method: 'POST',
          body: JSON.stringify({
            filename: videoFilename,
            content_type: 'video/webm',
            file_type: 'video'
          })
        }
      );

      if (videoSignedUrlResponse.upload_url) {
        await fetch(videoSignedUrlResponse.upload_url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'video/webm'
          },
          body: sessionData.videoBlob
        });
        
        videoUrl = videoSignedUrlResponse.public_url;
      }
    }

    // Create file record in database (same as cogix-frontend)
    const fileRecord = await this.request(
      `/api/v1/projects/${projectId}/files`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: `Eye Tracking Session - ${new Date().toLocaleString()}`,
          path: sessionFilename,
          file_type: 'eye_tracking_session',
          size: JSON.stringify(sessionData).length,
          mime_type: 'application/json',
          description: `Eye tracking session from ${sessionData.url || 'browser extension'}`,
          metadata: {
            url: sessionData.url,
            title: sessionData.title,
            duration: sessionData.duration,
            timestamp: sessionData.timestamp,
            gazeDataCount: sessionData.gazeData?.length || 0,
            provider: sessionData.provider,
            videoUrl: videoUrl,
            thumbnail: sessionData.thumbnail
          },
          public_url: signedUrlResponse.public_url,
          signed_url: signedUrlResponse.upload_url
        })
      }
    );

    return fileRecord;
  }

  /**
   * Alternative upload using multipart form (fallback method)
   */
  async uploadSessionMultipart(projectId: string, sessionData: any) {
    const token = await this.sessionManager.getAuthToken();
    
    // Prepare form data (same as CogixTrackerAdapter in frontend)
    const formData = new FormData();
    
    // Add session JSON
    const sessionBlob = new Blob([JSON.stringify(sessionData)], { type: 'application/json' });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionFilename = `eye-tracking-session-${timestamp}.json`;
    formData.append('file', sessionBlob, sessionFilename);
    
    // Add video if present
    if (sessionData.videoBlob) {
      formData.append('video', sessionData.videoBlob, `recording-${timestamp}.webm`);
    }
    
    // Add metadata
    formData.append('file_type', 'eye_tracking_session');
    formData.append('description', `Eye tracking session from ${sessionData.url || 'browser extension'}`);
    formData.append('metadata', JSON.stringify({
      url: sessionData.url,
      title: sessionData.title,
      duration: sessionData.duration,
      timestamp: sessionData.timestamp,
      gazeDataCount: sessionData.gazeData?.length || 0,
      provider: sessionData.provider
    }));

    const response = await fetch(
      `${this.baseURL}/api/v1/projects/${projectId}/files/upload`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(error.detail || 'Failed to upload session');
    }

    return await response.json();
  }

  /**
   * Create AOI group for a session
   */
  async createAOIGroup(projectId: string, sessionId: string, aoiData: any) {
    return this.request(`/api/v1/projects/${projectId}/aoi-groups`, {
      method: 'POST',
      body: JSON.stringify({
        name: `AOI Group - ${new Date().toLocaleDateString()}`,
        session_id: sessionId,
        aois: aoiData
      })
    });
  }

  /**
   * Get user profile
   */
  async getUserProfile() {
    return this.request('/api/v1/users/me');
  }

  /**
   * Update user settings
   */
  async updateUserSettings(settings: any) {
    return this.request('/api/v1/users/me/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }

  /**
   * Get experiment templates
   */
  async getTemplates() {
    return this.request('/api/v1/templates');
  }

  /**
   * Get participants for a project
   */
  async getParticipants(projectId: string) {
    return this.request(`/api/v1/projects/${projectId}/participants`);
  }

  /**
   * Create a new participant
   */
  async createParticipant(projectId: string, participant: any) {
    return this.request(`/api/v1/projects/${projectId}/participants`, {
      method: 'POST',
      body: JSON.stringify(participant)
    });
  }
}