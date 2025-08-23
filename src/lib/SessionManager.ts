/**
 * Session Manager for Cogix Browser Extension
 * Syncs with NextAuth session from the Cogix website
 */

import { configManager } from './config';

interface Session {
  user: {
    id: string;
    email: string;
    name?: string;
    image?: string;
  };
  expires: string;
  accessToken?: string;
}

interface AuthCookies {
  sessionToken?: string;
  csrfToken?: string;
}

export class SessionManager {
  private static instance: SessionManager;
  private session: Session | null = null;
  private sessionCheckInterval: ReturnType<typeof setInterval> | null = null;
  private FRONTEND_URL: string = 'https://app.cogix.app';
  private API_URL: string = 'https://api.cogix.app';

  private constructor() {
    this.initializeSession();
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Initialize session by checking cookies from Cogix website
   */
  private async initializeSession() {
    // Load configuration
    const config = await configManager.init();
    this.FRONTEND_URL = config.FRONTEND_URL;
    this.API_URL = config.API_URL;
    
    // Check for existing session immediately
    await this.checkSession();

    // Set up periodic session checks (every 5 minutes)
    this.sessionCheckInterval = setInterval(() => {
      this.checkSession();
    }, 5 * 60 * 1000);
  }

  /**
   * Check session by getting cookies from Cogix website
   */
  async checkSession(): Promise<Session | null> {
    try {
      // Get cookies from the Cogix website
      const cookies = await this.getCogixCookies();
      
      if (cookies.sessionToken) {
        // Validate session with the backend
        const session = await this.validateSession(cookies.sessionToken);
        if (session) {
          this.session = session;
          await this.saveSession(session);
          return session;
        }
      }

      // No valid session found
      this.session = null;
      await this.clearSession();
      return null;
    } catch (error) {
      console.error('[SessionManager] Failed to check session:', error);
      return null;
    }
  }

  /**
   * Get cookies from Cogix website
   */
  private async getCogixCookies(): Promise<AuthCookies> {
    return new Promise((resolve) => {
      // NextAuth uses these cookie names by default
      const cookieNames = [
        'next-auth.session-token',      // Production
        '__Secure-next-auth.session-token', // Secure production
        'next-auth.csrf-token',
        '__Host-next-auth.csrf-token'
      ];

      const cookies: AuthCookies = {};

      // Get all cookies from Cogix domain
      chrome.cookies.getAll({ 
        domain: new URL(this.FRONTEND_URL).hostname 
      }, (allCookies) => {
        for (const cookie of allCookies) {
          if (cookieNames.includes(cookie.name)) {
            if (cookie.name.includes('session-token')) {
              cookies.sessionToken = cookie.value;
            } else if (cookie.name.includes('csrf-token')) {
              cookies.csrfToken = cookie.value;
            }
          }
        }
        resolve(cookies);
      });
    });
  }

  /**
   * Validate session token with backend
   */
  private async validateSession(sessionToken: string): Promise<Session | null> {
    try {
      const response = await fetch(`${this.FRONTEND_URL}/api/auth/session`, {
        method: 'GET',
        headers: {
          'Cookie': `next-auth.session-token=${sessionToken}`,
        },
        credentials: 'include'
      });

      if (response.ok) {
        const session = await response.json();
        
        // Check if session is valid and not expired
        if (session && session.user && new Date(session.expires) > new Date()) {
          return session;
        }
      }
    } catch (error) {
      console.error('[SessionManager] Failed to validate session:', error);
    }

    return null;
  }

  /**
   * Login using email and password
   * This will create a session on the Cogix website
   */
  async login(email: string, password: string): Promise<Session> {
    try {
      // Get CSRF token first
      const csrfResponse = await fetch(`${this.FRONTEND_URL}/api/auth/csrf`);
      const { csrfToken } = await csrfResponse.json();

      // Sign in using NextAuth credentials provider
      const signInResponse = await fetch(`${this.FRONTEND_URL}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email,
          password,
          csrfToken,
          callbackUrl: this.FRONTEND_URL,
          json: 'true'
        }),
        credentials: 'include'
      });

      if (signInResponse.ok) {
        const result = await signInResponse.json();
        
        if (result.url && !result.error) {
          // Login successful, now get the session
          const session = await this.checkSession();
          if (session) {
            return session;
          }
        }

        throw new Error(result.error || 'Login failed');
      }

      throw new Error('Login request failed');
    } catch (error) {
      console.error('[SessionManager] Login failed:', error);
      throw error;
    }
  }

  /**
   * Alternative login using direct backend API
   * This is used when NextAuth endpoint is not accessible
   */
  async loginDirect(email: string, password: string): Promise<Session> {
    try {
      const response = await fetch(`${this.API_URL}/api/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Create a session object from the response
        const session: Session = {
          user: {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name
          },
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
          accessToken: data.token
        };

        this.session = session;
        await this.saveSession(session);
        await this.saveAuthToken(data.token);
        
        return session;
      }

      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    } catch (error) {
      console.error('[SessionManager] Direct login failed:', error);
      throw error;
    }
  }

  /**
   * Logout - clear session from extension and website
   */
  async logout() {
    try {
      // Sign out from NextAuth
      await fetch(`${this.FRONTEND_URL}/api/auth/signout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('[SessionManager] Logout request failed:', error);
    }

    // Clear local session
    this.session = null;
    await this.clearSession();
  }

  /**
   * Get current session
   */
  async getSession(): Promise<Session | null> {
    if (this.session) {
      // Check if session is still valid
      const expires = new Date(this.session.expires);
      if (expires > new Date()) {
        return this.session;
      }
    }

    // Try to get session from cookies
    return await this.checkSession();
  }

  /**
   * Get auth token for API requests
   */
  async getAuthToken(): Promise<string | null> {
    const stored = await chrome.storage.local.get('authToken');
    if (stored.authToken) {
      return stored.authToken;
    }

    // Try to get from session
    const session = await this.getSession();
    return session?.accessToken || null;
  }

  /**
   * Save session to storage
   */
  private async saveSession(session: Session) {
    await chrome.storage.local.set({ 
      session: JSON.stringify(session),
      sessionExpires: session.expires
    });
  }

  /**
   * Save auth token separately for API calls
   */
  private async saveAuthToken(token: string) {
    await chrome.storage.local.set({ authToken: token });
  }

  /**
   * Clear session from storage
   */
  private async clearSession() {
    await chrome.storage.local.remove(['session', 'sessionExpires', 'authToken']);
  }

  /**
   * Open Cogix website in a new tab for login
   */
  async openLoginPage() {
    chrome.tabs.create({ 
      url: `${this.FRONTEND_URL}/sign-in?extension=true` 
    });
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return !!session;
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
  }
}

// Export singleton instance
export const sessionManager = SessionManager.getInstance();