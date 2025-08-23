/**
 * Cogix Overlay Interface - Loom-style recording setup
 */

import { useState, useEffect } from 'react';
import { 
  X, Eye, Monitor, Camera, Mic, MicOff, 
  Play, User, LogOut, Folder, CheckCircle,
  AlertCircle, ChevronDown, Target, Activity
} from 'lucide-react';

interface CogixOverlayProps {
  isAuthenticated: boolean;
  user: any;
  currentProjectId: string | null;
  onClose: () => void;
}

type RecordingMode = 'screen' | 'camera' | 'screen+camera';
type Provider = 'hh' | 'webgazer';

export function CogixOverlay({ isAuthenticated, user, currentProjectId, onClose }: CogixOverlayProps) {
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('screen');
  const [provider, setProvider] = useState<Provider>('hh');
  const [enableAudio, setEnableAudio] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  useEffect(() => {
    if (isAuthenticated) {
      loadProjects();
      checkConnection();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (currentProjectId && projects.length > 0) {
      const project = projects.find(p => p.id === currentProjectId);
      if (project) {
        setSelectedProject(project);
      }
    }
  }, [currentProjectId, projects]);

  const loadProjects = async () => {
    const response = await chrome.runtime.sendMessage({ action: 'getProjects' });
    if (response.success) {
      setProjects(response.data);
    }
  };

  const checkConnection = async () => {
    const response = await chrome.runtime.sendMessage({ action: 'checkConnection' });
    if (response?.connected) {
      setConnectionStatus('connected');
      setIsCalibrated(response.calibrated || false);
    }
  };

  const handleSelectProject = async (project: any) => {
    setSelectedProject(project);
    setShowProjectDropdown(false);
    await chrome.runtime.sendMessage({
      action: 'selectProject',
      projectId: project.id
    });
  };

  const handleStartRecording = async () => {
    if (!selectedProject) {
      alert('Please select a project first');
      return;
    }

    if (!isCalibrated && provider === 'hh') {
      // Start calibration first
      await handleCalibrate();
    }

    setIsRecording(true);
    
    // Send start recording message
    await chrome.runtime.sendMessage({
      action: 'startRecording',
      projectId: selectedProject.id,
      mode: recordingMode,
      provider,
      enableAudio
    });

    // Close overlay after starting
    setTimeout(() => {
      onClose();
    }, 500);
  };

  const handleCalibrate = async () => {
    setIsConnecting(true);
    await chrome.runtime.sendMessage({ action: 'startCalibration' });
    setIsConnecting(false);
    setIsCalibrated(true);
  };

  const handleLogin = () => {
    chrome.runtime.sendMessage({ action: 'openLoginPage' });
    onClose();
  };

  const handleLogout = async () => {
    await chrome.runtime.sendMessage({ action: 'logout' });
    onClose();
  };

  return (
    <div className="cogix-overlay-container">
      {/* Semi-transparent backdrop */}
      <div className="cogix-backdrop" onClick={onClose} />
      
      {/* Main overlay panel */}
      <div className="cogix-panel">
        {/* Header */}
        <div className="cogix-header">
          <div className="cogix-logo">
            <Eye className="w-6 h-6" />
            <span>Cogix Eye Tracking</span>
          </div>
          <button className="cogix-close-btn" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isAuthenticated ? (
          /* Login prompt */
          <div className="cogix-login-prompt">
            <div className="cogix-icon-large">
              <Eye className="w-12 h-12" />
            </div>
            <h2>Sign in to start recording</h2>
            <p>Connect your Cogix account to save eye tracking sessions</p>
            <button className="cogix-btn cogix-btn-primary" onClick={handleLogin}>
              Sign in with Cogix
            </button>
          </div>
        ) : (
          /* Recording setup */
          <div className="cogix-content">
            {/* User info */}
            <div className="cogix-user-info">
              <div className="cogix-user-avatar">
                <User className="w-4 h-4" />
              </div>
              <span>{user?.email}</span>
              <button className="cogix-logout-btn" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Project selector */}
            <div className="cogix-section">
              <label>Project</label>
              <div className="cogix-dropdown" onClick={() => setShowProjectDropdown(!showProjectDropdown)}>
                <Folder className="w-4 h-4" />
                <span>{selectedProject?.name || 'Select project...'}</span>
                <ChevronDown className="w-4 h-4" />
                
                {showProjectDropdown && (
                  <div className="cogix-dropdown-menu">
                    {projects.map(project => (
                      <div 
                        key={project.id}
                        className="cogix-dropdown-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectProject(project);
                        }}
                      >
                        <Folder className="w-4 h-4" />
                        <span>{project.name}</span>
                        {selectedProject?.id === project.id && (
                          <CheckCircle className="w-4 h-4" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recording mode selector */}
            <div className="cogix-section">
              <label>Recording Mode</label>
              <div className="cogix-mode-selector">
                <button 
                  className={`cogix-mode-btn ${recordingMode === 'screen' ? 'active' : ''}`}
                  onClick={() => setRecordingMode('screen')}
                >
                  <Monitor className="w-5 h-5" />
                  <span>Screen</span>
                </button>
                <button 
                  className={`cogix-mode-btn ${recordingMode === 'camera' ? 'active' : ''}`}
                  onClick={() => setRecordingMode('camera')}
                >
                  <Camera className="w-5 h-5" />
                  <span>Camera</span>
                </button>
                <button 
                  className={`cogix-mode-btn ${recordingMode === 'screen+camera' ? 'active' : ''}`}
                  onClick={() => setRecordingMode('screen+camera')}
                >
                  <div className="cogix-mode-combo">
                    <Monitor className="w-4 h-4" />
                    <span>+</span>
                    <Camera className="w-4 h-4" />
                  </div>
                  <span>Both</span>
                </button>
              </div>
            </div>

            {/* Eye tracking provider */}
            <div className="cogix-section">
              <label>Eye Tracking Provider</label>
              <div className="cogix-provider-selector">
                <button 
                  className={`cogix-provider-btn ${provider === 'hh' ? 'active' : ''}`}
                  onClick={() => setProvider('hh')}
                >
                  <Activity className="w-4 h-4" />
                  <span>HH Hardware</span>
                </button>
                <button 
                  className={`cogix-provider-btn ${provider === 'webgazer' ? 'active' : ''}`}
                  onClick={() => setProvider('webgazer')}
                >
                  <Camera className="w-4 h-4" />
                  <span>WebGazer</span>
                </button>
              </div>
            </div>

            {/* Status indicators */}
            <div className="cogix-status-grid">
              <div className="cogix-status-card">
                <div className={`cogix-status-dot ${connectionStatus === 'connected' ? 'connected' : connectionStatus === 'connecting' ? 'connecting' : 'disconnected'}`} />
                <span>Eye Tracker</span>
              </div>
              <div className="cogix-status-card">
                <div className={`cogix-status-dot ${isCalibrated ? 'connected' : 'disconnected'}`} />
                <span>Calibration</span>
              </div>
            </div>

            {/* Audio toggle */}
            <div className="cogix-section">
              <label className="cogix-toggle">
                <input 
                  type="checkbox" 
                  checked={enableAudio}
                  onChange={(e) => setEnableAudio(e.target.checked)}
                />
                <div className="cogix-toggle-slider" />
                <div className="cogix-toggle-label">
                  {enableAudio ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  <span>Record audio</span>
                </div>
              </label>
            </div>

            {/* Calibration button */}
            {!isCalibrated && provider === 'hh' && (
              <button 
                className="cogix-btn cogix-btn-secondary"
                onClick={handleCalibrate}
                disabled={isConnecting}
              >
                <Target className="w-4 h-4" />
                {isConnecting ? 'Calibrating...' : 'Calibrate Eye Tracker'}
              </button>
            )}

            {/* Start recording button */}
            <button 
              className="cogix-btn cogix-btn-primary cogix-btn-large"
              onClick={handleStartRecording}
              disabled={!selectedProject || (provider === 'hh' && !isCalibrated)}
            >
              <Play className="w-5 h-5" />
              Start Recording
            </button>

            {/* Warning messages */}
            {!selectedProject && (
              <div className="cogix-warning">
                <AlertCircle className="w-4 h-4" />
                <span>Please select a project before recording</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}