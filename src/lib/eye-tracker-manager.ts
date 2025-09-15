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
import { eyeTrackerState } from './eyeTrackerState'

export class EyeTrackerManager {
  private static instance: EyeTrackerManager | null = null
  private tracker: EyeTracker | null = null
  private wsUrl: string = 'wss://127.0.0.1:8443'
  private isConnected: boolean = false
  private deviceStatus: DeviceStatus = DeviceStatus.DISCONNECTED
  private isCalibrated: boolean = false
  private isTracking: boolean = false
  private latestCameraFrame: { imageData: string; timestamp: number } | null = null

  private constructor() {
    this.initializeTracker()
    this.restoreStateFromStorage()
  }

  static getInstance(): EyeTrackerManager {
    if (!EyeTrackerManager.instance) {
      EyeTrackerManager.instance = new EyeTrackerManager()
    }
    return EyeTrackerManager.instance
  }

  private async restoreStateFromStorage() {
    // Restore state from centralized state manager
    const state = await eyeTrackerState.getStateAsync()
    console.log('[EyeTrackerManager] Restoring state from centralized storage:', state)
    
    this.isConnected = state.isConnected
    this.isCalibrated = state.isCalibrated
    this.isTracking = state.isTracking
    this.deviceStatus = state.status
    
    if (state.isCalibrated) {
      console.log('[EyeTrackerManager] Restored calibration state: true')
    }
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
      this.tracker.on('statusChanged', async (status: DeviceStatus) => {
        console.log('Persistent eye tracker status:', status)
        this.deviceStatus = status
        this.isConnected = status === DeviceStatus.CONNECTED
        
        // Update centralized state
        await eyeTrackerState.setStatus(status)
        
        // Broadcast status to all tabs and popup
        this.broadcastStatus()
      })

      this.tracker.on('connected', async () => {
        console.log('Persistent eye tracker connected - initializing...')
        this.isConnected = true
        this.deviceStatus = DeviceStatus.CONNECTED
        
        // Update centralized state
        await eyeTrackerState.setConnected(true, DeviceStatus.CONNECTED)
        
        this.broadcastStatus() // Ensure status is broadcast immediately
        
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
      
      this.tracker.on('disconnected', async () => {
        console.log('Persistent eye tracker disconnected')
        this.isConnected = false
        this.isCalibrated = false
        this.isTracking = false
        this.deviceStatus = DeviceStatus.DISCONNECTED
        
        // Update centralized state - this will reset calibration too
        await eyeTrackerState.setConnected(false)
        
        this.broadcastStatus() // Ensure status is broadcast immediately
      })

      this.tracker.on('gazeData', (data: GazeData) => {
        // Broadcast gaze data to all tabs
        this.broadcastGazeData(data)
      })

      this.tracker.on('calibrationStarted', async (data: { points: number }) => {
        console.log('Calibration started:', data)
        this.deviceStatus = DeviceStatus.CALIBRATING
        
        // Update centralized state
        await eyeTrackerState.setStatus(DeviceStatus.CALIBRATING)
        
        this.broadcastStatus()
        
        // Broadcast the first calibration point
        this.broadcastCalibrationPoint({
          x: 0.1,
          y: 0.1,
          index: 0,
          total: data.points || 5
        })
      })
      
      this.tracker.on('calibrationProgress', (progress: any) => {
        console.log('Calibration progress:', progress)
        // The HHProvider sends nFinishedNum in the progress data
        // nFinishedNum is 1-based: 1 means first point finished, show second point
        const finishedNum = progress.nFinishedNum
        
        // Calibration points are predefined in the library
        const calibrationPoints = [
          { x: 0.1, y: 0.1 },  // Top-left (index 0)
          { x: 0.9, y: 0.1 },  // Top-right (index 1)
          { x: 0.5, y: 0.5 },  // Center (index 2)
          { x: 0.1, y: 0.9 },  // Bottom-left (index 3)
          { x: 0.9, y: 0.9 }   // Bottom-right (index 4)
        ]
        
        // Broadcast calibration progress
        this.broadcastCalibrationProgress({
          current: finishedNum,
          total: progress.total || 5,
          nFinishedNum: finishedNum
        })
        
        // When nFinishedNum=1, first point is done, show second point (index 1)
        // When nFinishedNum=2, second point is done, show third point (index 2)
        // The next point index is the same as nFinishedNum (since it's 1-based)
        const nextPointIndex = finishedNum
        
        // Broadcast the next calibration point to show
        if (nextPointIndex >= 0 && nextPointIndex < calibrationPoints.length) {
          console.log(`[EyeTrackerManager] Point ${finishedNum} finished, showing next point at index ${nextPointIndex}`)
          this.broadcastCalibrationPoint({
            x: calibrationPoints[nextPointIndex].x,
            y: calibrationPoints[nextPointIndex].y,
            index: nextPointIndex,
            total: calibrationPoints.length
          })
        } else if (finishedNum === calibrationPoints.length) {
          console.log(`[EyeTrackerManager] All ${finishedNum} points finished, calibration should complete`)
        }
      })

      this.tracker.on('calibrationComplete', async (result: CalibrationResult) => {
        console.log('[EyeTrackerManager] Calibration complete event received:', result)
        this.isCalibrated = true
        console.log('[EyeTrackerManager] Setting isCalibrated to true')
        
        // Update centralized state - this will also set tracking
        await eyeTrackerState.setCalibrated(true)
        
        // Start tracking automatically after calibration
        if (this.tracker) {
          console.log('[EyeTrackerManager] Starting tracking after calibration...')
          this.tracker.startTracking()
          this.deviceStatus = DeviceStatus.TRACKING
          this.isTracking = true
          console.log('[EyeTrackerManager] Tracking started successfully')
          
          // Update centralized state
          await eyeTrackerState.setTracking(true)
          await eyeTrackerState.setStatus(DeviceStatus.TRACKING)
        }
        
        this.broadcastStatus() // Update status with calibration info
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

  async disconnect(): Promise<void> {
    if (this.tracker) {
      this.tracker.disconnect()
      console.log('Persistent eye tracker disconnected')
    }
    
    // Ensure state is reset
    this.isConnected = false
    this.isCalibrated = false
    this.isTracking = false
    this.deviceStatus = DeviceStatus.DISCONNECTED
    this.latestCameraFrame = null
    
    // Update centralized state - this will handle all state resets
    await eyeTrackerState.setConnected(false)
    
    // Broadcast the disconnected status
    this.broadcastStatus()
  }

  startCalibration(): void {
    if (this.tracker && this.isConnected) {
      this.tracker.startCalibration()
    } else {
      throw new Error('Eye tracker not connected')
    }
  }

  async cancelCalibration(): Promise<void> {
    if (this.tracker) {
      // Call the tracker's stopCalibration method (not cancelCalibration)
      // This will properly reset the tracker's calibration state and emit 'calibrationCancelled'
      if (typeof (this.tracker as any).stopCalibration === 'function') {
        console.log('[EyeTrackerManager] Calling tracker.stopCalibration()')
        ;(this.tracker as any).stopCalibration()
      } else {
        console.warn('[EyeTrackerManager] stopCalibration method not found on tracker')
      }
      
      // Reset calibration state
      this.isCalibrated = false
      this.deviceStatus = DeviceStatus.CONNECTED
      
      // Update centralized state
      await eyeTrackerState.setCalibrated(false)
      await eyeTrackerState.setStatus(DeviceStatus.CONNECTED)
      
      // Broadcast the status change
      this.broadcastStatus()
      
      console.log('Calibration cancelled and tracker state reset')
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

  isCalibrationComplete(): boolean {
    // Don't rely on in-memory flag which can be reset on disconnect
    // Instead, check if we have a valid calibration in storage
    // This is synchronous for now but should be made async in future
    return this.isCalibrated
  }

  setCalibrationState(calibrated: boolean): void {
    this.isCalibrated = calibrated
  }

  isCurrentlyTracking(): boolean {
    return this.isTracking
  }

  private broadcastStatus(): void {
    // Send to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'EYE_TRACKER_STATUS',
            status: this.deviceStatus,
            isConnected: this.isConnected,
            isCalibrated: this.isCalibrated,
            isTracking: this.isTracking
          }).catch(() => {
            // Ignore errors for tabs without content script
          })
        }
      })
    })

    // Save comprehensive status to storage for popup to read
    chrome.storage.local.set({
      eyeTrackerStatus: this.deviceStatus,
      eyeTrackerConnected: this.isConnected,
      eyeTrackerCalibrated: this.isCalibrated,
      eyeTrackerTracking: this.isTracking,
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

  private broadcastCalibrationProgress(progress: { current: number; total: number; nFinishedNum?: number }): void {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'CALIBRATION_PROGRESS',
            current: progress.nFinishedNum || progress.current,
            total: progress.total
          }).catch(() => {
            // Ignore errors
          })
        }
      })
    })
  }
  
  private broadcastCalibrationPoint(point: { x: number; y: number; index: number; total: number }): void {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'CALIBRATION_POINT',
            point
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
