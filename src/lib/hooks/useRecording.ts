import { useState, useEffect } from 'react';

export function useRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingData, setRecordingData] = useState<any>(null);

  useEffect(() => {
    checkRecordingStatus();
  }, []);

  const checkRecordingStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getRecordingStatus' });
      if (response?.success) {
        setIsRecording(response.data?.isRecording || false);
      }
    } catch (error) {
      console.error('Failed to check recording status:', error);
    }
  };

  const startRecording = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'startRecording' });
      if (response?.success) {
        setIsRecording(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to start recording:', error);
      return false;
    }
  };

  const stopRecording = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'stopRecording' });
      if (response?.success) {
        setIsRecording(false);
        setRecordingData(response.data);
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      return null;
    }
  };

  return {
    isRecording,
    recordingData,
    startRecording,
    stopRecording,
    checkRecordingStatus
  };
}