import { useState, useEffect, useRef } from "react"
import { CalibrationUI } from "@iris-point/eye-tracking-core"
import { eyeTrackingManager } from "~src/lib/eye-tracking"
import "../../style.css"

function CalibrationPage() {
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [provider, setProvider] = useState<"webgazer" | "hardware">("webgazer")
  const [calibrationComplete, setCalibrationComplete] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const calibrationUIRef = useRef<CalibrationUI | null>(null)

  useEffect(() => {
    // Request fullscreen on mount
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn("Could not enter fullscreen:", err)
      })
    }

    // Exit fullscreen on unmount
    return () => {
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen()
      }
    }
  }, [])

  const handleStartCalibration = async () => {
    try {
      // Initialize eye tracking
      await eyeTrackingManager.initialize({ provider })
      
      // Create calibration UI
      if (canvasRef.current && eyeTrackingManager.sdk) {
        calibrationUIRef.current = new CalibrationUI(eyeTrackingManager.sdk, {
          canvas: canvasRef.current,
          pointDuration: 3000,
          pointSize: 20,
          pointColor: '#ef4444', // Red color like spec
          backgroundColor: 'rgba(31, 41, 55, 0.98)', // Dark background
          showInstructions: true,
          instructionText: 'Follow the red dot with your eyes',
          autoFullscreen: false // We handle fullscreen ourselves
        })
        
        // Set canvas to full viewport
        canvasRef.current.width = window.innerWidth
        canvasRef.current.height = window.innerHeight
      }

      setIsCalibrating(true)
      
      // Start calibration
      await eyeTrackingManager.sdk?.startCalibration()
      
      // Listen for calibration completion
      eyeTrackingManager.sdk?.on('calibrationComplete', (result) => {
        setIsCalibrating(false)
        setCalibrationComplete(true)
        
        // Store calibration
        chrome.storage.local.set({ 
          calibration: result,
          calibrationProvider: provider 
        })
        
        // Show success message
        setTimeout(() => {
          alert("Calibration complete! You can now close this window.")
          window.close()
        }, 1500)
      })
      
      // Listen for calibration failure
      eyeTrackingManager.sdk?.on('calibrationFailed', (error) => {
        setIsCalibrating(false)
        alert("Calibration failed. Please try again.")
        console.error("Calibration failed:", error)
      })
      
    } catch (error) {
      console.error("Failed to start calibration:", error)
      alert("Failed to initialize eye tracking. Please check your camera permissions.")
      setIsCalibrating(false)
    }
  }

  const handleSkipCalibration = () => {
    if (confirm("Are you sure you want to skip calibration? Eye tracking accuracy may be reduced.")) {
      window.close()
    }
  }

  return (
    <div className="w-screen h-screen bg-gray-900 relative overflow-hidden">
      {/* Canvas for calibration UI */}
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 z-10"
        style={{ display: isCalibrating ? 'block' : 'none' }}
      />
      
      {/* Setup screen */}
      {!isCalibrating && !calibrationComplete && (
        <div className="flex flex-col items-center justify-center h-full relative z-20">
          <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-md border border-gray-700">
            <h1 className="text-3xl font-bold mb-6 text-white">Eye Tracking Calibration</h1>
            <p className="mb-6 text-gray-300">
              For best accuracy, please:
            </p>
            <ul className="list-disc list-inside mb-6 text-gray-300 space-y-2">
              <li>Position yourself comfortably in front of the screen</li>
              <li>Keep your head relatively still during calibration</li>
              <li>Follow the red dot with your eyes only</li>
              <li>Ensure good lighting on your face</li>
            </ul>
            
            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-4">
                <input 
                  type="radio" 
                  id="webcam" 
                  name="provider"
                  value="webgazer"
                  checked={provider === "webgazer"}
                  onChange={() => setProvider("webgazer")}
                  className="w-4 h-4"
                />
                <label htmlFor="webcam" className="text-gray-300">
                  Use webcam for eye tracking (WebGazer)
                </label>
              </div>
              <div className="flex items-center gap-4">
                <input 
                  type="radio" 
                  id="hardware" 
                  name="provider"
                  value="hardware"
                  checked={provider === "hardware"}
                  onChange={() => setProvider("hardware")}
                  className="w-4 h-4"
                />
                <label htmlFor="hardware" className="text-gray-300">
                  Use hardware eye tracker
                </label>
              </div>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={handleStartCalibration}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition-colors"
              >
                Start Calibration
              </button>
              <button
                onClick={handleSkipCalibration}
                className="px-6 py-3 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
          
          {/* Exit fullscreen hint */}
          <p className="absolute bottom-4 text-gray-500 text-sm">
            Press ESC to exit fullscreen
          </p>
        </div>
      )}
      
      {/* Success screen */}
      {calibrationComplete && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Calibration Complete!</h2>
            <p className="text-gray-300">Eye tracking is now configured.</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default CalibrationPage