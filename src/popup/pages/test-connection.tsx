import { useState } from 'react'

export const TestConnectionPage = () => {
  const [status, setStatus] = useState('Not connected')
  const [logs, setLogs] = useState<string[]>([])
  const [ws, setWs] = useState<WebSocket | null>(null)
  
  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
    console.log(`[TestConnection] ${message}`)
  }
  
  const testDirectConnection = () => {
    addLog('Starting direct WebSocket test...')
    setStatus('Connecting...')
    
    const urls = ['wss://127.0.0.1:8443', 'ws://127.0.0.1:9000', 'ws://localhost:9000']
    let connected = false
    
    urls.forEach((url, index) => {
      if (connected) return
      
      setTimeout(() => {
        if (connected) return
        
        addLog(`Trying ${url}...`)
        
        try {
          const websocket = new WebSocket(url)
          
          websocket.onopen = () => {
            connected = true
            addLog(`✅ SUCCESS! Connected to ${url}`)
            setStatus(`Connected to ${url}`)
            setWs(websocket)
            
            // Test sending a command
            const testCommand = {
              req_cmd: "getCurrTimeStamp"
            }
            websocket.send(JSON.stringify(testCommand))
            addLog(`Sent test command: ${JSON.stringify(testCommand)}`)
          }
          
          websocket.onmessage = (event) => {
            addLog(`Received message: ${event.data.substring(0, 100)}...`)
          }
          
          websocket.onerror = (event) => {
            addLog(`❌ Error on ${url}: WebSocket error occurred`)
          }
          
          websocket.onclose = (event) => {
            addLog(`Connection to ${url} closed: code=${event.code}, reason=${event.reason}`)
            if (!connected) {
              setStatus('Connection failed')
            }
          }
          
          // Timeout after 3 seconds
          setTimeout(() => {
            if (websocket.readyState === WebSocket.CONNECTING) {
              addLog(`Timeout on ${url} - closing`)
              websocket.close()
            }
          }, 3000)
          
        } catch (error: any) {
          addLog(`❌ Exception on ${url}: ${error.message}`)
        }
      }, index * 1000) // Try each URL with 1 second delay
    })
  }
  
  const disconnect = () => {
    if (ws) {
      ws.close()
      setWs(null)
      setStatus('Disconnected')
      addLog('Disconnected')
    }
  }
  
  const clearLogs = () => {
    setLogs([])
  }
  
  return (
    <div className="plasmo-p-4">
      <h2 className="plasmo-text-xl plasmo-font-bold plasmo-mb-4">Connection Test</h2>
      
      <div className="plasmo-mb-4 plasmo-p-4 plasmo-bg-white plasmo-rounded-lg plasmo-border">
        <div className="plasmo-mb-3">
          <span className="plasmo-font-semibold">Status: </span>
          <span className={status.includes('Connected') ? 'plasmo-text-green-600' : 'plasmo-text-gray-600'}>
            {status}
          </span>
        </div>
        
        <div className="plasmo-flex plasmo-gap-2">
          <button
            onClick={testDirectConnection}
            disabled={ws !== null}
            className="plasmo-px-4 plasmo-py-2 plasmo-bg-blue-600 plasmo-text-white plasmo-rounded disabled:plasmo-opacity-50"
          >
            Test Connection
          </button>
          
          <button
            onClick={disconnect}
            disabled={ws === null}
            className="plasmo-px-4 plasmo-py-2 plasmo-bg-gray-600 plasmo-text-white plasmo-rounded disabled:plasmo-opacity-50"
          >
            Disconnect
          </button>
          
          <button
            onClick={clearLogs}
            className="plasmo-px-4 plasmo-py-2 plasmo-bg-gray-400 plasmo-text-white plasmo-rounded"
          >
            Clear Logs
          </button>
        </div>
      </div>
      
      <div className="plasmo-p-4 plasmo-bg-gray-900 plasmo-rounded-lg plasmo-text-white">
        <h3 className="plasmo-font-semibold plasmo-mb-2">Connection Logs:</h3>
        <div className="plasmo-h-64 plasmo-overflow-y-auto plasmo-font-mono plasmo-text-xs">
          {logs.length === 0 ? (
            <div className="plasmo-text-gray-400">No logs yet. Click "Test Connection" to start.</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className={
                log.includes('✅') ? 'plasmo-text-green-400' :
                log.includes('❌') ? 'plasmo-text-red-400' :
                'plasmo-text-gray-300'
              }>
                {log}
              </div>
            ))
          )}
        </div>
      </div>
      
      <div className="plasmo-mt-4 plasmo-p-4 plasmo-bg-yellow-50 plasmo-rounded-lg plasmo-border plasmo-border-yellow-200">
        <h3 className="plasmo-font-semibold plasmo-text-yellow-900 plasmo-mb-2">Troubleshooting:</h3>
        <ul className="plasmo-text-sm plasmo-text-yellow-800 plasmo-space-y-1">
          <li>• Make sure the eye tracker SDK is running</li>
          <li>• Default port is 8443 (wss) or 9000 (ws)</li>
          <li>• Check if Windows Firewall is blocking the connection</li>
          <li>• Try disabling antivirus temporarily</li>
          <li>• Open browser DevTools (F12) to see detailed errors</li>
        </ul>
      </div>
    </div>
  )
}