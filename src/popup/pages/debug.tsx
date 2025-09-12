import { useState, useEffect } from 'react'
import { useAuth, useUser } from '@clerk/chrome-extension'
import { getDebugLogs, clearDebugLogs, debugLog } from '../../utils/debug'
import { Link } from 'react-router-dom'

export const DebugPage = () => {
  const { isLoaded: authLoaded, userId, sessionId, getToken } = useAuth()
  const { user, isLoaded: userLoaded } = useUser()
  const [logs, setLogs] = useState<any[]>([])
  const [token, setToken] = useState<string | null>(null)
  const [extensionInfo, setExtensionInfo] = useState<any>({})

  useEffect(() => {
    loadDebugInfo();
    getAuthToken();
  }, []);

  const loadDebugInfo = async () => {
    // Get debug logs
    const debugLogs = await getDebugLogs();
    setLogs(debugLogs as any[]);
    
    // Get extension info
    const manifest = chrome.runtime.getManifest();
    setExtensionInfo({
      id: chrome.runtime.id,
      version: manifest.version,
      name: manifest.name,
      syncHost: process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST,
      publishableKey: process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY?.substring(0, 20) + '...'
    });
    
    debugLog('DEBUG_PAGE', 'Debug info loaded');
  };

  const getAuthToken = async () => {
    if (getToken) {
      try {
        const tkn = await getToken();
        setToken(tkn);
        debugLog('DEBUG_PAGE', 'Token retrieved', { hasToken: !!tkn });
      } catch (error) {
        debugLog('DEBUG_PAGE', 'Error getting token', error);
      }
    }
  };

  const handleClearLogs = () => {
    clearDebugLogs();
    setLogs([]);
  };

  const handleTestAuth = async () => {
    debugLog('DEBUG_PAGE', 'Testing authentication');
    
    // Send message to background script
    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' }, (response) => {
      debugLog('DEBUG_PAGE', 'Auth status response', response);
    });
  };

  const handleSyncToken = async () => {
    try {
      debugLog('DEBUG_PAGE', 'Syncing token to storage');
      const token = await getToken();
      
      if (token) {
        await chrome.storage.sync.set({ clerkToken: token });
        await chrome.storage.local.set({ clerkToken: token });
        debugLog('DEBUG_PAGE', 'Token synced to storage', { tokenLength: token.length });
        
        // Refresh debug info
        loadDebugInfo();
        getAuthToken();
      } else {
        debugLog('DEBUG_PAGE', 'No token to sync');
      }
    } catch (error) {
      debugLog('DEBUG_PAGE', 'Token sync failed', error);
    }
  };

  return (
    <div className="plasmo-p-4 plasmo-space-y-4 plasmo-h-[500px] plasmo-overflow-y-auto">
      <h2 className="plasmo-text-lg plasmo-font-bold">Debug Information</h2>
      
      {/* Extension Info */}
      <div className="plasmo-bg-gray-100 plasmo-p-3 plasmo-rounded">
        <h3 className="plasmo-font-semibold plasmo-mb-2">Extension</h3>
        <div className="plasmo-text-xs plasmo-space-y-1">
          <div>ID: {extensionInfo.id}</div>
          <div>Version: {extensionInfo.version}</div>
          <div>Sync Host: {extensionInfo.syncHost}</div>
        </div>
      </div>
      
      {/* Auth Status */}
      <div className="plasmo-bg-blue-50 plasmo-p-3 plasmo-rounded">
        <h3 className="plasmo-font-semibold plasmo-mb-2">Authentication</h3>
        <div className="plasmo-text-xs plasmo-space-y-1">
          <div>Auth Loaded: {authLoaded ? '✅' : '⏳'}</div>
          <div>User Loaded: {userLoaded ? '✅' : '⏳'}</div>
          <div>User ID: {userId || 'Not signed in'}</div>
          <div>Session ID: {sessionId || 'None'}</div>
          <div>Email: {user?.emailAddresses?.[0]?.emailAddress || 'None'}</div>
          <div>Token: {token ? `${token.substring(0, 20)}...` : 'None'}</div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="plasmo-flex plasmo-gap-2 plasmo-flex-wrap">
        <button
          onClick={handleTestAuth}
          className="plasmo-px-3 plasmo-py-1 plasmo-bg-blue-500 plasmo-text-white plasmo-rounded plasmo-text-sm"
        >
          Test Auth
        </button>
        <button
          onClick={loadDebugInfo}
          className="plasmo-px-3 plasmo-py-1 plasmo-bg-green-500 plasmo-text-white plasmo-rounded plasmo-text-sm"
        >
          Refresh
        </button>
        <button
          onClick={handleSyncToken}
          className="plasmo-px-3 plasmo-py-1 plasmo-bg-purple-500 plasmo-text-white plasmo-rounded plasmo-text-sm"
        >
          Sync Token
        </button>
        <button
          onClick={handleClearLogs}
          className="plasmo-px-3 plasmo-py-1 plasmo-bg-red-500 plasmo-text-white plasmo-rounded plasmo-text-sm"
        >
          Clear Logs
        </button>
        <Link
          to="/test-connection"
          className="plasmo-px-3 plasmo-py-1 plasmo-bg-orange-500 plasmo-text-white plasmo-rounded plasmo-text-sm plasmo-inline-block"
        >
          Test Connection
        </Link>
      </div>
      
      {/* Debug Logs */}
      <div className="plasmo-bg-gray-900 plasmo-text-green-400 plasmo-p-3 plasmo-rounded">
        <h3 className="plasmo-font-semibold plasmo-mb-2">Debug Logs ({logs.length})</h3>
        <div className="plasmo-text-xs plasmo-font-mono plasmo-space-y-1 plasmo-max-h-48 plasmo-overflow-y-auto">
          {logs.length === 0 ? (
            <div className="plasmo-text-gray-500">No logs yet...</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="plasmo-border-b plasmo-border-gray-700 plasmo-pb-1">
                <div className="plasmo-text-gray-400">{log.timestamp}</div>
                <div>
                  <span className="plasmo-text-yellow-400">[{log.category}]</span> {log.message}
                </div>
                {log.data && (
                  <div className="plasmo-text-gray-300 plasmo-ml-4">{log.data}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}