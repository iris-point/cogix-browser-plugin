import { useUser } from '@clerk/chrome-extension'

export const SDKPage = () => {
  const { user } = useUser()
  
  return (
    <div className="plasmo-p-4 plasmo-h-full plasmo-overflow-y-auto">
      <h2 className="plasmo-text-xl plasmo-font-bold plasmo-mb-4 plasmo-text-[var(--foreground)]">Eye Tracking SDK</h2>
      
      {/* SDK Information */}
      <div className="plasmo-mb-6 plasmo-p-4 plasmo-bg-blue-50 plasmo-rounded-lg plasmo-border plasmo-border-blue-200">
        <h3 className="plasmo-text-lg plasmo-font-semibold plasmo-mb-3 plasmo-text-blue-900">Cogix Eye Tracking SDK</h3>
        <p className="plasmo-text-sm plasmo-text-blue-800 plasmo-mb-4">
          The Cogix Eye Tracking SDK enables seamless integration between your eye tracking hardware and the browser extension. 
          This SDK is required to connect and calibrate eye tracking devices for data collection.
        </p>
        
        <div className="plasmo-bg-white plasmo-p-4 plasmo-rounded-md plasmo-border plasmo-border-blue-100 plasmo-mb-4">
          <h4 className="plasmo-text-sm plasmo-font-semibold plasmo-mb-2 plasmo-text-blue-900">System Requirements</h4>
          <ul className="plasmo-text-xs plasmo-text-blue-700 plasmo-space-y-1">
            <li>• Windows 10 or later</li>
            <li>• Compatible eye tracking hardware</li>
            <li>• Administrative privileges for installation</li>
            <li>• Chrome browser with extension installed</li>
          </ul>
        </div>
        
        <div className="plasmo-bg-white plasmo-p-4 plasmo-rounded-md plasmo-border plasmo-border-blue-100 plasmo-mb-4">
          <h4 className="plasmo-text-sm plasmo-font-semibold plasmo-mb-2 plasmo-text-blue-900">Features</h4>
          <ul className="plasmo-text-xs plasmo-text-blue-700 plasmo-space-y-1">
            <li>• Real-time eye tracking data streaming</li>
            <li>• Advanced calibration algorithms</li>
            <li>• WebSocket communication protocol</li>
            <li>• Camera feed visualization</li>
            <li>• Multi-device support</li>
          </ul>
        </div>
      </div>
      
      {/* Download Section */}
      <div className="plasmo-mb-6 plasmo-p-4 plasmo-bg-white plasmo-rounded-lg plasmo-border plasmo-border-gray-200 plasmo-shadow-sm">
        <h3 className="plasmo-text-lg plasmo-font-semibold plasmo-mb-3 plasmo-text-gray-900">Download & Installation</h3>
        
        <div className="plasmo-mb-4">
          <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-p-3 plasmo-bg-gray-50 plasmo-rounded-md plasmo-border">
            <div>
              <h4 className="plasmo-text-sm plasmo-font-medium plasmo-text-gray-900">Latest Version</h4>
              <p className="plasmo-text-xs plasmo-text-gray-600">Version 1.0.1 - Released December 2024</p>
            </div>
            <div className="plasmo-text-right">
              <span className="plasmo-text-xs plasmo-text-gray-500">Size: ~15MB</span>
            </div>
          </div>
        </div>
        
        <a
          href="https://github.com/iris-point/cogix-eye-tracking-installer/releases/download/v1.0.1/CogixEyeTracking-Setup.exe"
          target="_blank"
          rel="noopener noreferrer"
          className="plasmo-inline-flex plasmo-items-center plasmo-justify-center plasmo-w-full plasmo-px-6 plasmo-py-3 plasmo-bg-indigo-600 plasmo-text-white plasmo-rounded-md plasmo-text-sm plasmo-font-medium hover:plasmo-bg-indigo-700 plasmo-transition-colors plasmo-shadow-sm"
        >
          <svg className="plasmo-w-5 plasmo-h-5 plasmo-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          Download SDK Installer
        </a>
        
        <p className="plasmo-text-xs plasmo-text-gray-500 plasmo-mt-3 plasmo-text-center">
          By downloading, you agree to the software license terms
        </p>
      </div>
      
      {/* Installation Instructions */}
      <div className="plasmo-mb-6 plasmo-p-4 plasmo-bg-white plasmo-rounded-lg plasmo-border plasmo-border-gray-200">
        <h3 className="plasmo-text-lg plasmo-font-semibold plasmo-mb-3 plasmo-text-gray-900">Installation Instructions</h3>
        
        <div className="plasmo-space-y-4">
          <div className="plasmo-flex plasmo-items-start plasmo-gap-3">
            <div className="plasmo-flex-shrink-0 plasmo-w-6 plasmo-h-6 plasmo-bg-indigo-100 plasmo-text-indigo-600 plasmo-rounded-full plasmo-flex plasmo-items-center plasmo-justify-center plasmo-text-xs plasmo-font-semibold">
              1
            </div>
            <div>
              <h4 className="plasmo-text-sm plasmo-font-medium plasmo-text-gray-900">Download the Installer</h4>
              <p className="plasmo-text-xs plasmo-text-gray-600">Click the download button above to get the latest SDK installer.</p>
            </div>
          </div>
          
          <div className="plasmo-flex plasmo-items-start plasmo-gap-3">
            <div className="plasmo-flex-shrink-0 plasmo-w-6 plasmo-h-6 plasmo-bg-indigo-100 plasmo-text-indigo-600 plasmo-rounded-full plasmo-flex plasmo-items-center plasmo-justify-center plasmo-text-xs plasmo-font-semibold">
              2
            </div>
            <div>
              <h4 className="plasmo-text-sm plasmo-font-medium plasmo-text-gray-900">Run as Administrator</h4>
              <p className="plasmo-text-xs plasmo-text-gray-600">Right-click the installer and select "Run as administrator" for proper installation.</p>
            </div>
          </div>
          
          <div className="plasmo-flex plasmo-items-start plasmo-gap-3">
            <div className="plasmo-flex-shrink-0 plasmo-w-6 plasmo-h-6 plasmo-bg-indigo-100 plasmo-text-indigo-600 plasmo-rounded-full plasmo-flex plasmo-items-center plasmo-justify-center plasmo-text-xs plasmo-font-semibold">
              3
            </div>
            <div>
              <h4 className="plasmo-text-sm plasmo-font-medium plasmo-text-gray-900">Follow Setup Wizard</h4>
              <p className="plasmo-text-xs plasmo-text-gray-600">Complete the installation process and restart your computer if prompted.</p>
            </div>
          </div>
          
          <div className="plasmo-flex plasmo-items-start plasmo-gap-3">
            <div className="plasmo-flex-shrink-0 plasmo-w-6 plasmo-h-6 plasmo-bg-indigo-100 plasmo-text-indigo-600 plasmo-rounded-full plasmo-flex plasmo-items-center plasmo-justify-center plasmo-text-xs plasmo-font-semibold">
              4
            </div>
            <div>
              <h4 className="plasmo-text-sm plasmo-font-medium plasmo-text-gray-900">Connect Your Device</h4>
              <p className="plasmo-text-xs plasmo-text-gray-600">Return to the Eye Tracking tab to connect and calibrate your eye tracking device.</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Troubleshooting */}
      <div className="plasmo-p-4 plasmo-bg-yellow-50 plasmo-rounded-lg plasmo-border plasmo-border-yellow-200">
        <h3 className="plasmo-text-sm plasmo-font-semibold plasmo-mb-2 plasmo-text-yellow-900">Troubleshooting</h3>
        <div className="plasmo-space-y-2">
          <p className="plasmo-text-xs plasmo-text-yellow-800">
            <strong>Installation fails:</strong> Ensure you have administrator privileges and disable antivirus temporarily.
          </p>
          <p className="plasmo-text-xs plasmo-text-yellow-800">
            <strong>Connection issues:</strong> Check that the SDK service is running and firewall allows connections.
          </p>
          <p className="plasmo-text-xs plasmo-text-yellow-800">
            <strong>Device not detected:</strong> Verify your eye tracking hardware is properly connected and drivers are installed.
          </p>
        </div>
      </div>
    </div>
  )
}
