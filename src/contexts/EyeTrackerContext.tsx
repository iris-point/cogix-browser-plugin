import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { 
  createEyeTracker, 
  DeviceStatus, 
  type EyeTracker, 
  type GazeData, 
  type CalibrationResult
} from '@iris-point/eye-tracking-core'

// Eye tracking imports loaded successfully

interface EyeTrackerContextType {
  // State
  eyeTracker: EyeTracker | null
  deviceStatus: DeviceStatus
  isCalibrating: boolean
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
  const [eyeTracker, setEyeTracker] = useState<EyeTracker | null>(null)
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>(DeviceStatus.DISCONNECTED)
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [calibrationResult, setCalibrationResult] = useState<CalibrationResult | null>(null)
  const [currentGaze, setCurrentGaze] = useState<GazeData | null>(null)
  const [wsUrl, setWsUrl] = useState('wss://127.0.0.1:8443')
  const trackerRef = useRef<EyeTracker | null>(null)
  
  // Initialize eye tracker only once or when wsUrl changes
  useEffect(() => {
    console.log('EyeTrackerContext useEffect running, wsUrl:', wsUrl)
    
    // Clean up existing tracker only if we have one
    if (trackerRef.current) {
      console.log('Cleaning up existing tracker')
      trackerRef.current.disconnect()
      trackerRef.current = null
    }
    
    // Create new tracker
    console.log('Creating new eye tracker with config:', {
      wsUrl: [wsUrl, 'ws://127.0.0.1:9000'],
      bufferSize: 100,
      autoConnect: false,
      autoInitialize: false,
      debug: true
    })
    
    let tracker: EyeTracker | null = null
    try {
      tracker = createEyeTracker({
        wsUrl: [wsUrl, 'ws://127.0.0.1:9000'], // Try secure first, fallback to unsecured
        bufferSize: 100,
        autoConnect: false,
        autoInitialize: false,  // Manual initialization for proper control
        debug: true
      })
    } catch (error) {
      console.error('Failed to create eye tracker:', error)
      return
    }
    
    if (!tracker) {
      console.error('Eye tracker creation returned null/undefined')
      return
    }
    
    console.log('Eye tracker created successfully')
    
    // Set up event listeners with correct event names
    if (typeof tracker.on === 'function') {
      tracker.on('statusChanged', (status: DeviceStatus) => {
        console.log('Global eye tracker status changed to:', status)
        setDeviceStatus(status)
        
        // Save connection status to storage for persistence
        chrome.storage.sync.set({ 
          eyeTrackerConnected: status === DeviceStatus.CONNECTED,
          eyeTrackerStatus: status
        })
      })
    } else {
      console.error('Eye tracker does not have .on() method:', tracker)
    }
    
    // Only set up other event listeners if the tracker has the on method
    if (typeof tracker.on === 'function') {
      // Handle connected event - initialization sequence
      tracker.on('connected', () => {
        console.log('Eye tracker connected globally - starting initialization')
        
        // Follow the exact sequence from the working demo
        setTimeout(() => {
          console.log('Initializing device...')
          tracker.initDevice(false) // false = no fullscreen in popup
          
          setTimeout(() => {
            console.log('Initializing light...')
            tracker.initLight()
            
            setTimeout(() => {
              console.log('Initializing camera...')
              tracker.initCamera()
            }, 500)
          }, 500)
        }, 100)
      })
      
      // Handle disconnected event
      tracker.on('disconnected', () => {
        console.log('Eye tracker disconnected globally')
      })
      
      tracker.on('ready', () => {
        console.log('Eye tracker ready globally')
      })
      
      // Handle gaze data with correct event name
      tracker.on('gazeData', (data: GazeData) => {
        setCurrentGaze(data)
        
        // Send gaze data to content script for recording
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'GAZE_DATA',
              data: data
            }).catch(() => {
              // Ignore errors if content script not loaded
            })
          }
        })
      })
      
      // Handle calibration completion with correct event name
      tracker.on('calibrationComplete', (result: CalibrationResult) => {
        setCalibrationResult(result)
        setIsCalibrating(false)
        console.log('Global calibration result:', result)
      })
      
      // Handle camera frames - simple direct approach like the working demos
      tracker.on('cameraFrame', (frame: { imageData: string; timestamp: number }) => {
        // Update any camera image elements on the page
        const cameraImages = document.querySelectorAll('.eye-tracker-camera-image')
        cameraImages.forEach((img: HTMLImageElement) => {
          if (frame.imageData) {
            img.src = `data:image/jpeg;base64,${frame.imageData}`
          }
        })
      })
    }
    
    trackerRef.current = tracker
    setEyeTracker(tracker)
    
    // Check if we should auto-reconnect based on stored state
    chrome.storage.sync.get(['eyeTrackerConnected', 'eyeTrackerWsUrl'], (data) => {
      if (data.eyeTrackerConnected && data.eyeTrackerWsUrl === wsUrl) {
        console.log('Auto-reconnecting to eye tracker')
        tracker.connect().catch(console.error)
      }
    })
    
    return () => {
      if (trackerRef.current) {
        trackerRef.current.disconnect()
        trackerRef.current = null
      }
    }
  }, [wsUrl])
  
  const connect = useCallback(async () => {
    const tracker = trackerRef.current
    console.log('Connect called, tracker exists:', !!tracker, 'wsUrl:', wsUrl)
    
    if (!tracker) {
      const error = new Error('Eye tracker not initialized')
      console.error(error)
      throw error
    }
    
    try {
      console.log('Attempting to connect to:', wsUrl)
      setDeviceStatus(DeviceStatus.CONNECTING)
      
      await tracker.connect()
      
      console.log('Connection promise resolved')
      // Save URL for auto-reconnect
      await chrome.storage.sync.set({ eyeTrackerWsUrl: wsUrl })
    } catch (error) {
      console.error('Connection failed with error:', error)
      setDeviceStatus(DeviceStatus.ERROR)
      throw error
    }
  }, [wsUrl])
  
  const disconnect = useCallback(() => {
    const tracker = trackerRef.current
    if (!tracker) return
    
    tracker.disconnect()
    chrome.storage.sync.remove(['eyeTrackerConnected', 'eyeTrackerWsUrl'])
  }, [])
  
  // Handle calibration progress events
  useEffect(() => {
    const tracker = trackerRef.current
    if (!tracker) return
    
    const handleCalibrationStarted = () => {
      setIsCalibrating(true)
    }
    
    const handleCalibrationCancelled = () => {
      setIsCalibrating(false)
    }
    
    // Check if tracker has the required methods before calling
    if (typeof tracker.on === 'function' && typeof tracker.off === 'function') {
      tracker.on('calibrationStarted', handleCalibrationStarted)
      tracker.on('calibrationCancelled', handleCalibrationCancelled)
      
      return () => {
        tracker.off('calibrationStarted', handleCalibrationStarted)
        tracker.off('calibrationCancelled', handleCalibrationCancelled)
      }
    }
  }, [wsUrl])
  
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
    eyeTracker,
    deviceStatus,
    isCalibrating,
    calibrationResult,
    currentGaze,
    wsUrl,
    connect,
    disconnect,
    setWsUrl,
    setupCameraImage
  }
  
  return (
    <EyeTrackerContext.Provider value={value}>
      {children}
    </EyeTrackerContext.Provider>
  )
}