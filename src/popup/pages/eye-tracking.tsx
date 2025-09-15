import { useRef, useEffect } from 'react'
import { useUser } from '@clerk/chrome-extension'
import { CalibrationUI, DeviceStatus } from '@iris-point/eye-tracking-core'
import { useEyeTracker } from '../../contexts/EyeTrackerContext'

export const EyeTrackingPage = () => {
  const { user } = useUser()
  const {
    deviceStatus,
    isCalibrating,
    isCalibrated,
    isTracking,
    calibrationResult,
    currentGaze,
    wsUrl,
    connect,
    disconnect,
    setWsUrl,
    setupCameraImage
  } = useEyeTracker()
  
  const imgRef = useRef<HTMLImageElement>(null)
  
  // Consider device calibrated if either isCalibrated is true OR device is in TRACKING state
  // (TRACKING state means it's already calibrated and actively tracking)
  const isEffectivelyCalibrated = isCalibrated || deviceStatus === DeviceStatus.TRACKING || isTracking
  
  // Set up camera image when connected
  useEffect(() => {
    if (imgRef.current && deviceStatus === DeviceStatus.CONNECTED) {
      setupCameraImage(imgRef.current)
    }
  }, [deviceStatus, setupCameraImage])
  
  const handleConnect = async () => {
    console.log('Handle connect clicked')
    try {
      await connect()
      console.log('Connect completed successfully')
    } catch (error: any) {
      console.error('Failed to connect - Full error:', error)
      const errorMessage = error?.message || 'Unknown error occurred'
      alert(`Failed to connect to eye tracker:\n${errorMessage}\n\nTroubleshooting:\n1. Make sure the eye tracker SDK is running\n2. Check it's on port ${wsUrl.split(':').pop()}\n3. Try wss://127.0.0.1:8443 or ws://127.0.0.1:9000\n4. Check browser console for details`)
    }
  }
  
  const handleDisconnect = async () => {
    const confirmed = confirm(
      'Are you sure you want to disconnect the eye tracker?\n\n' +
      'This will:\n' +
      '• Stop all eye tracking data collection\n' +
      '• End any active recording sessions\n' +
      '• Close the persistent background connection\n\n' +
      'You will need to reconnect to use eye tracking again.'
    )
    
    if (confirmed) {
      console.log('User confirmed disconnect')
      try {
        await disconnect()
        console.log('Disconnect completed successfully')
      } catch (error: any) {
        console.error('Failed to disconnect:', error)
        alert(`Failed to disconnect: ${error.message}`)
      }
    } else {
      console.log('User cancelled disconnect')
    }
  }
  
  const handleStartCalibration = async () => {
    if (deviceStatus !== DeviceStatus.CONNECTED) {
      alert('Please connect to the eye tracker first')
      return
    }
    
    try {
      // First test if content script is available
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tabs[0]?.id) {
        alert('Please navigate to a web page first to start calibration')
        return
      }
      
      // Test content script connection
      try {
        const pingResponse = await chrome.tabs.sendMessage(tabs[0].id, { type: 'PING' })
        console.log('Content script ping successful:', pingResponse)
      } catch (pingError) {
        console.error('Content script not available:', pingError)
        alert('Content script not loaded. Please:\n1. Refresh the current page\n2. Make sure you are on a regular web page (not chrome:// or extension pages)\n3. Try again')
        return
      }
      
      // Send calibration start message
      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        type: 'START_CALIBRATION'
      })
      
      console.log('Calibration start response:', response)
      
      if (response.success) {
        console.log('Full-screen calibration started successfully')
        // The popup can stay open, calibration will happen on the page
      } else {
        alert('Failed to start calibration on the page')
      }
      
    } catch (error) {
      console.error('Failed to start calibration:', error)
      alert(`Failed to start calibration: ${error.message}\n\nTroubleshooting:\n1. Refresh the current page\n2. Make sure you are on a regular web page\n3. Check browser console for details`)
    }
  }
  
  const getStatusColor = (status: DeviceStatus) => {
    switch (status) {
      case DeviceStatus.CONNECTED:
      case DeviceStatus.TRACKING:
        return 'plasmo-text-green-600 plasmo-bg-green-50'
      case DeviceStatus.CONNECTING:
      case DeviceStatus.CALIBRATING:
        return 'plasmo-text-yellow-600 plasmo-bg-yellow-50'
      case DeviceStatus.DISCONNECTED:
        return 'plasmo-text-gray-600 plasmo-bg-gray-50'
      case DeviceStatus.ERROR:
        return 'plasmo-text-red-600 plasmo-bg-red-50'
      default:
        return 'plasmo-text-gray-600 plasmo-bg-gray-50'
    }
  }
  
  const getStatusText = (status: DeviceStatus) => {
    switch (status) {
      case DeviceStatus.CONNECTED:
        return 'Connected'
      case DeviceStatus.TRACKING:
        return 'Connected & Tracking'
      case DeviceStatus.CONNECTING:
        return 'Connecting...'
      case DeviceStatus.CALIBRATING:
        return 'Calibrating...'
      case DeviceStatus.DISCONNECTED:
        return 'Disconnected'
      case DeviceStatus.ERROR:
        return 'Connection Error'
      default:
        return 'Unknown'
    }
  }
  
  return (
    <div className="plasmo-p-4 plasmo-h-full plasmo-overflow-y-auto">
      <h2 className="plasmo-text-xl plasmo-font-bold plasmo-mb-3 plasmo-text-[var(--foreground)]">Eye Tracking</h2>
      
      {/* Connection Status */}
      <div className="plasmo-mb-3 plasmo-p-3 plasmo-bg-white plasmo-rounded-lg plasmo-border plasmo-border-gray-200">
        <h3 className="plasmo-text-sm plasmo-font-semibold plasmo-mb-2">Connection Status</h3>
        <div className={`plasmo-inline-flex plasmo-items-center plasmo-px-3 plasmo-py-1 plasmo-rounded-full plasmo-text-sm plasmo-font-medium ${getStatusColor(deviceStatus)}`}>
          <div className={`plasmo-w-2 plasmo-h-2 plasmo-rounded-full plasmo-mr-2 ${
            deviceStatus === DeviceStatus.CONNECTED ? 'plasmo-bg-green-600' :
            deviceStatus === DeviceStatus.CONNECTING ? 'plasmo-bg-yellow-600 plasmo-animate-pulse' :
            deviceStatus === DeviceStatus.ERROR ? 'plasmo-bg-red-600' :
            'plasmo-bg-gray-600'
          }`}></div>
          {getStatusText(deviceStatus)}
        </div>
        <div className="plasmo-mt-2">
          {(deviceStatus === DeviceStatus.CONNECTED || deviceStatus === DeviceStatus.TRACKING) ? (
            <p className="plasmo-text-xs plasmo-text-gray-500 plasmo-mb-2">
              Connected and ready. Connection persists even when popup is closed.
            </p>
          ) : (
            <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-mb-2">
              <p className="plasmo-text-xs plasmo-text-gray-500">
                Status sync issue detected.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="plasmo-px-2 plasmo-py-1 plasmo-bg-blue-100 plasmo-text-blue-700 plasmo-rounded plasmo-text-xs hover:plasmo-bg-blue-200"
              >
                Refresh
              </button>
            </div>
          )}
          
          {/* Enhanced status indicators - show regardless of connection status */}
          <div className="plasmo-flex plasmo-flex-wrap plasmo-gap-2 plasmo-mb-2">
            <span className={`plasmo-inline-flex plasmo-items-center plasmo-px-2 plasmo-py-1 plasmo-rounded-full plasmo-text-xs plasmo-font-medium ${
              isEffectivelyCalibrated ? 'plasmo-bg-green-100 plasmo-text-green-700' : 'plasmo-bg-yellow-100 plasmo-text-yellow-700'
            }`}>
              <div className={`plasmo-w-1.5 plasmo-h-1.5 plasmo-rounded-full plasmo-mr-1 ${
                isEffectivelyCalibrated ? 'plasmo-bg-green-500' : 'plasmo-bg-yellow-500'
              }`}></div>
              {isEffectivelyCalibrated ? 'Calibrated' : 'Not Calibrated'}
            </span>
            
            <span className={`plasmo-inline-flex plasmo-items-center plasmo-px-2 plasmo-py-1 plasmo-rounded-full plasmo-text-xs plasmo-font-medium ${
              isTracking ? 'plasmo-bg-blue-100 plasmo-text-blue-700' : 'plasmo-bg-gray-100 plasmo-text-gray-700'
            }`}>
              <div className={`plasmo-w-1.5 plasmo-h-1.5 plasmo-rounded-full plasmo-mr-1 ${
                isTracking ? 'plasmo-bg-blue-500' : 'plasmo-bg-gray-500'
              }`}></div>
              {isTracking ? 'Tracking' : 'Not Tracking'}
            </span>
          </div>
          
          {(deviceStatus === DeviceStatus.CONNECTED || deviceStatus === DeviceStatus.TRACKING || isEffectivelyCalibrated || isTracking) && (
            <button
              onClick={handleDisconnect}
              className="plasmo-inline-flex plasmo-items-center plasmo-px-3 plasmo-py-1 plasmo-bg-red-100 plasmo-text-red-700 plasmo-rounded-md plasmo-text-xs plasmo-font-medium hover:plasmo-bg-red-200 plasmo-transition-colors"
            >
              <svg className="plasmo-w-3 plasmo-h-3 plasmo-mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Force Disconnect
            </button>
          )}
        </div>
      </div>
      
      {/* Connection Controls */}
      <div className="plasmo-mb-3 plasmo-p-3 plasmo-bg-white plasmo-rounded-lg plasmo-border plasmo-border-gray-200">
        <h3 className="plasmo-text-sm plasmo-font-semibold plasmo-mb-2">WebSocket URL</h3>
        <input
          type="text"
          value={wsUrl}
          onChange={(e) => setWsUrl(e.target.value)}
          className="plasmo-w-full plasmo-px-3 plasmo-py-1.5 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-text-sm plasmo-mb-2"
          placeholder="wss://127.0.0.1:8443"
          disabled={deviceStatus === DeviceStatus.CONNECTED || deviceStatus === DeviceStatus.CONNECTING}
        />
        <div className="plasmo-flex plasmo-gap-2">
          <button
            onClick={handleConnect}
            disabled={deviceStatus === DeviceStatus.CONNECTED || deviceStatus === DeviceStatus.CONNECTING}
            className="plasmo-flex-1 plasmo-px-4 plasmo-py-2 plasmo-bg-indigo-600 plasmo-text-white plasmo-rounded-md plasmo-text-sm plasmo-font-medium hover:plasmo-bg-indigo-700 disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed"
          >
            Connect
          </button>
          <button
            onClick={handleDisconnect}
            disabled={deviceStatus !== DeviceStatus.CONNECTED}
            className={`plasmo-flex-1 plasmo-px-4 plasmo-py-2 plasmo-text-white plasmo-rounded-md plasmo-text-sm plasmo-font-medium disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed ${
              deviceStatus === DeviceStatus.CONNECTED 
                ? 'plasmo-bg-red-600 hover:plasmo-bg-red-700' 
                : 'plasmo-bg-gray-600 hover:plasmo-bg-gray-700'
            }`}
          >
            Disconnect
          </button>
        </div>
      </div>
      
      {/* Calibration */}
      <div className="plasmo-mb-3 plasmo-p-3 plasmo-bg-white plasmo-rounded-lg plasmo-border plasmo-border-gray-200">
        <h3 className="plasmo-text-sm plasmo-font-semibold plasmo-mb-2">Calibration</h3>
        
        {/* Calibration Status */}
        {isEffectivelyCalibrated ? (
          <div className="plasmo-mb-3 plasmo-p-2 plasmo-bg-green-50 plasmo-border plasmo-border-green-200 plasmo-rounded plasmo-text-sm">
            <div className="plasmo-text-green-800 plasmo-flex plasmo-items-center">
              <svg className="plasmo-w-4 plasmo-h-4 plasmo-mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              ✓ Calibrated and ready for recording
              {isTracking && <span className="plasmo-ml-2 plasmo-text-blue-600">• Tracking Active</span>}
            </div>
          </div>
        ) : (
          <div className="plasmo-mb-3 plasmo-p-2 plasmo-bg-yellow-50 plasmo-border plasmo-border-yellow-200 plasmo-rounded plasmo-text-sm">
            <div className="plasmo-text-yellow-800">
              ⚠️ Calibration required before recording
            </div>
          </div>
        )}
        
        <button
          onClick={handleStartCalibration}
          disabled={deviceStatus !== DeviceStatus.CONNECTED || isCalibrating}
          className={`plasmo-w-full plasmo-px-4 plasmo-py-2 plasmo-text-white plasmo-rounded-md plasmo-text-sm plasmo-font-medium disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed ${
            isEffectivelyCalibrated 
              ? 'plasmo-bg-green-600 hover:plasmo-bg-green-700' 
              : 'plasmo-bg-purple-600 hover:plasmo-bg-purple-700'
          }`}
        >
          {isCalibrating ? 'Calibrating...' : isEffectivelyCalibrated ? 'Recalibrate' : 'Start Calibration'}
        </button>
      </div>
      
      
      {/* Camera View */}
      <div className="plasmo-p-3 plasmo-bg-white plasmo-rounded-lg plasmo-border plasmo-border-gray-200">
        <h3 className="plasmo-text-sm plasmo-font-semibold plasmo-mb-2">Camera View</h3>
        <div className="plasmo-relative plasmo-w-full plasmo-h-40 plasmo-bg-gray-100 plasmo-rounded plasmo-overflow-hidden">
          <img 
            ref={imgRef}
            className="plasmo-absolute plasmo-inset-0 plasmo-w-full plasmo-h-full plasmo-object-cover"
            alt="Eye tracker camera feed"
          />
          {deviceStatus === DeviceStatus.DISCONNECTED && (
            <div className="plasmo-absolute plasmo-inset-0 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-bg-gray-900 plasmo-bg-opacity-50">
              <p className="plasmo-text-white plasmo-text-sm">Connect to view camera</p>
            </div>
          )}
          {currentGaze && deviceStatus === DeviceStatus.CONNECTED && (
            <div className="plasmo-absolute plasmo-bottom-2 plasmo-left-2 plasmo-text-xs plasmo-bg-black plasmo-bg-opacity-60 plasmo-text-white plasmo-px-2 plasmo-py-1 plasmo-rounded plasmo-shadow">
              Gaze: X: {currentGaze.x.toFixed(3)}, Y: {currentGaze.y.toFixed(3)}
            </div>
          )}
        </div>
      </div>
      
      {/* Note: Calibration is handled by content script for full-screen overlay */}
    </div>
  )
}