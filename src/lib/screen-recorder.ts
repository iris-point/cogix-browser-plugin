/**
 * Screen Recording Service for Cogix Browser Plugin
 * Handles screen recording with eye tracking data synchronization
 */

export interface RecordingOptions {
  includeAudio?: boolean
  videoQuality?: 'low' | 'medium' | 'high'
  frameRate?: number
}

export interface RecordingSession {
  id: string
  projectId: string
  startTime: number
  endTime?: number
  gazeData: Array<{
    timestamp: number
    x: number
    y: number
    leftEye?: { x: number; y: number }
    rightEye?: { x: number; y: number }
  }>
  videoBlob?: Blob
  metadata: {
    url: string
    title: string
    userAgent: string
    screenResolution: { width: number; height: number }
  }
}

class ScreenRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private recordedChunks: Blob[] = []
  private currentSession: RecordingSession | null = null
  private isRecording = false

  async startRecording(projectId: string, options: RecordingOptions = {}): Promise<string> {
    if (this.isRecording) {
      throw new Error('Recording already in progress')
    }

    try {
      // Request screen capture
      const streamId = await this.requestScreenCapture()
      
      // Get screen stream
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: streamId,
            maxWidth: options.videoQuality === 'high' ? 1920 : 
                     options.videoQuality === 'medium' ? 1280 : 640,
            maxHeight: options.videoQuality === 'high' ? 1080 : 
                      options.videoQuality === 'medium' ? 720 : 480,
            maxFrameRate: options.frameRate || 30
          }
        } as any,
        audio: options.includeAudio ? {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: streamId
          }
        } as any : false
      })

      // Initialize session
      const sessionId = this.generateSessionId()
      this.currentSession = {
        id: sessionId,
        projectId,
        startTime: Date.now(),
        gazeData: [],
        metadata: {
          url: window.location.href,
          title: document.title,
          userAgent: navigator.userAgent,
          screenResolution: {
            width: screen.width,
            height: screen.height
          }
        }
      }

      // Set up MediaRecorder
      const mimeType = this.getSupportedMimeType()
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        videoBitsPerSecond: options.videoQuality === 'high' ? 2500000 : 
                           options.videoQuality === 'medium' ? 1500000 : 800000
      })

      this.recordedChunks = []
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = () => {
        this.finalizeRecording()
      }

      // Start recording
      this.mediaRecorder.start(1000) // Collect data every second
      this.isRecording = true

      console.log(`Screen recording started for project ${projectId}`)
      return sessionId

    } catch (error) {
      console.error('Failed to start screen recording:', error)
      throw error
    }
  }

  async stopRecording(): Promise<RecordingSession | null> {
    if (!this.isRecording || !this.mediaRecorder || !this.currentSession) {
      return null
    }

    return new Promise((resolve) => {
      const session = this.currentSession!
      
      this.mediaRecorder!.onstop = () => {
        session.endTime = Date.now()
        session.videoBlob = new Blob(this.recordedChunks, { 
          type: this.getSupportedMimeType() 
        })
        
        this.cleanup()
        resolve(session)
      }

      this.mediaRecorder!.stop()
      this.isRecording = false
    })
  }

  addGazeData(gazeData: { timestamp: number; x: number; y: number; leftEye?: any; rightEye?: any }) {
    if (this.currentSession && this.isRecording) {
      this.currentSession.gazeData.push({
        timestamp: gazeData.timestamp,
        x: gazeData.x,
        y: gazeData.y,
        leftEye: gazeData.leftEye,
        rightEye: gazeData.rightEye
      })
    }
  }

  getCurrentSession(): RecordingSession | null {
    return this.currentSession
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording
  }

  private async requestScreenCapture(): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.desktopCapture.chooseDesktopMedia(['screen', 'window', 'tab'], (streamId) => {
        if (streamId) {
          resolve(streamId)
        } else {
          reject(new Error('User cancelled screen capture or no permission'))
        }
      })
    })
  }

  private getSupportedMimeType(): string {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ]
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }
    
    return 'video/webm' // Fallback
  }

  private generateSessionId(): string {
    return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }
    
    this.mediaRecorder = null
    this.recordedChunks = []
    this.currentSession = null
    this.isRecording = false
  }

  private finalizeRecording() {
    if (this.currentSession) {
      this.currentSession.endTime = Date.now()
      this.currentSession.videoBlob = new Blob(this.recordedChunks, { 
        type: this.getSupportedMimeType() 
      })
    }
  }
}

// Export singleton instance
export const screenRecorder = new ScreenRecorder()
