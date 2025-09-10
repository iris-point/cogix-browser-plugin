import { EyeTracker, CalibrationUI, DeviceStatus, createEyeTracker, type CoreConfig, type GazeData } from "@iris-point/eye-tracking-core"

export interface EyeTrackingConfig {
  provider: "webgazer" | "hardware"
  calibrationData?: any
  wsUrl?: string
}

class EyeTrackingManager {
  public sdk: EyeTracker | null = null
  private isInitialized = false
  private dataCallback: ((data: GazeData) => void) | null = null

  async initialize(config: EyeTrackingConfig) {
    if (this.isInitialized) {
      console.warn("Eye tracking already initialized")
      return
    }

    try {
      // Create SDK configuration
      const sdkConfig: CoreConfig = {
        autoConnect: false,
        reconnectInterval: 3000,
        maxReconnectAttempts: 5,
        bufferSize: 100,
        verbose: true
      }

      // For hardware provider, set WebSocket URL
      if (config.provider === "hardware") {
        sdkConfig.wsUrl = config.wsUrl || "ws://localhost:50021"
      }

      // Initialize SDK
      this.sdk = createEyeTracker(sdkConfig)

      // For WebGazer, we'll need to handle it differently
      // since the core SDK is designed for WebSocket hardware trackers
      if (config.provider === "webgazer") {
        console.warn("WebGazer provider not yet fully implemented in core SDK")
        // We'll need to integrate WebGazer separately or extend the SDK
      }

      // Set up event listeners
      this.sdk.on('connected', () => {
        console.log("Eye tracker connected")
      })

      this.sdk.on('disconnected', () => {
        console.log("Eye tracker disconnected")
      })

      this.sdk.on('data', (data: GazeData) => {
        if (this.dataCallback) {
          this.dataCallback(data)
        }
      })

      this.sdk.on('calibrationComplete', (result) => {
        console.log("Calibration complete:", result)
        this.saveCalibration(result)
      })

      // Load calibration if available
      if (config.calibrationData) {
        await this.loadCalibration(config.calibrationData)
      }

      // Connect to eye tracker
      await this.sdk.connect()

      this.isInitialized = true
      console.log("Eye tracking initialized successfully")
    } catch (error) {
      console.error("Failed to initialize eye tracking:", error)
      throw error
    }
  }

  async startTracking() {
    if (!this.sdk) {
      throw new Error("Eye tracking not initialized")
    }

    // The SDK starts tracking automatically when connected
    // This method is kept for API consistency
    if (this.sdk.getStatus() !== DeviceStatus.TRACKING) {
      await this.sdk.connect()
    }
  }

  async stopTracking() {
    if (!this.sdk) return

    await this.sdk.disconnect()
  }

  async calibrate(points?: Array<{ x: number; y: number }>) {
    if (!this.sdk) {
      throw new Error("Eye tracking not initialized")
    }

    // Start calibration
    await this.sdk.startCalibration()
    
    // The CalibrationUI will handle the visual feedback
    // and the SDK will emit calibrationComplete when done
  }

  async loadCalibration(calibrationData: any) {
    if (!this.sdk) {
      throw new Error("Eye tracking not initialized")
    }

    // The core SDK doesn't have a direct loadCalibration method
    // We'll store it and apply it when needed
    await this.saveCalibration(calibrationData)
  }

  async saveCalibration(calibrationData: any) {
    // Save to chrome storage
    await chrome.storage.local.set({ 
      eyeTrackingCalibration: {
        data: calibrationData,
        timestamp: Date.now()
      }
    })
  }

  async getStoredCalibration() {
    const result = await chrome.storage.local.get("eyeTrackingCalibration")
    return result.eyeTrackingCalibration
  }

  onData(callback: (data: GazeData) => void) {
    this.dataCallback = callback
  }

  getCurrentData(): GazeData | null {
    if (!this.sdk) return null
    
    // Get the latest data from the buffer
    const buffer = this.sdk.getBuffer()
    if (buffer && buffer.length > 0) {
      return buffer[buffer.length - 1]
    }
    
    return null
  }

  async cleanup() {
    if (this.sdk) {
      await this.sdk.disconnect()
      this.sdk = null
    }
    this.isInitialized = false
    this.dataCallback = null
  }

  isReady() {
    return this.isInitialized && this.sdk !== null && this.sdk.getStatus() === DeviceStatus.TRACKING
  }

  getStatus() {
    return this.sdk?.getStatus() || DeviceStatus.DISCONNECTED
  }
}

// Singleton instance
export const eyeTrackingManager = new EyeTrackingManager()

// Helper functions for content scripts
export async function initializeEyeTracking(provider: "webgazer" | "hardware" = "hardware") {
  // Check for stored calibration
  const calibration = await eyeTrackingManager.getStoredCalibration()
  
  await eyeTrackingManager.initialize({
    provider,
    calibrationData: calibration?.data
  })
}

export function startEyeTracking() {
  return eyeTrackingManager.startTracking()
}

export function stopEyeTracking() {
  return eyeTrackingManager.stopTracking()
}

export function onEyeTrackingData(callback: (data: GazeData) => void) {
  eyeTrackingManager.onData(callback)
}

export function getEyeTrackingData() {
  return eyeTrackingManager.getCurrentData()
}