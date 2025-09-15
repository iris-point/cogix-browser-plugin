import { useEffect } from 'react'
import { useUser } from '@clerk/chrome-extension'
import { dataIOClient } from '../../lib/dataIOClient'

export function useAuthSync() {
  const { user, isSignedIn } = useUser()

  useEffect(() => {
    const syncAuth = async () => {
      console.log('Auth sync triggered, isSignedIn:', isSignedIn)
      if (isSignedIn && user) {
        try {
          // In browser extension context, we don't call getToken() to avoid
          // the Origin/Authorization header conflict. The user session is
          // already authenticated through Clerk's built-in session management.
          
          // Store user info for content script access
          await chrome.storage.sync.set({ 
            clerkUser: {
              id: user.id,
              email: user.emailAddresses[0]?.emailAddress,
              firstName: user.firstName,
              lastName: user.lastName,
              fullName: user.fullName,
              imageUrl: user.imageUrl
            },
            // Set a flag to indicate user is authenticated
            isAuthenticated: true
          })
          console.log('User info synced to storage')
          
          // Also save to local storage as backup
          await chrome.storage.local.set({ 
            clerkUser: {
              id: user.id,
              email: user.emailAddresses[0]?.emailAddress,
              firstName: user.firstName,
              lastName: user.lastName,
              fullName: user.fullName,
              imageUrl: user.imageUrl
            },
            isAuthenticated: true
          })
        } catch (error) {
          console.error('Failed to sync auth:', error)
        }
      } else {
        // Clear auth from storage when signed out
        await chrome.storage.sync.remove(['clerkUser', 'isAuthenticated', 'clerkToken'])
        await chrome.storage.local.remove(['clerkUser', 'isAuthenticated', 'clerkToken'])

        // Clear data-io token cache
        dataIOClient.clearTokenCache()

        console.log('Auth and token cache cleared from storage')
      }
    }

    syncAuth()
    
    // Also sync periodically while signed in
    const interval = isSignedIn ? setInterval(syncAuth, 30000) : null // Every 30 seconds
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isSignedIn, user])
}