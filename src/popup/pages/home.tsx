import { useState, useEffect } from 'react'
import { useUser } from '@clerk/chrome-extension'
import { Storage } from '@plasmohq/storage'
import { ProjectSelector } from '../components/ProjectSelector'
import type { Project } from '../../lib/api-client'

const storage = new Storage()

export const HomePage = () => {
  const { user, isLoaded } = useUser()
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  useEffect(() => {
    // Load settings from storage
    const loadSettings = async () => {
      const recording = await storage.get('isRecording')
      setIsRecording(recording || false)
    }
    loadSettings()
  }, [])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } else {
      setRecordingTime(0)
    }
    return () => clearInterval(interval)
  }, [isRecording])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const toggleRecording = async () => {
    // Check if project is selected
    if (!selectedProject && !isRecording) {
      alert('Please select a project before recording')
      return
    }
    
    const newState = !isRecording
    setIsRecording(newState)
    await storage.set('isRecording', newState)
    
    // Send message to background script to start/stop recording
    chrome.runtime.sendMessage({
      type: 'TOGGLE_RECORDING',
      isRecording: newState,
      projectId: selectedProject?.id
    })
  }
  
  const handleProjectSelected = (project: Project) => {
    setSelectedProject(project)
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

  if (!user) {
    return (
      <div className="plasmo-flex plasmo-flex-col plasmo-items-center plasmo-justify-center plasmo-h-full plasmo-p-8">
        <div className="plasmo-w-16 plasmo-h-16 plasmo-bg-gray-100 plasmo-rounded-full plasmo-flex plasmo-items-center plasmo-justify-center plasmo-mb-4">
          <svg className="plasmo-w-8 plasmo-h-8 plasmo-text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h3 className="plasmo-text-lg plasmo-font-semibold plasmo-text-gray-900 plasmo-mb-2">Sign in Required</h3>
        <p className="plasmo-text-sm plasmo-text-gray-600 plasmo-text-center">Please sign in to start recording and tracking</p>
      </div>
    )
  }

  return (
    <div className="plasmo-relative plasmo-h-full plasmo-flex plasmo-flex-col">
      {/* Main Content Area */}
      <div className="plasmo-flex-1 plasmo-p-6">
        {/* User Welcome */}
        <div className="plasmo-mb-4">
          <div className="plasmo-flex plasmo-items-center plasmo-gap-3 plasmo-mb-4">
            <div className="plasmo-w-10 plasmo-h-10 plasmo-bg-gradient-to-br plasmo-from-[var(--primary)] plasmo-to-[var(--secondary)] plasmo-rounded-full plasmo-flex plasmo-items-center plasmo-justify-center plasmo-text-white plasmo-font-semibold">
              {user.firstName?.[0] || user.emailAddresses[0].emailAddress[0].toUpperCase()}
            </div>
            <div>
              <h2 className="plasmo-text-lg plasmo-font-semibold plasmo-text-[var(--foreground)]">
                {user.firstName || user.emailAddresses[0].emailAddress.split('@')[0]}
              </h2>
              <p className="plasmo-text-xs plasmo-text-[var(--muted)]">Ready to record</p>
            </div>
          </div>
        </div>
        
        {/* Project Selector */}
        <div className="plasmo-mb-4">
          <h3 className="plasmo-text-sm plasmo-font-medium plasmo-text-[var(--foreground)] plasmo-mb-2">Project</h3>
          <ProjectSelector onProjectSelected={handleProjectSelected} />
        </div>

        {/* Recording Status Card */}
        {isRecording && (
          <div className="plasmo-bg-red-50 plasmo-border plasmo-border-red-200 plasmo-rounded-lg plasmo-p-4 plasmo-mb-4">
            <div className="plasmo-flex plasmo-items-center plasmo-justify-between">
              <div className="plasmo-flex plasmo-items-center plasmo-gap-3">
                <div className="plasmo-relative">
                  <div className="plasmo-w-3 plasmo-h-3 plasmo-bg-red-500 plasmo-rounded-full plasmo-animate-pulse"></div>
                  <div className="plasmo-absolute plasmo-inset-0 plasmo-w-3 plasmo-h-3 plasmo-bg-red-500 plasmo-rounded-full plasmo-animate-ping"></div>
                </div>
                <span className="plasmo-text-sm plasmo-font-medium plasmo-text-red-800">Recording</span>
              </div>
              <span className="plasmo-font-mono plasmo-text-sm plasmo-text-red-700">{formatTime(recordingTime)}</span>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="plasmo-grid plasmo-grid-cols-2 plasmo-gap-3 plasmo-mb-6">
          <div className="plasmo-bg-white plasmo-border plasmo-border-gray-200 plasmo-rounded-lg plasmo-p-3">
            <div className="plasmo-text-2xl plasmo-font-bold plasmo-text-gray-900">0</div>
            <div className="plasmo-text-xs plasmo-text-gray-500">Sessions Today</div>
          </div>
          <div className="plasmo-bg-white plasmo-border plasmo-border-gray-200 plasmo-rounded-lg plasmo-p-3">
            <div className="plasmo-text-2xl plasmo-font-bold plasmo-text-gray-900">0h</div>
            <div className="plasmo-text-xs plasmo-text-gray-500">Total Time</div>
          </div>
        </div>

        {/* Recent Sessions */}
        <div>
          <h3 className="plasmo-text-sm plasmo-font-medium plasmo-text-gray-700 plasmo-mb-2">Recent Sessions</h3>
          <div className="plasmo-bg-gray-50 plasmo-rounded-lg plasmo-p-4 plasmo-text-center">
            <p className="plasmo-text-sm plasmo-text-gray-500">No sessions yet</p>
            <p className="plasmo-text-xs plasmo-text-gray-400 plasmo-mt-1">Start recording to see your sessions here</p>
          </div>
        </div>
      </div>

      {/* Floating Record Button Overlay (Loom-style) */}
      <div className="plasmo-absolute plasmo-bottom-6 plasmo-left-1/2 plasmo-transform plasmo--translate-x-1/2">
        <button
          onClick={toggleRecording}
          className={`plasmo-group plasmo-relative plasmo-w-16 plasmo-h-16 plasmo-rounded-full plasmo-shadow-xl plasmo-transition-all plasmo-duration-200 plasmo-transform hover:plasmo-scale-110 ${
            isRecording 
              ? 'plasmo-bg-red-500 hover:plasmo-bg-red-600'
              : 'plasmo-bg-gradient-to-br plasmo-from-indigo-500 plasmo-to-purple-600 hover:plasmo-from-indigo-600 hover:plasmo-to-purple-700'
          }`}
        >
          {/* Button Icon */}
          <div className="plasmo-absolute plasmo-inset-0 plasmo-flex plasmo-items-center plasmo-justify-center">
            {isRecording ? (
              // Stop icon
              <div className="plasmo-w-5 plasmo-h-5 plasmo-bg-white plasmo-rounded-sm"></div>
            ) : (
              // Record icon
              <div className="plasmo-w-6 plasmo-h-6 plasmo-bg-white plasmo-rounded-full"></div>
            )}
          </div>
          
          {/* Hover tooltip */}
          <div className="plasmo-absolute plasmo-bottom-full plasmo-left-1/2 plasmo-transform plasmo--translate-x-1/2 plasmo-mb-2 plasmo-opacity-0 group-hover:plasmo-opacity-100 plasmo-transition-opacity plasmo-pointer-events-none">
            <div className="plasmo-bg-gray-900 plasmo-text-white plasmo-text-xs plasmo-py-1 plasmo-px-2 plasmo-rounded plasmo-whitespace-nowrap">
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}