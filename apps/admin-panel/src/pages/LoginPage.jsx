import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { authApi } from '../api/client.js';
import toast from 'react-hot-toast';
import { ShoppingBag, Eye, EyeOff, Loader } from 'lucide-react';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  if (user) { navigate('/dashboard'); return null; }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      toast.error('Please enter username and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login(form.username.trim(), form.password);
      login(res.data.user, res.data.access_token);
      toast.success(`Welcome back, ${res.data.user.full_name}!`);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Login failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const inp = {
    width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0',
    borderRadius: 8, fontSize: 14, outline: 'none', background: '#f8fafc',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
    }}>
      <div style={{
        background: 'white', borderRadius: 16, padding: '40px 36px',
        width: '100%', maxWidth: 400, boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', background: '#3b82f6', borderRadius: 16,
            padding: 16, marginBottom: 16,
          }}>
            <ShoppingBag size={32} color="white" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
            Mall POS
          </h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>Admin Panel — Sign In</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Username
            </label>
            <input
              style={inp}
              type="text"
              placeholder="admin"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              autoFocus
              autoComplete="username"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inp, paddingRight: 44 }}
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
                }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px', background: loading ? '#93c5fd' : '#3b82f6',
              color: 'white', border: 'none', borderRadius: 8, fontSize: 15,
              fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.15s',
            }}
          >
            {loading && <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{
          marginTop: 24, padding: '12px 16px', background: '#f0f9ff',
          borderRadius: 8, border: '1px solid #bae6fd',
        }}>
          <p style={{ fontSize: 12, color: '#0369a1', fontWeight: 600, marginBottom: 4 }}>Default Credentials</p>
          <p style={{ fontSize: 12, color: '#0369a1' }}>Admin: <strong>admin</strong> / <strong>Admin@123</strong></p>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
