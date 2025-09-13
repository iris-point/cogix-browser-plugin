import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { 
  DeviceStatus, 
  type GazeData, 
  type CalibrationResult
} from '@iris-point/eye-tracking-core'

// Eye tracking now managed by background script for persistence

interface EyeTrackerContextType {
  // State
  deviceStatus: DeviceStatus
  isCalibrating: boolean
  isCalibrated: boolean
  isTracking: boolean
  calibrationResult: CalibrationResult | null
  currentGaze: GazeData | null
  wsUrl: string
  
  // Actions
  connect: () => Promise<void>
  disconnect: () => void
  setWsUrl: (url: string) => void
  setupCameraImage: (imgElement: HTMLImageElement) => void
}

const EyeTrackerContext = createContext<EyeTrackerContextType | undefined>(undefined)

export const useEyeTracker = () => {
  const context = useContext(EyeTrackerContext)
  if (!context) {
    throw new Error('useEyeTracker must be used within EyeTrackerProvider')
  }
  return context
}

export const EyeTrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>(DeviceStatus.DISCONNECTED)
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [isCalibrated, setIsCalibrated] = useState(false)
  const [isTracking, setIsTracking] = useState(false)
  const [calibrationResult, setCalibrationResult] = useState<CalibrationResult | null>(null)
  const [currentGaze, setCurrentGaze] = useState<GazeData | null>(null)
  const [wsUrl, setWsUrl] = useState('wss://127.0.0.1:8443')
  
  // Listen for eye tracker status updates from background script
  useEffect(() => {
    console.log('Setting up eye tracker context with background script communication')
    
    // Listen for gaze data and calibration updates from background
    const handleMessage = (message: any, sender: any, sendResponse: any) => {
      switch (message.type) {
        case 'GAZE_DATA':
          setCurrentGaze(message.data)
          break
        case 'CALIBRATION_COMPLETE':
          setCalibrationResult(message.result)
          setIsCalibrating(false)
          break
        case 'CAMERA_FRAME':
          // Update camera images in popup
          const cameraImages = document.querySelectorAll('.eye-tracker-camera-image')
          cameraImages.forEach((img: HTMLImageElement) => {
            if (message.frame.imageData) {
              img.src = `data:image/jpeg;base64,${message.frame.imageData}`
            }
          })
          break
      }
    }
    
    chrome.runtime.onMessage.addListener(handleMessage)
    
    // Get comprehensive status from both storage and background script
    const updateStatus = () => {
      // First get from storage (fast)
      chrome.storage.local.get([
        'eyeTrackerStatus', 
        'eyeTrackerConnected', 
        'eyeTrackerCalibrated', 
        'eyeTrackerTracking'
      ], (result) => {
        console.log('Status from storage:', result)
        
        // Update connection status
        if (result.eyeTrackerStatus) {
          setDeviceStatus(result.eyeTrackerStatus)
        } else if (result.eyeTrackerConnected) {
          // Fallback: if we have connection info but no status, assume connected
          setDeviceStatus(DeviceStatus.CONNECTED)
        }
        
        // Update calibration and tracking status
        if (result.eyeTrackerCalibrated !== undefined) {
          setIsCalibrated(result.eyeTrackerCalibrated)
        }
        if (result.eyeTrackerTracking !== undefined) {
          setIsTracking(result.eyeTrackerTracking)
        }
      })
      
      // Also request fresh status from background script
      chrome.runtime.sendMessage({ type: 'EYE_TRACKER_STATUS' }, (response) => {
        if (response) {
          console.log('Fresh status from background:', response)
          setDeviceStatus(response.status)
          if (response.isCalibrated !== undefined) {
            setIsCalibrated(response.isCalibrated)
          }
          if (response.isTracking !== undefined) {
            setIsTracking(response.isTracking)
          }
        }
      })
    }
    
    // Update camera frames for popup
    const updateCameraFrame = () => {
      chrome.runtime.sendMessage({ type: 'GET_CAMERA_FRAME' }, (response) => {
        if (response && response.frame && response.frame.imageData) {
          const cameraImages = document.querySelectorAll('.eye-tracker-camera-image')
          cameraImages.forEach((img: HTMLImageElement) => {
            img.src = `data:image/jpeg;base64,${response.frame.imageData}`
          })
        }
      })
    }
    
    // Get status immediately with multiple attempts for reliability
    const initializeStatus = async () => {
      // Attempt 1: Get from storage
      updateStatus()
      
      // Attempt 2: Wait a bit and try background script directly
      setTimeout(() => {
        chrome.runtime.sendMessage({ type: 'EYE_TRACKER_STATUS' }, (response) => {
          if (response) {
            console.log('Delayed status from background:', response)
            setDeviceStatus(response.status)
            if (response.isCalibrated !== undefined) {
              setIsCalibrated(response.isCalibrated)
            }
            if (response.isTracking !== undefined) {
              setIsTracking(response.isTracking)
            }
            
            // Start camera polling if connected
            if (response.status === DeviceStatus.CONNECTED) {
              startCameraPolling()
            }
          } else {
            console.warn('No response from background script - checking storage again')
            // Fallback: Check storage again if background doesn't respond
            chrome.storage.local.get(['eyeTrackerConnected', 'eyeTrackerCalibrated'], (result) => {
              if (result.eyeTrackerConnected) {
                console.log('Fallback: Setting connected status from storage')
                setDeviceStatus(DeviceStatus.CONNECTED)
                startCameraPolling()
              }
              if (result.eyeTrackerCalibrated) {
                setIsCalibrated(true)
              }
            })
          }
        })
      }, 500) // Wait 500ms for background to be ready
      
      // Attempt 3: Another try after 1 second
      setTimeout(() => {
        chrome.runtime.sendMessage({ type: 'EYE_TRACKER_STATUS' }, (response) => {
          if (response) {
            console.log('Final status check from background:', response)
            setDeviceStatus(response.status)
            if (response.isCalibrated !== undefined) {
              setIsCalibrated(response.isCalibrated)
            }
            if (response.isTracking !== undefined) {
              setIsTracking(response.isTracking)
            }
          }
        })
      }, 1000)
    }
    
    initializeStatus()
    
    // Poll for status updates every 1 second to keep popup in sync
    const statusInterval = setInterval(updateStatus, 1000)
    
    // Poll for camera frames every 100ms when connected (10 FPS for popup)
    let cameraInterval: NodeJS.Timeout | null = null
    
    const startCameraPolling = () => {
      if (cameraInterval) clearInterval(cameraInterval)
      cameraInterval = setInterval(updateCameraFrame, 100)
    }
    
    const stopCameraPolling = () => {
      if (cameraInterval) {
        clearInterval(cameraInterval)
        cameraInterval = null
      }
    }
    
    // Also listen for storage changes for immediate updates
    const handleStorageChange = (changes: any, namespace: string) => {
      if (namespace === 'local') {
        let shouldUpdateCamera = false
        
        if (changes.eyeTrackerStatus) {
          console.log('Eye tracker status changed in storage:', changes.eyeTrackerStatus.newValue)
          const newStatus = changes.eyeTrackerStatus.newValue
          setDeviceStatus(newStatus)
          shouldUpdateCamera = true
        }
        
        if (changes.eyeTrackerConnected) {
          console.log('Eye tracker connection changed in storage:', changes.eyeTrackerConnected.newValue)
          // If we have connection info but no status, derive status from connection
          if (changes.eyeTrackerConnected.newValue && !changes.eyeTrackerStatus) {
            setDeviceStatus(DeviceStatus.CONNECTED)
            shouldUpdateCamera = true
          }
        }
        
        if (changes.eyeTrackerCalibrated) {
          console.log('Eye tracker calibration changed in storage:', changes.eyeTrackerCalibrated.newValue)
          setIsCalibrated(changes.eyeTrackerCalibrated.newValue)
        }
        
        if (changes.eyeTrackerTracking) {
          console.log('Eye tracker tracking changed in storage:', changes.eyeTrackerTracking.newValue)
          setIsTracking(changes.eyeTrackerTracking.newValue)
        }
        
        // Start/stop camera polling based on connection status
        if (shouldUpdateCamera) {
          const isConnectedNow = changes.eyeTrackerStatus?.newValue === DeviceStatus.CONNECTED || 
                                changes.eyeTrackerConnected?.newValue === true
          if (isConnectedNow) {
            startCameraPolling()
          } else {
            stopCameraPolling()
          }
        }
      }
    }
    
    chrome.storage.onChanged.addListener(handleStorageChange)
    
    // Set WebSocket URL in background
    chrome.runtime.sendMessage({ 
      type: 'EYE_TRACKER_SET_URL', 
      url: wsUrl 
    })
    
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
      chrome.storage.onChanged.removeListener(handleStorageChange)
      clearInterval(statusInterval)
      stopCameraPolling()
    }
  }, [wsUrl])
  
  const connect = useCallback(async () => {
    console.log('Connect called via background script, wsUrl:', wsUrl)
    
    try {
      setDeviceStatus(DeviceStatus.CONNECTING)
      
      const response = await chrome.runtime.sendMessage({
        type: 'EYE_TRACKER_CONNECT'
      })
      
      if (response.success) {
        console.log('Eye tracker connected via background script')
        // Status will be updated via message listener
      } else {
        setDeviceStatus(DeviceStatus.ERROR)
        throw new Error(response.error || 'Connection failed')
      }
    } catch (error) {
      console.error('Connection failed:', error)
      setDeviceStatus(DeviceStatus.ERROR)
      throw error
    }
  }, [wsUrl])
  
  const disconnect = useCallback(async () => {
    console.log('Disconnect called via background script')
    
    try {
      await chrome.runtime.sendMessage({
        type: 'EYE_TRACKER_DISCONNECT'
      })
      console.log('Eye tracker disconnected via background script')
    } catch (error) {
      console.error('Disconnect failed:', error)
    }
  }, [])
  
  // Update WebSocket URL in background when changed
  const updateWsUrl = useCallback((newUrl: string) => {
    setWsUrl(newUrl)
    chrome.runtime.sendMessage({
      type: 'EYE_TRACKER_SET_URL',
      url: newUrl
    })
  }, [])
  
  // Simple camera image setup - just add the class to any img element
  const setupCameraImage = useCallback((imgElement: HTMLImageElement) => {
    if (!imgElement) return
    
    // Add the class that the camera frame handler looks for
    imgElement.classList.add('eye-tracker-camera-image')
    
    // Set initial styles for better display
    imgElement.style.width = '100%'
    imgElement.style.height = '100%'
    imgElement.style.objectFit = 'cover'
    imgElement.style.borderRadius = '8px'
    imgElement.style.transform = 'scaleX(-1)' // Mirror for natural view
    
    console.log('Camera image element set up')
  }, [])
  
  const value = {
    deviceStatus,
    isCalibrating,
    isCalibrated,
    isTracking,
    calibrationResult,
    currentGaze,
    wsUrl,
    connect,
    disconnect,
    setWsUrl: updateWsUrl,
    setupCameraImage
  }
  
  return (
    <EyeTrackerContext.Provider value={value}>
      {children}
    </EyeTrackerContext.Provider>
  )
}