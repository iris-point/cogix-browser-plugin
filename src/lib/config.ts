/**
 * Configuration for Cogix Browser Extension
 * Supports both development and production environments
 */

export interface ExtensionConfig {
  API_URL: string;
  DATA_API_URL: string;
  FRONTEND_URL: string;
  IS_PRODUCTION: boolean;
}

// Environment detection - removed as not available in browser context

// Default to production URLs - can be overridden in settings
export const DEFAULT_CONFIG: ExtensionConfig = {
  API_URL: 'https://api.cogix.app',           // Production backend
  DATA_API_URL: 'https://data.cogix.app',     // Production data API
  FRONTEND_URL: 'https://www.cogix.app',      // Production frontend
  IS_PRODUCTION: true
};

// Development configuration (for local testing)
export const DEV_CONFIG: ExtensionConfig = {
  API_URL: 'http://localhost:8000',
  DATA_API_URL: 'http://localhost:8001',
  FRONTEND_URL: 'http://localhost:3000',
  IS_PRODUCTION: false
};

// Get current configuration from Chrome storage or use defaults
export async function getConfig(): Promise<ExtensionConfig> {
  try {
    const stored = await chrome.storage.local.get('extensionConfig');
    if (stored.extensionConfig) {
      return stored.extensionConfig;
    }
    
    // Check if user has set development mode
    const settings = await chrome.storage.local.get('extensionSettings');
    if (settings.extensionSettings?.useDevelopmentServers) {
      return DEV_CONFIG;
    }
    
    // Default to production
    return DEFAULT_CONFIG;
  } catch (error) {
    console.error('Failed to load config:', error);
    return DEFAULT_CONFIG;
  }
}

// Save configuration
export async function saveConfig(config: Partial<ExtensionConfig>) {
  const current = await getConfig();
  const updated = { ...current, ...config };
  await chrome.storage.local.set({ extensionConfig: updated });
  return updated;
}

// Quick toggle between production and development
export async function toggleEnvironment() {
  const current = await getConfig();
  const newConfig = current.IS_PRODUCTION ? DEV_CONFIG : DEFAULT_CONFIG;
  await saveConfig(newConfig);
  return newConfig;
}

// Get specific URLs
export async function getAPIUrl(): Promise<string> {
  const config = await getConfig();
  return config.API_URL;
}

export async function getDataAPIUrl(): Promise<string> {
  const config = await getConfig();
  return config.DATA_API_URL;
}

export async function getFrontendUrl(): Promise<string> {
  const config = await getConfig();
  return config.FRONTEND_URL;
}

// Export singleton config that can be updated
class ConfigManager {
  private config: ExtensionConfig = DEFAULT_CONFIG;
  private initialized = false;

  async init() {
    if (!this.initialized) {
      this.config = await getConfig();
      this.initialized = true;
    }
    return this.config;
  }

  get current() {
    return this.config;
  }

  async update(config: Partial<ExtensionConfig>) {
    this.config = await saveConfig(config);
    return this.config;
  }

  async useProduction() {
    return this.update(DEFAULT_CONFIG);
  }

  async useDevelopment() {
    return this.update(DEV_CONFIG);
  }
}

export const configManager = new ConfigManager();