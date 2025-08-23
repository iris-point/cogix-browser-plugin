import React, { useState, useEffect } from 'react';
import { Eye, LogIn, LogOut, Play, Square, Settings, Folder, User, CheckCircle, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { LoginForm } from '@components/LoginForm';
import { ProjectSelector } from '@components/ProjectSelector';
import { RecordingControls } from '@components/RecordingControls';
import { useAuth } from '@lib/hooks/useAuth';
import { useRecording } from '@lib/hooks/useRecording';

export function PopupApp() {
  const { isAuthenticated, user, loading: authLoading, login, logout, checkAuthStatus } = useAuth();
  const { isRecording, startRecording, stopRecording } = useRecording();
  const [currentView, setCurrentView] = useState<'login' | 'main' | 'projects'>('main');
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [sessionSource, setSessionSource] = useState<'extension' | 'website' | null>(null);

  useEffect(() => {
    // Check authentication status on mount
    checkAuthStatus().then(result => {
      if (!result.isAuthenticated && !authLoading) {
        setCurrentView('login');
      }
      setSessionSource(result.sessionSource || null);
    });

    // Listen for session updates from background
    const handleMessage = (message: any) => {
      if (message.action === 'sessionUpdated') {
        checkAuthStatus();
        setSessionSource('website');
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [authLoading]);

  const handleOpenWebsite = () => {
    chrome.tabs.create({ url: 'http://localhost:3000/sign-in?from=extension' });
  };

  const handleRefreshSession = async () => {
    await checkAuthStatus();
  };

  // Popup is 400x600px by default
  return (
    <div className="w-[400px] h-[600px] bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary-600" />
          <h1 className="font-semibold text-gray-900">Cogix Eye Tracking</h1>
        </div>
        <div className="flex items-center gap-1">
          {isAuthenticated && sessionSource === 'website' && (
            <button
              onClick={handleRefreshSession}
              className="p-1 hover:bg-gray-100 rounded"
              title="Refresh session"
            >
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </button>
          )}
          {isAuthenticated && (
            <button
              onClick={() => chrome.runtime.openOptionsPage()}
              className="p-1 hover:bg-gray-100 rounded"
              title="Settings"
            >
              <Settings className="w-4 h-4 text-gray-600" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {authLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Checking session...</p>
            </div>
          </div>
        ) : currentView === 'login' ? (
          <div className="flex flex-col h-full">
            <LoginForm onSuccess={() => setCurrentView('main')} />
            
            {/* Alternative login option */}
            <div className="p-4 border-t bg-white">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-3">Or sign in via website</p>
                <button
                  onClick={handleOpenWebsite}
                  className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Cogix Website
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Sign in on the website and the extension will sync automatically
                </p>
              </div>
            </div>
          </div>
        ) : currentView === 'projects' ? (
          <ProjectSelector 
            onSelect={(project) => {
              setSelectedProject(project);
              setCurrentView('main');
            }}
            onBack={() => setCurrentView('main')}
          />
        ) : (
          <div className="p-4 space-y-4">
            {/* Session Source Indicator */}
            {sessionSource && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                  <span className="text-xs text-blue-800">
                    Synced with Cogix {sessionSource === 'website' ? 'website' : 'session'}
                  </span>
                </div>
                {sessionSource === 'website' && (
                  <button
                    onClick={() => chrome.tabs.create({ url: 'http://localhost:3000/dashboard' })}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Open Dashboard
                  </button>
                )}
              </div>
            )}

            {/* User Info */}
            <div className="bg-white rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user?.name || user?.email}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="Logout"
              >
                <LogOut className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Project Selection */}
            <div className="bg-white rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Current Project</label>
                <button
                  onClick={() => setCurrentView('projects')}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  Change
                </button>
              </div>
              {selectedProject ? (
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-900">{selectedProject.name}</span>
                  <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                </div>
              ) : (
                <button
                  onClick={() => setCurrentView('projects')}
                  className="w-full text-left flex items-center gap-2 p-2 border border-dashed border-gray-300 rounded-lg hover:border-primary-400 hover:bg-primary-50"
                >
                  <Folder className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Select a project...</span>
                </button>
              )}
            </div>

            {/* Recording Controls */}
            {selectedProject ? (
              <RecordingControls 
                projectId={selectedProject.id}
                isRecording={isRecording}
                onStart={startRecording}
                onStop={stopRecording}
              />
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">
                  Please select a project before starting eye tracking recording.
                </p>
              </div>
            )}

            {/* Quick Stats */}
            {selectedProject && (
              <div className="bg-white rounded-lg p-3 space-y-2">
                <h3 className="text-sm font-medium text-gray-700">Session Info</h3>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Provider:</span>
                    <span className="text-gray-900">HH Hardware</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status:</span>
                    <span className={`font-medium ${isRecording ? 'text-green-600' : 'text-gray-600'}`}>
                      {isRecording ? 'Recording' : 'Ready'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sessions Today:</span>
                    <span className="text-gray-900">0</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t px-4 py-2">
        <div className="flex items-center justify-between">
          <a 
            href="http://localhost:3000" 
            target="_blank" 
            className="text-xs text-gray-500 hover:text-primary-600"
          >
            Open Cogix Dashboard
          </a>
          <span className="text-xs text-gray-400">v1.0.0</span>
        </div>
      </footer>
    </div>
  );
}