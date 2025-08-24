/**
 * Debug Panel for Cogix Extension
 * Shows real-time status and logs for troubleshooting
 */

import { useState, useEffect, useRef } from 'react';
import { Bug, ChevronDown, ChevronUp, Circle } from 'lucide-react';

interface DebugLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: any;
}

interface DebugPanelProps {
  isVisible: boolean;
  onToggle: () => void;
}

export function CogixDebugPanel({ isVisible, onToggle }: DebugPanelProps) {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState({
    contentScript: 'loading',
    backgroundScript: 'unknown',
    sdk: 'loading',
    eyeTracker: 'disconnected',
    calibration: false,
    recording: false,
    mediaStream: false,
    permissions: 'unknown'
  });
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Add log entry
  const addLog = (level: DebugLog['level'], message: string, details?: any) => {
    const log: DebugLog = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      details
    };
    setLogs(prev => [...prev.slice(-50), log]); // Keep last 50 logs
  };

  // Listen for debug messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'COGIX_DEBUG') {
        const { action, data } = event.data;
        
        switch (action) {
          case 'log':
            addLog(data.level, data.message, data.details);
            break;
          case 'status':
            setStatus(prev => ({ ...prev, ...data }));
            break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Check initial status
    checkSystemStatus();
    
    // Periodic status check
    const interval = setInterval(checkSystemStatus, 2000);
    
    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(interval);
    };
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const checkSystemStatus = async () => {
    // Check content script
    setStatus(prev => ({ ...prev, contentScript: 'ready' }));
    
    // Check background script
    try {
      const response = await chrome.runtime.sendMessage({ action: 'ping' });
      setStatus(prev => ({ ...prev, backgroundScript: response ? 'ready' : 'error' }));
    } catch (error) {
      setStatus(prev => ({ ...prev, backgroundScript: 'error' }));
    }
    
    // Check permissions
    try {
      const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
      setStatus(prev => ({ ...prev, permissions: permissions.state }));
    } catch (error) {
      setStatus(prev => ({ ...prev, permissions: 'denied' }));
    }
    
    // Check media devices
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(d => d.kind === 'videoinput');
      if (hasCamera) {
        addLog('info', `Found ${devices.filter(d => d.kind === 'videoinput').length} camera(s)`);
      }
    } catch (error) {
      addLog('error', 'Failed to enumerate media devices');
    }
  };

  const getStatusColor = (status: string | boolean) => {
    if (typeof status === 'boolean') {
      return status ? '#10b981' : '#6b7280';
    }
    switch (status) {
      case 'ready':
      case 'connected':
      case 'granted':
      case 'loaded':
        return '#10b981';
      case 'loading':
      case 'connecting':
      case 'prompt':
        return '#f59e0b';
      case 'error':
      case 'disconnected':
      case 'denied':
      case 'failed':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getLogColor = (level: DebugLog['level']) => {
    switch (level) {
      case 'info': return '#3b82f6';
      case 'warn': return '#f59e0b';
      case 'error': return '#ef4444';
      case 'success': return '#10b981';
    }
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('info', 'Logs cleared');
  };

  const testFeatures = async () => {
    addLog('info', 'Starting feature test...');
    
    // Test screen capture API
    try {
      if (typeof navigator.mediaDevices?.getDisplayMedia !== 'undefined') {
        addLog('success', 'Screen capture API available');
      } else {
        addLog('error', 'Screen capture API not available');
      }
    } catch (error: any) {
      addLog('error', 'Screen capture test failed', error.message);
    }
    
    // Test WebGazer
    if (typeof (window as any).webgazer !== 'undefined') {
      addLog('success', 'WebGazer loaded');
    } else {
      addLog('warn', 'WebGazer not loaded');
    }
    
    // Test SDK
    if (typeof (window as any).CogixEyeTrackingSDK !== 'undefined') {
      addLog('success', 'Eye tracking SDK loaded');
    } else {
      addLog('warn', 'Eye tracking SDK not loaded');
    }
    
    // Test Chrome APIs
    if (chrome?.runtime?.id) {
      addLog('success', `Extension ID: ${chrome.runtime.id}`);
    }
  };

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="cogix-debug-toggle"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: '#1f2937',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '48px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 999997,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}
      >
        <Bug className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="cogix-debug-panel" style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '400px',
      maxHeight: isExpanded ? '600px' : '300px',
      background: '#1f2937',
      borderRadius: '12px',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
      zIndex: 999997,
      display: 'flex',
      flexDirection: 'column',
      transition: 'max-height 0.3s ease',
      fontFamily: 'monospace',
      fontSize: '12px',
      color: 'white'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #374151',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bug className="w-4 h-4" />
          <span style={{ fontWeight: 'bold' }}>Debug Panel</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            onClick={onToggle}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Status Grid */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #374151',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px'
      }}>
        {Object.entries(status).map(([key, value]) => (
          <div key={key} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Circle 
              className="w-2 h-2" 
              fill={getStatusColor(value)}
              style={{ color: getStatusColor(value) }}
            />
            <span style={{ opacity: 0.7 }}>{key}:</span>
            <span style={{ color: getStatusColor(value) }}>
              {typeof value === 'boolean' ? (value ? 'yes' : 'no') : value}
            </span>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid #374151',
        display: 'flex',
        gap: '8px'
      }}>
        <button
          onClick={testFeatures}
          style={{
            flex: 1,
            padding: '6px 12px',
            background: '#3b82f6',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          Test Features
        </button>
        <button
          onClick={clearLogs}
          style={{
            flex: 1,
            padding: '6px 12px',
            background: '#6b7280',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          Clear Logs
        </button>
      </div>

      {/* Logs */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '12px 16px'
      }}>
        {logs.length === 0 ? (
          <div style={{ opacity: 0.5, textAlign: 'center', padding: '20px' }}>
            No logs yet. Actions will appear here.
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} style={{
              marginBottom: '8px',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start'
            }}>
              <span style={{ opacity: 0.5 }}>{log.timestamp}</span>
              <span style={{ 
                color: getLogColor(log.level),
                fontWeight: 'bold',
                textTransform: 'uppercase',
                fontSize: '10px'
              }}>
                {log.level}
              </span>
              <span style={{ flex: 1, wordBreak: 'break-word' }}>
                {log.message}
                {log.details && (
                  <pre style={{ 
                    margin: '4px 0 0 0',
                    opacity: 0.7,
                    fontSize: '10px',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}