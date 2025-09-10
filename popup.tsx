import { useState, useEffect } from "react"
import "./style.css"

function IndexPopup() {
  const [isRecording, setIsRecording] = useState(false)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [projects, setProjects] = useState<any[]>([])

  useEffect(() => {
    // Load user projects from storage
    chrome.storage.local.get(['projects', 'selectedProjectId'], (result) => {
      if (result.projects) setProjects(result.projects)
      if (result.selectedProjectId) setSelectedProject(result.selectedProjectId)
    })
  }, [])

  const handleStartRecording = async () => {
    if (!selectedProject) {
      alert("Please select a project first")
      return
    }
    
    // Send message to background to start recording
    chrome.runtime.sendMessage({ 
      action: "startRecording", 
      projectId: selectedProject 
    })
    setIsRecording(true)
  }

  const handleStopRecording = () => {
    chrome.runtime.sendMessage({ action: "stopRecording" })
    setIsRecording(false)
  }

  const handleCalibrate = () => {
    chrome.runtime.sendMessage({ action: "openCalibration" })
  }

  return (
    <div className="w-[400px] h-[500px] p-4 bg-gray-50">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Cogix Eye Tracking</h1>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Select Project</label>
          <select 
            value={selectedProject || ""} 
            onChange={(e) => {
              setSelectedProject(e.target.value)
              chrome.storage.local.set({ selectedProjectId: e.target.value })
            }}
            className="w-full p-2 border rounded-md"
          >
            <option value="">Choose a project...</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCalibrate}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Calibrate
          </button>
        </div>

        <div className="border-t pt-4">
          {!isRecording ? (
            <button
              onClick={handleStartRecording}
              disabled={!selectedProject}
              className="w-full px-4 py-3 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-300"
            >
              Start Recording
            </button>
          ) : (
            <button
              onClick={handleStopRecording}
              className="w-full px-4 py-3 bg-red-500 text-white rounded-md hover:bg-red-600"
            >
              Stop Recording
            </button>
          )}
        </div>

        <div className="mt-4 p-3 bg-white rounded-md">
          <h3 className="font-medium mb-2">Recording Status</h3>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
            <span className="text-sm">{isRecording ? 'Recording...' : 'Not recording'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IndexPopup