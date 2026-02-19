import React, { useState, createContext, useContext } from 'react';
import { Toaster } from 'react-hot-toast';
import LoginPage from './pages/LoginPage.jsx';
import BillingPage from './pages/BillingPage.jsx';

export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      const u = localStorage.getItem('counter_user');
      const t = localStorage.getItem('counter_token');
      return u && t ? { user: JSON.parse(u), token: t } : null;
    } catch { return null; }
  });

  const login = (user, token) => {
    localStorage.setItem('counter_token', token);
    localStorage.setItem('counter_user', JSON.stringify(user));
    setSession({ user, token });
  };

  const logout = () => {
    localStorage.removeItem('counter_token');
    localStorage.removeItem('counter_user');
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, login, logout }}>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2500,
          style: { fontSize: '14px', fontWeight: 600 },
          success: { style: { background: '#0f172a', color: '#10b981', border: '1px solid #10b981' } },
          error: { style: { background: '#0f172a', color: '#ef4444', border: '1px solid #ef4444' } },
        }}
      />
      {session ? <BillingPage /> : <LoginPage />}
    </AuthContext.Provider>
  );
}
