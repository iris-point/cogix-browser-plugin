import { Storage } from "@plasmohq/storage"

const storage = new Storage()

interface RecordingSession {
  id: string
  projectId: string
  apiToken: string
  startTime: number
  isActive: boolean
}

let currentSession: RecordingSession | null = null
let recordingTabId: number | null = null

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "startRecording":
      startRecordingSession(request.projectId)
      break
    case "stopRecording":
      stopRecordingSession()
      break
    case "openCalibration":
      openCalibrationWindow()
      break
    case "submitData":
      submitDataToWorker(request.data)
      break
    case "fetchProjects":
      fetchUserProjects().then(sendResponse)
      return true // Will respond asynchronously
  }
})

async function startRecordingSession(projectId: string) {
  try {
    // Get API token for project
    const apiToken = await getApiTokenForProject(projectId)
    if (!apiToken) {
      console.error("No API token found for project")
      return
    }

    // Create session
    currentSession = {
      id: generateSessionId(),
      projectId,
      apiToken,
      startTime: Date.now(),
      isActive: true
    }

    // Store session
    await storage.set("currentSession", currentSession)

    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab.id) {
      recordingTabId = tab.id

      // Inject content script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["contents/recorder.js"]
      })

      // Start screen recording
      chrome.tabs.sendMessage(tab.id, { 
        action: "startRecording",
        session: currentSession
      })
    }

    console.log("Recording started for project:", projectId)
  } catch (error) {
    console.error("Failed to start recording:", error)
  }
}

async function stopRecordingSession() {
  if (!currentSession || !recordingTabId) return

  try {
    // Stop recording in content script
    chrome.tabs.sendMessage(recordingTabId, { action: "stopRecording" })

    // Mark session as inactive
    currentSession.isActive = false
    await storage.set("currentSession", currentSession)

    // Submit final data
    await submitSessionEnd(currentSession)

    // Clear session
    currentSession = null
    recordingTabId = null
    await storage.remove("currentSession")

    console.log("Recording stopped")
  } catch (error) {
    console.error("Failed to stop recording:", error)
  }
}

async function openCalibrationWindow() {
  // Create new window for calibration
  chrome.windows.create({
    url: chrome.runtime.getURL("tabs/calibration.html"),
    type: "popup",
    width: 1200,
    height: 800
  })
}

async function getApiTokenForProject(projectId: string): Promise<string | null> {
  const result = await storage.get(`apiToken_${projectId}`)
  return result as string | null
}

async function fetchUserProjects() {
  try {
    // Get Clerk token
    const cookies = await chrome.cookies.getAll({ 
      domain: new URL(process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST || "").hostname 
    })
    
    const sessionCookie = cookies.find(c => c.name === "__session")
    if (!sessionCookie) {
      throw new Error("No session found")
    }

    // Fetch projects from frontend
    const response = await fetch(`${process.env.PLASMO_PUBLIC_FRONTEND_URL}/api/projects`, {
      headers: {
        "Cookie": `__session=${sessionCookie.value}`
      }
    })

    if (!response.ok) {
      throw new Error("Failed to fetch projects")
    }

    const projects = await response.json()
    
    // Store projects
    await storage.set("projects", projects)
    
    return projects
  } catch (error) {
    console.error("Failed to fetch projects:", error)
    return []
  }
}

async function submitDataToWorker(data: any) {
  if (!currentSession) return

  try {
    const response = await fetch(`${process.env.PLASMO_PUBLIC_DATA_IO_URL}/api/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentSession.apiToken}`
      },
      body: JSON.stringify({
        sessionId: currentSession.id,
        projectId: currentSession.projectId,
        timestamp: Date.now(),
        data
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to submit data: ${response.statusText}`)
    }

    console.log("Data submitted successfully")
  } catch (error) {
    console.error("Failed to submit data:", error)
    // Queue for retry
    await queueDataForRetry(data)
  }
}

async function submitSessionEnd(session: RecordingSession) {
  try {
    const response = await fetch(`${process.env.PLASMO_PUBLIC_DATA_IO_URL}/api/session/end`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.apiToken}`
      },
      body: JSON.stringify({
        sessionId: session.id,
        projectId: session.projectId,
        endTime: Date.now(),
        duration: Date.now() - session.startTime
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to end session: ${response.statusText}`)
    }

    console.log("Session ended successfully")
  } catch (error) {
    console.error("Failed to end session:", error)
  }
}

async function queueDataForRetry(data: any) {
  // Get existing queue
  const queue = (await storage.get("dataQueue")) || []
  queue.push({
    data,
    timestamp: Date.now(),
    session: currentSession
  })
  await storage.set("dataQueue", queue)
}

// Retry queued data periodically
setInterval(async () => {
  const queue = await storage.get("dataQueue")
  if (!queue || queue.length === 0) return

  const newQueue = []
  for (const item of queue) {
    try {
      await submitDataToWorker(item.data)
    } catch {
      newQueue.push(item) // Keep for next retry
    }
  }

  await storage.set("dataQueue", newQueue)
}, 30000) // Every 30 seconds

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}