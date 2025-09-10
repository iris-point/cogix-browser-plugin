import { useState } from "react"
import "~style.css"

function IndexPopup() {
  const [isRecording, setIsRecording] = useState(false)

  return (
    <div className="w-96 p-4">
      <h1 className="text-xl font-bold mb-4">Cogix Eye Tracking</h1>
      
      <button
        onClick={() => setIsRecording(!isRecording)}
        className={`w-full py-2 px-4 rounded ${
          isRecording 
            ? "bg-red-500 hover:bg-red-600 text-white" 
            : "bg-green-500 hover:bg-green-600 text-white"
        }`}
      >
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>
      
      <div className="mt-4 text-sm text-gray-600">
        Status: {isRecording ? "Recording..." : "Ready"}
      </div>
    </div>
  )
}

export default IndexPopup
