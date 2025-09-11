import { useUser } from '@clerk/chrome-extension'
import { useState, useEffect } from 'react'
import { Storage } from '@plasmohq/storage'

const storage = new Storage()

export const SettingsPage = () => {
  const { user } = useUser()
  const [settings, setSettings] = useState({
    autoStartRecording: false,
    enableWebcam: false,
    saveToCloud: true,
    dataEndpoint: 'https://data-io.cogix.app'
  })

  useEffect(() => {
    const loadSettings = async () => {
      const saved = await storage.get('settings')
      if (saved) {
        setSettings(prev => ({ ...prev, ...saved }))
      }
    }
    loadSettings()
  }, [])

  const updateSetting = async (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    await storage.set('settings', newSettings)
  }

  return (
    <div className="plasmo-p-6 plasmo-space-y-6">
      <div>
        <h2 className="plasmo-text-xl plasmo-font-semibold plasmo-text-gray-900 plasmo-mb-1">Settings</h2>
        <p className="plasmo-text-sm plasmo-text-gray-500">Configure your recording preferences</p>
      </div>
      
      {/* Recording Settings */}
      <div className="plasmo-bg-white plasmo-border plasmo-border-gray-200 plasmo-rounded-lg plasmo-p-4">
        <h3 className="plasmo-text-sm plasmo-font-medium plasmo-text-gray-900 plasmo-mb-4">Recording Options</h3>
        <div className="plasmo-space-y-4">
          <label className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-cursor-pointer">
            <div>
              <span className="plasmo-text-sm plasmo-font-medium plasmo-text-gray-700">Auto-start Recording</span>
              <p className="plasmo-text-xs plasmo-text-gray-500 plasmo-mt-0.5">Begin recording when extension opens</p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoStartRecording}
              onChange={(e) => updateSetting('autoStartRecording', e.target.checked)}
              className="plasmo-h-4 plasmo-w-4 plasmo-text-indigo-600 plasmo-rounded plasmo-border-gray-300 focus:plasmo-ring-indigo-500"
            />
          </label>

          <label className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-cursor-pointer">
            <div>
              <span className="plasmo-text-sm plasmo-font-medium plasmo-text-gray-700">Webcam Eye Tracking</span>
              <p className="plasmo-text-xs plasmo-text-gray-500 plasmo-mt-0.5">Use webcam for eye tracking</p>
            </div>
            <input
              type="checkbox"
              checked={settings.enableWebcam}
              onChange={(e) => updateSetting('enableWebcam', e.target.checked)}
              className="plasmo-h-4 plasmo-w-4 plasmo-text-indigo-600 plasmo-rounded plasmo-border-gray-300 focus:plasmo-ring-indigo-500"
            />
          </label>

          <label className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-cursor-pointer">
            <div>
              <span className="plasmo-text-sm plasmo-font-medium plasmo-text-gray-700">Cloud Storage</span>
              <p className="plasmo-text-xs plasmo-text-gray-500 plasmo-mt-0.5">Save recordings to cloud</p>
            </div>
            <input
              type="checkbox"
              checked={settings.saveToCloud}
              onChange={(e) => updateSetting('saveToCloud', e.target.checked)}
              className="plasmo-h-4 plasmo-w-4 plasmo-text-indigo-600 plasmo-rounded plasmo-border-gray-300 focus:plasmo-ring-indigo-500"
            />
          </label>
        </div>
      </div>

      {/* API Configuration */}
      <div className="plasmo-bg-white plasmo-border plasmo-border-gray-200 plasmo-rounded-lg plasmo-p-4">
        <label className="plasmo-block">
          <span className="plasmo-text-sm plasmo-font-medium plasmo-text-gray-900 plasmo-mb-2 plasmo-block">Data Endpoint</span>
          <input
            type="text"
            value={settings.dataEndpoint}
            onChange={(e) => updateSetting('dataEndpoint', e.target.value)}
            className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md plasmo-text-sm focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-indigo-500 focus:plasmo-border-indigo-500"
            placeholder="https://data-io.cogix.app"
          />
        </label>
      </div>

      {/* Account Info */}
      <div className="plasmo-bg-gradient-to-r plasmo-from-indigo-50 plasmo-to-purple-50 plasmo-border plasmo-border-indigo-200 plasmo-rounded-lg plasmo-p-4">
        <div className="plasmo-flex plasmo-items-center plasmo-gap-3">
          <div className="plasmo-w-10 plasmo-h-10 plasmo-bg-white plasmo-rounded-full plasmo-flex plasmo-items-center plasmo-justify-center plasmo-shadow-sm">
            <svg className="plasmo-w-5 plasmo-h-5 plasmo-text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <p className="plasmo-text-sm plasmo-font-medium plasmo-text-gray-900">Account</p>
            <p className="plasmo-text-xs plasmo-text-gray-600">{user?.emailAddresses[0]?.emailAddress}</p>
          </div>
        </div>
      </div>
    </div>
  )
}