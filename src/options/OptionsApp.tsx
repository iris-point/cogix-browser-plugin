import React, { useState, useEffect } from 'react';
import { Eye, Settings, Save, RefreshCw, Monitor, Camera, Server } from 'lucide-react';

interface ExtensionSettings {
  defaultProvider: 'hh' | 'webgazer';
  autoCalibrate: boolean;
  showFloatingButton: boolean;
  recordScreenByDefault: boolean;
  captureAOIs: boolean;
  showRealtimeHeatmap: boolean;
  useDevelopmentServers?: boolean;
  apiUrl?: string;
  dataApiUrl?: string;
}

export function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings>({
    defaultProvider: 'hh',
    autoCalibrate: true,
    showFloatingButton: true,
    recordScreenByDefault: true,
    captureAOIs: true,
    showRealtimeHeatmap: false
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load saved settings
    chrome.storage.local.get('extensionSettings', (data) => {
      if (data.extensionSettings) {
        setSettings(data.extensionSettings);
      }
    });
  }, []);

  const handleSave = async () => {
    await chrome.storage.local.set({ extensionSettings: settings });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    const defaults: ExtensionSettings = {
      defaultProvider: 'hh',
      autoCalibrate: true,
      showFloatingButton: true,
      recordScreenByDefault: true,
      captureAOIs: true,
      showRealtimeHeatmap: false
    };
    setSettings(defaults);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3">
            <Eye className="w-8 h-8 text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Cogix Eye Tracking Settings</h1>
              <p className="text-gray-600">Configure your eye tracking extension preferences</p>
            </div>
          </div>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* Eye Tracking Provider */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Camera className="w-5 h-5 text-gray-600" />
              Eye Tracking Provider
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Provider
                </label>
                <select
                  value={settings.defaultProvider}
                  onChange={(e) => setSettings({ ...settings, defaultProvider: e.target.value as 'hh' | 'webgazer' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="hh">HH Hardware Tracker</option>
                  <option value="webgazer">WebGazer (Webcam)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Choose your preferred eye tracking provider
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Auto-calibrate on start</label>
                  <p className="text-xs text-gray-500">Automatically start calibration when connecting</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoCalibrate}
                    onChange={(e) => setSettings({ ...settings, autoCalibrate: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Recording Options */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Monitor className="w-5 h-5 text-gray-600" />
              Recording Options
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Show floating button</label>
                  <p className="text-xs text-gray-500">Display recording button on all pages</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showFloatingButton}
                    onChange={(e) => setSettings({ ...settings, showFloatingButton: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Record screen by default</label>
                  <p className="text-xs text-gray-500">Include screen recording with eye tracking</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.recordScreenByDefault}
                    onChange={(e) => setSettings({ ...settings, recordScreenByDefault: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Capture AOIs from HTML</label>
                  <p className="text-xs text-gray-500">Automatically detect areas of interest from page elements</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.captureAOIs}
                    onChange={(e) => setSettings({ ...settings, captureAOIs: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Show real-time heatmap</label>
                  <p className="text-xs text-gray-500">Display live heatmap overlay while recording</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showRealtimeHeatmap}
                    onChange={(e) => setSettings({ ...settings, showRealtimeHeatmap: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-gray-600" />
              Advanced Settings
            </h2>
            <div className="space-y-4">
              {/* Environment Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Server Environment
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="environment"
                      checked={!settings.useDevelopmentServers}
                      onChange={() => setSettings({ ...settings, useDevelopmentServers: false })}
                      className="mr-2"
                    />
                    <div>
                      <span className="text-sm font-medium">Production</span>
                      <p className="text-xs text-gray-500">api.cogix.app (Recommended)</p>
                    </div>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="environment"
                      checked={settings.useDevelopmentServers || false}
                      onChange={() => setSettings({ ...settings, useDevelopmentServers: true })}
                      className="mr-2"
                    />
                    <div>
                      <span className="text-sm font-medium">Development</span>
                      <p className="text-xs text-gray-500">localhost (For testing)</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Custom URLs (only show in development mode) */}
              {settings.useDevelopmentServers && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API URL
                    </label>
                    <input
                      type="text"
                      value={settings.apiUrl || 'http://localhost:8000'}
                      onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
                      placeholder="http://localhost:8000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data API URL
                    </label>
                    <input
                      type="text"
                      value={settings.dataApiUrl || 'http://localhost:8001'}
                      onChange={(e) => setSettings({ ...settings, dataApiUrl: e.target.value })}
                      placeholder="http://localhost:8001"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </>
              )}

              {/* Current Status */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600">
                  Currently using: <strong>{settings.useDevelopmentServers ? 'Development' : 'Production'}</strong> servers
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {settings.useDevelopmentServers 
                    ? 'Connected to local development environment'
                    : 'Connected to production Cogix servers'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center mt-8">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}