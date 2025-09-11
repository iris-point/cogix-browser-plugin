import { ClerkProvider, SignedIn, SignedOut, UserButton } from '@clerk/chrome-extension'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { debugLog } from '../../utils/debug'

const PUBLISHABLE_KEY = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY
const SYNC_HOST = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST

debugLog('ROOT_LAYOUT', 'Environment variables', {
  PUBLISHABLE_KEY: PUBLISHABLE_KEY?.substring(0, 20) + '...',
  SYNC_HOST
});

if (!PUBLISHABLE_KEY || !SYNC_HOST) {
  throw new Error(
    'Please add the PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY and PLASMO_PUBLIC_CLERK_SYNC_HOST to the .env.development file',
  )
}

export const RootLayout = () => {
  const navigate = useNavigate()
  
  useEffect(() => {
    debugLog('ROOT_LAYOUT', 'Component mounted', {
      SYNC_HOST,
      PUBLISHABLE_KEY: PUBLISHABLE_KEY?.substring(0, 20) + '...'
    });
  }, []);

  return (
    <ClerkProvider
      routerPush={(to) => {
        debugLog('CLERK', 'Router push', { to });
        navigate(to);
      }}
      routerReplace={(to) => {
        debugLog('CLERK', 'Router replace', { to });
        navigate(to, { replace: true });
      }}
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
      afterSignInUrl="/"
      syncHost={SYNC_HOST}
    >
      <div className="plasmo-w-[380px] plasmo-h-[600px] plasmo-bg-white plasmo-flex plasmo-flex-col plasmo-overflow-hidden">
        {/* Header */}
        <header className="plasmo-bg-gradient-to-r plasmo-from-indigo-600 plasmo-to-purple-600 plasmo-text-white plasmo-p-4 plasmo-shadow-lg">
          <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
            <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
              <div className="plasmo-w-8 plasmo-h-8 plasmo-bg-white plasmo-bg-opacity-20 plasmo-rounded-lg plasmo-flex plasmo-items-center plasmo-justify-center">
                <svg className="plasmo-w-5 plasmo-h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <h1 className="plasmo-text-lg plasmo-font-bold">Cogix Eye Tracking</h1>
                <p className="plasmo-text-xs plasmo-opacity-90">Research & Analytics</p>
              </div>
            </div>
            <SignedIn>
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: "plasmo-w-8 plasmo-h-8",
                    userButtonTrigger: "plasmo-focus:plasmo-outline-none"
                  }
                }}
              />
            </SignedIn>
          </div>
        </header>
        
        {/* Main Content */}
        <main className="plasmo-flex-1 plasmo-overflow-y-auto plasmo-bg-gray-50">
          <Outlet />
        </main>
        
        {/* Footer Navigation */}
        <footer className="plasmo-bg-white plasmo-border-t plasmo-border-gray-200 plasmo-px-4 plasmo-py-3">
          <SignedIn>
            <nav className="plasmo-flex plasmo-items-center plasmo-justify-between">
              <div className="plasmo-flex plasmo-gap-1">
                <Link 
                  to="/" 
                  className="plasmo-px-3 plasmo-py-1.5 plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 hover:plasmo-text-indigo-600 hover:plasmo-bg-indigo-50 plasmo-rounded-md plasmo-transition-colors"
                >
                  Home
                </Link>
                <Link 
                  to="/settings" 
                  className="plasmo-px-3 plasmo-py-1.5 plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 hover:plasmo-text-indigo-600 hover:plasmo-bg-indigo-50 plasmo-rounded-md plasmo-transition-colors"
                >
                  Settings
                </Link>
              </div>
              <Link 
                to="/debug" 
                className="plasmo-px-2 plasmo-py-1 plasmo-text-xs plasmo-text-gray-400 hover:plasmo-text-gray-600 plasmo-transition-colors"
              >
                Debug
              </Link>
            </nav>
          </SignedIn>
          <SignedOut>
            <nav className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-gap-4">
              <Link 
                to="/" 
                className="plasmo-px-3 plasmo-py-1.5 plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 hover:plasmo-text-indigo-600 hover:plasmo-bg-indigo-50 plasmo-rounded-md plasmo-transition-colors"
              >
                Home
              </Link>
              <Link 
                to="/sign-in" 
                className="plasmo-px-3 plasmo-py-1.5 plasmo-text-sm plasmo-font-medium plasmo-text-indigo-600 hover:plasmo-bg-indigo-50 plasmo-rounded-md plasmo-transition-colors"
              >
                Sign In
              </Link>
              <Link 
                to="/sign-up" 
                className="plasmo-px-3 plasmo-py-1.5 plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 hover:plasmo-text-indigo-600 hover:plasmo-bg-indigo-50 plasmo-rounded-md plasmo-transition-colors"
              >
                Sign Up
              </Link>
            </nav>
          </SignedOut>
        </footer>
      </div>
    </ClerkProvider>
  )
}