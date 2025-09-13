const API_BASE_URL = process.env.PLASMO_PUBLIC_API_URL || 'https://api.cogix.app'
const DATA_IO_URL = process.env.PLASMO_PUBLIC_DATA_IO_URL || 'https://data-io.cogix.app'

export interface Project {
  id: string
  name: string
  description?: string
  created_at: string
  updated_at: string
  is_published?: boolean
  published_url?: string
}

export interface ApiKey {
  id: string
  key: string
  name: string
  project_id: string
  permissions: string[]
  created_at: string
}

class CogixAPIClient {
  private async request<T>(
    endpoint: string,
    token: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!token) {
      throw new Error('Not authenticated')
    }

    // In Chrome extension, we need to make the request through a background script
    // to avoid CORS and Origin/Authorization header conflicts
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      // Send request through background script
      return new Promise((resolve, reject) => {
        const messageHandler = (response: any) => {
          // Check for Chrome runtime errors first
          if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message))
            return
          }
          
          // Check if we got a response at all
          if (!response) {
            console.error('No response received from background script');
            reject(new Error('No response received from background script'))
            return
          }
          
          // Handle error responses
          if (response.error) {
            console.error('API error:', response.error);
            reject(new Error(response.error))
            return
          }
          
          // Success - resolve with data
          console.log('API request successful, data received');
          resolve(response.data)
        }
        
        try {
          chrome.runtime.sendMessage(
            {
              type: 'API_REQUEST',
              endpoint,
              token,
              options
            },
            messageHandler
          )
        } catch (error) {
          console.error('Failed to send message to background script:', error);
          reject(new Error('Failed to communicate with background script'))
        }
      })
    }

    // Fallback for non-extension contexts
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(error.message || `Request failed: ${response.status}`)
    }

    return response.json()
  }

  // Project endpoints
  async getProjects(token: string): Promise<Project[]> {
    return this.request<Project[]>('/api/v1/projects/', token)
  }

  async getProject(id: string, token: string): Promise<Project> {
    return this.request<Project>(`/api/v1/projects/${id}`, token)
  }

  async getProjectApiKey(projectId: string, token: string): Promise<ApiKey> {
    return this.request<ApiKey>(`/api/v1/projects/${projectId}/default-api-key`, token)
  }

  // Get user's default API key
  async getDefaultApiKey(token: string): Promise<ApiKey> {
    return this.request<ApiKey>('/api/v1/api-keys/default', token)
  }

  // Data submission endpoints
  async getPresignedUploadUrl(projectId: string, sessionId: string, token: string): Promise<{ url: string; key: string }> {
    return this.request<{ url: string; key: string }>(
      `/api/v1/projects/${projectId}/upload-url`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, type: 'video' })
      }
    )
  }

  async submitSessionData(
    userId: string,
    projectId: string,
    participantId: string,
    sessionId: string,
    data: any,
    apiKey: string
  ): Promise<void> {
    // In browser context, don't set Authorization header to avoid Origin conflict
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    // Add API key as a query parameter instead of header to avoid Origin/Authorization conflict
    const url = `${DATA_IO_URL}/${userId}/${projectId}/${participantId}/${sessionId}?api_key=${encodeURIComponent(apiKey)}`
    
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(error.message || `Submission failed: ${response.status}`)
    }
  }
}

export const apiClient = new CogixAPIClient()