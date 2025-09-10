const WORKER_BASE_URL = process.env.PLASMO_PUBLIC_DATA_IO_URL || "https://cogix-data-io.workers.dev"

export interface DataSubmission {
  sessionId: string
  projectId: string
  timestamp: number
  data: {
    eyeTracking?: EyeTrackingData[]
    events?: EventData[]
    screenRecording?: ScreenRecordingChunk
  }
}

export interface EyeTrackingData {
  timestamp: number
  x: number
  y: number
  leftPupilDiameter?: number
  rightPupilDiameter?: number
  confidence?: number
}

export interface EventData {
  timestamp: number
  type: "click" | "keypress" | "scroll" | "mousemove"
  target?: string
  value?: any
  x?: number
  y?: number
  scrollX?: number
  scrollY?: number
  key?: string
  code?: string
}

export interface ScreenRecordingChunk {
  timestamp: number
  data: string // Base64 encoded
  mimeType: string
  duration?: number
  metadata?: {
    url: string
    title: string
    viewport: { width: number; height: number }
  }
}

export class CloudflareWorkerClient {
  private apiToken: string
  private retryQueue: DataSubmission[] = []
  private isRetrying = false

  constructor(apiToken: string) {
    this.apiToken = apiToken
  }

  async createSession(projectId: string, metadata: any): Promise<string> {
    const response = await this.request("/api/session/create", {
      method: "POST",
      body: JSON.stringify({
        projectId,
        metadata,
        timestamp: Date.now()
      })
    })

    const data = await response.json()
    return data.sessionId
  }

  async submitData(submission: DataSubmission): Promise<void> {
    try {
      await this.request("/api/submit", {
        method: "POST",
        body: JSON.stringify(submission)
      })
    } catch (error) {
      console.error("Failed to submit data, queuing for retry:", error)
      this.retryQueue.push(submission)
      this.scheduleRetry()
    }
  }

  async submitBatch(submissions: DataSubmission[]): Promise<void> {
    try {
      await this.request("/api/batch", {
        method: "POST",
        body: JSON.stringify({ submissions })
      })
    } catch (error) {
      console.error("Failed to submit batch, queuing for retry:", error)
      this.retryQueue.push(...submissions)
      this.scheduleRetry()
    }
  }

  async endSession(sessionId: string, projectId: string): Promise<void> {
    await this.request("/api/session/end", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        projectId,
        timestamp: Date.now()
      })
    })
  }

  private async request(path: string, options: RequestInit): Promise<Response> {
    const response = await fetch(`${WORKER_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiToken}`,
        ...options.headers
      }
    })

    if (!response.ok) {
      throw new Error(`Worker request failed: ${response.status} ${response.statusText}`)
    }

    return response
  }

  private scheduleRetry() {
    if (this.isRetrying) return

    this.isRetrying = true
    setTimeout(() => this.processRetryQueue(), 5000)
  }

  private async processRetryQueue() {
    if (this.retryQueue.length === 0) {
      this.isRetrying = false
      return
    }

    const batch = this.retryQueue.splice(0, 10) // Process up to 10 items
    
    try {
      await this.submitBatch(batch)
    } catch (error) {
      console.error("Retry failed, will try again:", error)
      this.retryQueue.unshift(...batch) // Put them back
    }

    // Continue retrying if there are more items
    if (this.retryQueue.length > 0) {
      setTimeout(() => this.processRetryQueue(), 10000)
    } else {
      this.isRetrying = false
    }
  }

  updateApiToken(newToken: string) {
    this.apiToken = newToken
  }
}