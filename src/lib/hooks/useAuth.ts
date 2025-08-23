import { useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true
  });

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getAuthState' });
      if (response.success && response.data.isAuthenticated) {
        setAuthState({
          isAuthenticated: true,
          user: response.data.user,
          loading: false
        });
        return {
          isAuthenticated: true,
          sessionSource: response.data.sessionSource || 'extension'
        };
      } else {
        setAuthState({
          isAuthenticated: false,
          user: null,
          loading: false
        });
        return {
          isAuthenticated: false,
          sessionSource: null
        };
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      setAuthState(prev => ({ ...prev, loading: false }));
      return {
        isAuthenticated: false,
        sessionSource: null
      };
    }
  };

  const login = async (email: string, password: string) => {
    const response = await chrome.runtime.sendMessage({
      action: 'login',
      email,
      password
    });
    
    if (response.success) {
      setAuthState({
        isAuthenticated: true,
        user: response.data.user,
        loading: false
      });
      return response.data;
    } else {
      throw new Error(response.error);
    }
  };

  const logout = async () => {
    await chrome.runtime.sendMessage({ action: 'logout' });
    setAuthState({
      isAuthenticated: false,
      user: null,
      loading: false
    });
  };

  return {
    ...authState,
    login,
    logout,
    checkAuthStatus
  };
}