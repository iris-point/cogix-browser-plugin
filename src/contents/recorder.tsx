import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false
}

interface RecordingState {
  isRecording: boolean
  sessionId: string | null
  apiToken: string | null
  eventBuffer: any[]
  lastSubmit: number
}

const state: RecordingState = {
  isRecording: false,
  sessionId: null,
  apiToken: null,
  eventBuffer: [],
  lastSubmit: Date.now()
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "startRecording":
      startRecording(message.session)
      break
    case "stopRecording":
      stopRecording()
      break
    case "getStatus":
      sendResponse({ isRecording: state.isRecording })
      break
  }
})

function startRecording(session: any) {
  state.isRecording = true
  state.sessionId = session.id
  state.apiToken = session.apiToken
  state.eventBuffer = []
  state.lastSubmit = Date.now()

  // Start event listeners
  attachEventListeners()
  
  // Start screen recording if supported
  startScreenRecording()
  
  // Start eye tracking
  startEyeTracking()

  console.log("Content script: Recording started")
}

function stopRecording() {
  state.isRecording = false
  
  // Remove event listeners
  detachEventListeners()
  
  // Stop screen recording
  stopScreenRecording()
  
  // Stop eye tracking
  stopEyeTracking()
  
  // Submit remaining data
  submitBufferedData()

  console.log("Content script: Recording stopped")
}

// Event Recording
let eventHandlers: Map<string, (e: Event) => void> = new Map()

function attachEventListeners() {
  // Click events
  const clickHandler = (e: MouseEvent) => {
    if (!state.isRecording) return
    recordEvent({
      type: "click",
      timestamp: Date.now(),
      x: e.clientX,
      y: e.clientY,
      target: getElementSelector(e.target as Element),
      button: e.button
    })
  }
  document.addEventListener("click", clickHandler, true)
  eventHandlers.set("click", clickHandler)

  // Mouse move (throttled)
  let lastMouseMove = 0
  const mouseMoveHandler = (e: MouseEvent) => {
    if (!state.isRecording) return
    const now = Date.now()
    if (now - lastMouseMove < 50) return // Throttle to 20Hz
    lastMouseMove = now
    
    recordEvent({
      type: "mousemove",
      timestamp: now,
      x: e.clientX,
      y: e.clientY
    })
  }
  document.addEventListener("mousemove", mouseMoveHandler, true)
  eventHandlers.set("mousemove", mouseMoveHandler)

  // Scroll events
  let lastScroll = 0
  const scrollHandler = () => {
    if (!state.isRecording) return
    const now = Date.now()
    if (now - lastScroll < 100) return // Throttle to 10Hz
    lastScroll = now
    
    recordEvent({
      type: "scroll",
      timestamp: now,
      scrollX: window.scrollX,
      scrollY: window.scrollY
    })
  }
  window.addEventListener("scroll", scrollHandler, true)
  eventHandlers.set("scroll", scrollHandler as any)

  // Keyboard events
  const keyHandler = (e: KeyboardEvent) => {
    if (!state.isRecording) return
    recordEvent({
      type: "keypress",
      timestamp: Date.now(),
      key: e.key,
      code: e.code,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey
    })
  }
  document.addEventListener("keydown", keyHandler, true)
  eventHandlers.set("keydown", keyHandler)
}

function detachEventListeners() {
  eventHandlers.forEach((handler, event) => {
    if (event === "scroll") {
      window.removeEventListener(event, handler as any, true)
    } else {
      document.removeEventListener(event, handler as any, true)
    }
  })
  eventHandlers.clear()
}

function recordEvent(event: any) {
  state.eventBuffer.push(event)
  
  // Submit data if buffer is large enough or enough time has passed
  const now = Date.now()
  if (state.eventBuffer.length >= 100 || now - state.lastSubmit > 5000) {
    submitBufferedData()
  }
}

function submitBufferedData() {
  if (state.eventBuffer.length === 0) return
  
  const events = [...state.eventBuffer]
  state.eventBuffer = []
  state.lastSubmit = Date.now()
  
  // Send to background for submission
  chrome.runtime.sendMessage({
    action: "submitData",
    data: {
      events,
      url: window.location.href,
      title: document.title,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    }
  })
}

// Screen Recording
let mediaRecorder: MediaRecorder | null = null
let recordedChunks: Blob[] = []

async function startScreenRecording() {
  try {
    // Request screen capture
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: "always"
      },
      audio: false
    })

    mediaRecorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9"
    })

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data)
        
        // Submit chunk
        const blob = new Blob([event.data], { type: "video/webm" })
        submitVideoChunk(blob)
      }
    }

    mediaRecorder.start(5000) // Record in 5-second chunks
    console.log("Screen recording started")
  } catch (error) {
    console.error("Failed to start screen recording:", error)
  }
}

function stopScreenRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop()
    
    // Stop all tracks
    mediaRecorder.stream.getTracks().forEach(track => track.stop())
    
    mediaRecorder = null
    recordedChunks = []
    console.log("Screen recording stopped")
  }
}

function submitVideoChunk(blob: Blob) {
  // Convert blob to base64 for transmission
  const reader = new FileReader()
  reader.onloadend = () => {
    chrome.runtime.sendMessage({
      action: "submitData",
      data: {
        screenRecording: {
          timestamp: Date.now(),
          data: reader.result,
          mimeType: "video/webm"
        }
      }
    })
  }
  reader.readAsDataURL(blob)
}

// Eye Tracking Integration
let eyeTrackingInterval: NodeJS.Timeout | null = null

function startEyeTracking() {
  // This will integrate with the core SDK
  // For now, we'll set up the structure
  eyeTrackingInterval = setInterval(() => {
    if (!state.isRecording) return
    
    // Get eye tracking data from SDK
    const eyeData = getEyeTrackingData()
    if (eyeData) {
      chrome.runtime.sendMessage({
        action: "submitData",
        data: {
          eyeTracking: eyeData
        }
      })
    }
  }, 16) // ~60Hz
}

function stopEyeTracking() {
  if (eyeTrackingInterval) {
    clearInterval(eyeTrackingInterval)
    eyeTrackingInterval = null
  }
}

function getEyeTrackingData() {
  // Placeholder - will integrate with core SDK
  return null
}

// Utility functions
function getElementSelector(element: Element): string {
  if (element.id) {
    return `#${element.id}`
  }
  
  if (element.className && typeof element.className === "string") {
    const classes = element.className.split(" ").filter(c => c)
    if (classes.length > 0) {
      return `.${classes.join(".")}`
    }
  }
  
  return element.tagName.toLowerCase()
}

// Auto-submit data periodically
setInterval(() => {
  if (state.isRecording) {
    submitBufferedData()
  }
}, 5000)