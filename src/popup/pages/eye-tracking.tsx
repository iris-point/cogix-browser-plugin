import { useRef, useEffect } from 'react'
import { useUser } from '@clerk/chrome-extension'
import { CalibrationUI, DeviceStatus } from '@iris-point/eye-tracking-core'
import { useEyeTracker } from '../../contexts/EyeTrackerContext'

export const EyeTrackingPage = () => {
  const { user } = useUser()
  const {
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
  } = useEyeTracker()
  
  const imgRef = useRef<HTMLImageElement>(null)
  const calibrationContainerRef = useRef<HTMLDivElement>(null)
  
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
  
  const handleStartCalibration = () => {
    if (!eyeTracker || deviceStatus !== DeviceStatus.CONNECTED) {
      alert('Please connect to the eye tracker first')
      return
    }
    
    // Use the eye tracker's built-in calibration method
    try {
      eyeTracker.startCalibration()
      console.log('Calibration started successfully')
    } catch (error) {
      console.error('Failed to start calibration:', error)
      alert('Failed to start calibration. Please try again.')
    }
  }
  
  const getStatusColor = (status: DeviceStatus) => {
    switch (status) {
      case DeviceStatus.CONNECTED:
        return 'plasmo-text-green-600 plasmo-bg-green-50'
      case DeviceStatus.CONNECTING:
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
      case DeviceStatus.CONNECTING:
        return 'Connecting...'
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
      <h2 className="plasmo-text-xl plasmo-font-bold plasmo-mb-4 plasmo-text-[var(--foreground)]">Eye Tracking</h2>
      
      {/* Connection Status */}
      <div className="plasmo-mb-4 plasmo-p-4 plasmo-bg-white plasmo-rounded-lg plasmo-border plasmo-border-gray-200">
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
        {deviceStatus === DeviceStatus.CONNECTED && (
          <p className="plasmo-text-xs plasmo-text-gray-500 plasmo-mt-2">
            Eye tracker is connected and ready. You can now calibrate or navigate to any page to start tracking.
          </p>
        )}
      </div>
      
      {/* Connection Controls */}
      <div className="plasmo-mb-4 plasmo-p-4 plasmo-bg-white plasmo-rounded-lg plasmo-border plasmo-border-gray-200">
        <h3 className="plasmo-text-sm plasmo-font-semibold plasmo-mb-2">WebSocket URL</h3>
        <input
          type="text"
          value={wsUrl}
          onChange={(e) => setWsUrl(e.target.value)}
          className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-text-sm plasmo-mb-3"
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
            onClick={disconnect}
            disabled={deviceStatus !== DeviceStatus.CONNECTED}
            className="plasmo-flex-1 plasmo-px-4 plasmo-py-2 plasmo-bg-gray-600 plasmo-text-white plasmo-rounded-md plasmo-text-sm plasmo-font-medium hover:plasmo-bg-gray-700 disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed"
          >
            Disconnect
          </button>
        </div>
      </div>
      
      {/* Calibration */}
      <div className="plasmo-mb-4 plasmo-p-4 plasmo-bg-white plasmo-rounded-lg plasmo-border plasmo-border-gray-200">
        <h3 className="plasmo-text-sm plasmo-font-semibold plasmo-mb-2">Calibration</h3>
        {calibrationResult && (
          <div className="plasmo-mb-3 plasmo-p-2 plasmo-bg-green-50 plasmo-border plasmo-border-green-200 plasmo-rounded plasmo-text-sm">
            <div className="plasmo-text-green-800">
              ✓ Calibrated (Accuracy: {calibrationResult.accuracy?.toFixed(2) || 'N/A'})
            </div>
          </div>
        )}
        <button
          onClick={handleStartCalibration}
          disabled={deviceStatus !== DeviceStatus.CONNECTED || isCalibrating}
          className="plasmo-w-full plasmo-px-4 plasmo-py-2 plasmo-bg-purple-600 plasmo-text-white plasmo-rounded-md plasmo-text-sm plasmo-font-medium hover:plasmo-bg-purple-700 disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed"
        >
          {isCalibrating ? 'Calibrating...' : 'Start Calibration'}
        </button>
      </div>
      
      {/* SDK Download */}
      <div className="plasmo-mb-4 plasmo-p-4 plasmo-bg-blue-50 plasmo-rounded-lg plasmo-border plasmo-border-blue-200">
        <h3 className="plasmo-text-sm plasmo-font-semibold plasmo-mb-2 plasmo-text-blue-900">Eye Tracking SDK</h3>
        <p className="plasmo-text-xs plasmo-text-blue-700 plasmo-mb-3">
          Download and install the Cogix Eye Tracking SDK to connect your eye tracker device.
        </p>
        <a
          href="https://github.com/iris-point/cogix-eye-tracking-installer/releases/download/v1.0.1/CogixEyeTracking-Setup.exe"
          target="_blank"
          rel="noopener noreferrer"
          className="plasmo-inline-flex plasmo-items-center plasmo-px-4 plasmo-py-2 plasmo-bg-blue-600 plasmo-text-white plasmo-rounded-md plasmo-text-sm plasmo-font-medium hover:plasmo-bg-blue-700 plasmo-transition-colors"
        >
          <svg className="plasmo-w-4 plasmo-h-4 plasmo-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          Download SDK Installer
        </a>
      </div>
      
      {/* Camera View */}
      <div className="plasmo-mb-4 plasmo-p-4 plasmo-bg-white plasmo-rounded-lg plasmo-border plasmo-border-gray-200">
        <h3 className="plasmo-text-sm plasmo-font-semibold plasmo-mb-2">Camera View</h3>
        <div className="plasmo-relative plasmo-w-full plasmo-h-48 plasmo-bg-gray-100 plasmo-rounded plasmo-overflow-hidden">
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
      
      {/* Calibration Container (full screen overlay when calibrating) */}
      {isCalibrating && (
        <div 
          ref={calibrationContainerRef}
          className="plasmo-fixed plasmo-inset-0 plasmo-z-50"
          style={{ backgroundColor: '#1f2937' }}
        />
      )}
    </div>
  )
}