import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getAuthStatus, login as apiLogin, logout as apiLogout } from '../utils/api.js';

/**
 * Optional app login. When the server has no AUTH_PASSWORD_HASH (the default)
 * /api/auth/me says authRequired:false and nothing changes for the user.
 *
 * Without a provider (e.g. in component tests) the default value is "authed".
 */
const AuthContext = createContext({
  status: 'authed',
  authRequired: false,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAuthStatus()
      .then(({ authenticated, authRequired: required }) => {
        if (cancelled) return;
        setAuthRequired(required);
        setStatus(authenticated ? 'authed' : 'anon');
      })
      .catch(() => {
        // Server unreachable: let the app load and show its own error state.
        if (!cancelled) setStatus('authed');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      setAuthRequired(true);
      setStatus('anon');
    };
    window.addEventListener('pkg:unauthorized', onUnauthorized);
    return () => window.removeEventListener('pkg:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (password) => {
    await apiLogin(password);
    setStatus('authed');
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setStatus('anon');
    }
  }, []);

  const value = useMemo(
    () => ({ status, authRequired, login, logout }),
    [status, authRequired, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
