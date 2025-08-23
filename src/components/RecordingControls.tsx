import { useState, useEffect } from 'react';
import { Play, Square, Eye, Monitor, Target, Clock, Activity } from 'lucide-react';

interface RecordingControlsProps {
  projectId: string;
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function RecordingControls({ isRecording, onStart, onStop }: RecordingControlsProps) {
  const [duration, setDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [calibrated, setCalibrated] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording) {
      interval = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    // Check if eye tracker is connected
    try {
      const response = await chrome.tabs.query({ active: true, currentWindow: true });
      if (response[0]) {
        chrome.tabs.sendMessage(response[0].id!, { action: 'checkConnection' }, (response) => {
          if (response?.connected) {
            setConnectionStatus('connected');
            setCalibrated(response.calibrated || false);
          }
        });
      }
    } catch (error) {
      console.error('Failed to check connection:', error);
    }
  };

  const handleCalibrate = async () => {
    const response = await chrome.tabs.query({ active: true, currentWindow: true });
    if (response[0]) {
      chrome.tabs.sendMessage(response[0].id!, { action: 'startCalibration' });
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-600">Eye Tracker</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' : 
              connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
              'bg-gray-300'
            }`} />
            <span className="text-sm font-medium capitalize">{connectionStatus}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-600">Calibration</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${calibrated ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-sm font-medium">{calibrated ? 'Ready' : 'Required'}</span>
          </div>
        </div>
      </div>

      {/* Main Recording Button */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        {!isRecording ? (
          <div className="space-y-3">
            {!calibrated && connectionStatus === 'connected' && (
              <button
                onClick={handleCalibrate}
                className="w-full flex items-center justify-center gap-2 bg-yellow-50 text-yellow-700 py-2 px-4 rounded-lg hover:bg-yellow-100 border border-yellow-200"
              >
                <Target className="w-4 h-4" />
                Calibrate Eye Tracker
              </button>
            )}
            
            <button
              onClick={onStart}
              disabled={connectionStatus !== 'connected' || !calibrated}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-5 h-5" />
              Start Recording
            </button>

            <div className="flex items-center gap-4 text-xs text-gray-500">
              <label className="flex items-center gap-1">
                <input type="checkbox" defaultChecked className="rounded" />
                <Monitor className="w-3 h-3" />
                Screen Recording
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" defaultChecked className="rounded" />
                <Eye className="w-3 h-3" />
                Eye Tracking
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="font-medium text-gray-900">Recording...</span>
              </div>
              <div className="flex items-center gap-1 text-gray-600">
                <Clock className="w-4 h-4" />
                <span className="font-mono text-sm">{formatDuration(duration)}</span>
              </div>
            </div>

            <button
              onClick={onStop}
              className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700"
            >
              <Square className="w-5 h-5" />
              Stop Recording
            </button>

            {/* Live Stats */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t">
              <div className="text-center">
                <p className="text-xs text-gray-500">Samples</p>
                <p className="text-sm font-medium">0</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">FPS</p>
                <p className="text-sm font-medium">60</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">Quality</p>
                <p className="text-sm font-medium text-green-600">Good</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium text-gray-700">Recording Options</p>
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" className="rounded" defaultChecked />
            <span>Include page interactions</span>
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" className="rounded" defaultChecked />
            <span>Capture AOIs from HTML elements</span>
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" className="rounded" />
            <span>Real-time heatmap overlay</span>
          </label>
        </div>
      </div>
    </div>
  );
}