import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await apiFetch('/auth/me');
        setUser(me);
      } catch (_) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    const me = await apiFetch('/auth/me');
    setUser(me);
    return me;
  };

  const register = async (email, password, name) => {
    await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) });
  };

  const logout = async () => {
    await apiFetch('/auth/logout', { method: 'POST' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}


