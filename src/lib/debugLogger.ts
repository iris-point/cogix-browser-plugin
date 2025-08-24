/**
 * Global Debug Logger for Cogix Extension
 * Sends debug information to the debug panel
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'success';

class DebugLogger {
  private enabled = true;

  constructor() {
    // Check if debug mode is enabled
    chrome.storage.local.get('debugMode', (result) => {
      this.enabled = result.debugMode !== false; // Default to true
    });
  }

  private sendToPanel(level: LogLevel, message: string, details?: any) {
    // Send to debug panel via postMessage
    window.postMessage({
      type: 'COGIX_DEBUG',
      action: 'log',
      data: { level, message, details }
    }, '*');
  }

  private sendStatus(status: Record<string, any>) {
    window.postMessage({
      type: 'COGIX_DEBUG',
      action: 'status',
      data: status
    }, '*');
  }

  info(message: string, details?: any) {
    if (!this.enabled) return;
    console.log(`[Cogix] ${message}`, details || '');
    this.sendToPanel('info', message, details);
  }

  warn(message: string, details?: any) {
    if (!this.enabled) return;
    console.warn(`[Cogix] ${message}`, details || '');
    this.sendToPanel('warn', message, details);
  }

  error(message: string, details?: any) {
    if (!this.enabled) return;
    console.error(`[Cogix] ${message}`, details || '');
    this.sendToPanel('error', message, details);
  }

  success(message: string, details?: any) {
    if (!this.enabled) return;
    console.log(`[Cogix] ✓ ${message}`, details || '');
    this.sendToPanel('success', message, details);
  }

  updateStatus(key: string, value: any) {
    if (!this.enabled) return;
    this.sendStatus({ [key]: value });
  }

  updateMultipleStatus(status: Record<string, any>) {
    if (!this.enabled) return;
    this.sendStatus(status);
  }

  // Log function calls with timing
  async logFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    this.info(`Calling ${name}...`);
    
    try {
      const result = await fn();
      const duration = Math.round(performance.now() - start);
      this.success(`${name} completed in ${duration}ms`);
      return result;
    } catch (error: any) {
      const duration = Math.round(performance.now() - start);
      this.error(`${name} failed after ${duration}ms`, error.message);
      throw error;
    }
  }

  // Enable/disable debug mode
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    chrome.storage.local.set({ debugMode: enabled });
  }
}

export const debugLog = new DebugLogger();