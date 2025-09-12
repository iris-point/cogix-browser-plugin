/**
 * Eye Tracker Manager - Persistent connection in background script
 * This ensures the eye tracker connection persists regardless of popup state
 */

import { 
  createEyeTracker, 
  DeviceStatus, 
  type EyeTracker, 
  type GazeData, 
  type CalibrationResult
} from '@iris-point/eye-tracking-core'

export class EyeTrackerManager {
  private static instance: EyeTrackerManager | null = null
  private tracker: EyeTracker | null = null
  private wsUrl: string = 'wss://127.0.0.1:8443'
  private isConnected: boolean = false
  private deviceStatus: DeviceStatus = DeviceStatus.DISCONNECTED
  private latestCameraFrame: { imageData: string; timestamp: number } | null = null

  private constructor() {
    this.initializeTracker()
  }

  static getInstance(): EyeTrackerManager {
    if (!EyeTrackerManager.instance) {
      EyeTrackerManager.instance = new EyeTrackerManager()
    }
    return EyeTrackerManager.instance
  }

  private initializeTracker() {
    console.log('Initializing persistent eye tracker...')
    
    this.tracker = createEyeTracker({
      wsUrl: [this.wsUrl, 'ws://127.0.0.1:9000'],
      bufferSize: 1000,
      autoConnect: false,
      autoInitialize: false,
      debug: true
    })

    // Set up event listeners
    if (this.tracker && typeof this.tracker.on === 'function') {
      this.tracker.on('statusChanged', (status: DeviceStatus) => {
        console.log('Persistent eye tracker status:', status)
        this.deviceStatus = status
        this.isConnected = status === DeviceStatus.CONNECTED
        
        // Broadcast status to all tabs and popup
        this.broadcastStatus()
      })

      this.tracker.on('connected', () => {
        console.log('Persistent eye tracker connected - initializing...')
        
        // Auto-initialize sequence
        setTimeout(() => {
          this.tracker!.initDevice(false)
          setTimeout(() => {
            this.tracker!.initLight()
            setTimeout(() => {
              this.tracker!.initCamera()
            }, 500)
          }, 500)
        }, 100)
      })

      this.tracker.on('gazeData', (data: GazeData) => {
        // Broadcast gaze data to all tabs
        this.broadcastGazeData(data)
      })

      this.tracker.on('calibrationProgress', (progress: { current: number; total: number }) => {
        console.log('Calibration progress:', progress)
        this.broadcastCalibrationProgress(progress)
      })

      this.tracker.on('calibrationComplete', (result: CalibrationResult) => {
        console.log('Calibration complete:', result)
        this.broadcastCalibrationComplete(result)
      })

      this.tracker.on('cameraFrame', (frame: { imageData: string; timestamp: number }) => {
        // Cache the latest frame for popup requests
        this.latestCameraFrame = frame
        this.broadcastCameraFrame(frame)
      })
    }
  }

  async connect(): Promise<void> {
    if (!this.tracker) {
      throw new Error('Eye tracker not initialized')
    }

    try {
      await this.tracker.connect()
      console.log('Persistent eye tracker connected successfully')
    } catch (error) {
      console.error('Failed to connect persistent eye tracker:', error)
      throw error
    }
  }

  disconnect(): void {
    if (this.tracker) {
      this.tracker.disconnect()
      console.log('Persistent eye tracker disconnected')
    }
  }

  startCalibration(): void {
    if (this.tracker && this.isConnected) {
      this.tracker.startCalibration()
    } else {
      throw new Error('Eye tracker not connected')
    }
  }

  getStatus(): DeviceStatus {
    return this.deviceStatus
  }

  isTrackerConnected(): boolean {
    return this.isConnected && this.tracker?.isConnected() || false
  }

  setWsUrl(url: string): void {
    if (url !== this.wsUrl) {
      this.wsUrl = url
      this.disconnect()
      this.initializeTracker()
    }
  }

  getLatestCameraFrame(): { imageData: string; timestamp: number } | null {
    return this.latestCameraFrame
  }

  private broadcastStatus(): void {
    // Send to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'EYE_TRACKER_STATUS',
            status: this.deviceStatus,
            isConnected: this.isConnected
          }).catch(() => {
            // Ignore errors for tabs without content script
          })
        }
      })
    })

    // Save status to storage for popup to read
    chrome.storage.local.set({
      eyeTrackerStatus: this.deviceStatus,
      eyeTrackerConnected: this.isConnected,
      eyeTrackerLastUpdate: Date.now()
    })
  }

  private broadcastGazeData(data: GazeData): void {
    // Send to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'GAZE_DATA',
            data: data
          }).catch(() => {
            // Ignore errors
          })
        }
      })
    })
    
    // Send to popup if open
    chrome.runtime.sendMessage({
      type: 'GAZE_DATA',
      data: data
    }).catch(() => {
      // Ignore if popup not open
    })
  }

  private broadcastCalibrationProgress(progress: { current: number; total: number }): void {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'CALIBRATION_PROGRESS',
            current: progress.current,
            total: progress.total
          }).catch(() => {
            // Ignore errors
          })
        }
      })
    })
  }

  private broadcastCalibrationComplete(result: CalibrationResult): void {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'CALIBRATION_COMPLETE',
            result: result
          }).catch(() => {
            // Ignore errors
          })
        }
      })
    })
  }

  private broadcastCameraFrame(frame: { imageData: string; timestamp: number }): void {
    // Send to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'CAMERA_FRAME',
            frame: frame
          }).catch(() => {
            // Ignore errors
          })
        }
      })
    })
    
    // Send to popup if open
    chrome.runtime.sendMessage({
      type: 'CAMERA_FRAME',
      frame: frame
    }).catch(() => {
      // Ignore if popup not open
    })
  }
}
