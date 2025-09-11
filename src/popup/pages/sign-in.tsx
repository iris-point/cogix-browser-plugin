import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/chrome-extension'
import { useNavigate } from 'react-router-dom'

export const SignInPage = () => {
  const navigate = useNavigate()
  const { isSignedIn, isLoaded } = useAuth()
  const [isOpening, setIsOpening] = useState(false)
  
  // Check if user is already signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate('/')
    }
  }, [isLoaded, isSignedIn, navigate])
  
  const handleSignInWithWebsite = () => {
    setIsOpening(true)
    // Open the main website sign-in page in a new tab
    const syncHost = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST || 'https://cogix.app'
    chrome.tabs.create({ 
      url: `${syncHost}/sign-in?redirect_url=/projects` 
    }, () => {
      // Close the extension popup after opening the tab
      window.close()
    })
  }
  
  const handleSignUpWithWebsite = () => {
    setIsOpening(true)
    // Open the main website sign-up page in a new tab
    const syncHost = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST || 'https://cogix.app'
    chrome.tabs.create({ 
      url: `${syncHost}/sign-up?redirect_url=/projects` 
    }, () => {
      // Close the extension popup after opening the tab
      window.close()
    })
  }
  
  if (!isLoaded) {
    return (
      <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-h-full">
        <div className="plasmo-animate-pulse plasmo-text-gray-400">
          <svg className="plasmo-w-8 plasmo-h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
      </div>
    )
  }
  
  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-items-center plasmo-justify-center plasmo-min-h-[400px] plasmo-p-8">
      <div className="plasmo-w-full plasmo-max-w-sm">
        {/* Logo */}
        <div className="plasmo-flex plasmo-justify-center plasmo-mb-8">
          <div className="plasmo-w-16 plasmo-h-16 plasmo-bg-gradient-to-br plasmo-from-indigo-500 plasmo-to-purple-600 plasmo-rounded-2xl plasmo-flex plasmo-items-center plasmo-justify-center plasmo-shadow-lg">
            <svg className="plasmo-w-10 plasmo-h-10 plasmo-text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
            </svg>
          </div>
        </div>
        
        {/* Title */}
        <div className="plasmo-text-center plasmo-mb-8">
          <h2 className="plasmo-text-2xl plasmo-font-bold plasmo-text-gray-900 plasmo-mb-2">Welcome to Cogix</h2>
          <p className="plasmo-text-sm plasmo-text-gray-600">Sign in to start eye tracking</p>
        </div>
        
        {/* Sign In Options */}
        <div className="plasmo-space-y-4">
          <button
            onClick={handleSignInWithWebsite}
            disabled={isOpening}
            className="plasmo-w-full plasmo-py-3 plasmo-px-4 plasmo-bg-gradient-to-r plasmo-from-indigo-600 plasmo-to-purple-600 plasmo-text-white plasmo-font-medium plasmo-rounded-lg plasmo-shadow-md hover:plasmo-shadow-lg plasmo-transform plasmo-transition-all hover:plasmo-scale-[1.02] disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed"
          >
            {isOpening ? 'Opening...' : 'Sign in with Cogix'}
          </button>
          
          <div className="plasmo-relative">
            <div className="plasmo-absolute plasmo-inset-0 plasmo-flex plasmo-items-center">
              <div className="plasmo-w-full plasmo-border-t plasmo-border-gray-300"></div>
            </div>
            <div className="plasmo-relative plasmo-flex plasmo-justify-center plasmo-text-sm">
              <span className="plasmo-px-2 plasmo-bg-white plasmo-text-gray-500">New to Cogix?</span>
            </div>
          </div>
          
          <button
            onClick={handleSignUpWithWebsite}
            disabled={isOpening}
            className="plasmo-w-full plasmo-py-3 plasmo-px-4 plasmo-bg-white plasmo-border plasmo-border-gray-300 plasmo-text-gray-700 plasmo-font-medium plasmo-rounded-lg plasmo-shadow-sm hover:plasmo-bg-gray-50 plasmo-transform plasmo-transition-all hover:plasmo-scale-[1.02] disabled:plasmo-opacity-50 disabled:plasmo-cursor-not-allowed"
          >
            {isOpening ? 'Opening...' : 'Create an account'}
          </button>
        </div>
        
        {/* Info */}
        <div className="plasmo-mt-8 plasmo-p-4 plasmo-bg-blue-50 plasmo-rounded-lg">
          <div className="plasmo-flex plasmo-items-start plasmo-gap-2">
            <svg className="plasmo-w-5 plasmo-h-5 plasmo-text-blue-600 plasmo-mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="plasmo-text-xs plasmo-text-blue-800">
              <p className="plasmo-font-medium plasmo-mb-1">How it works:</p>
              <p>Sign in on the Cogix website and your authentication will sync automatically with this extension.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}