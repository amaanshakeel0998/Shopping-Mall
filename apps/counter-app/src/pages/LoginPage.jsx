import React, { useState, useEffect } from 'react';
import { useAuth } from '../App.jsx';
import { authApi, categoriesApi } from '../api/client.js';
import toast from 'react-hot-toast';
import { ShoppingBag, Eye, EyeOff, Monitor } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', password: '', counter_id: '' });
  const [counters, setCounters] = useState([]);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    categoriesApi.counters().then(r => setCounters(r.data || [])).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) { toast.error('Enter username and password.'); return; }
    setLoading(true);
    try {
      const res = await authApi.login(form.username.trim(), form.password, form.counter_id || undefined);
      login(res.data.user, res.data.access_token);
      toast.success(`Welcome, ${res.data.user.full_name}!`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Login failed.');
    } finally { setLoading(false); }
  };

  const inp = {
    width: '100%', padding: '12px 14px', border: '1.5px solid #1e293b',
    borderRadius: 8, fontSize: 14, outline: 'none', background: '#1e293b',
    color: '#f1f5f9', boxSizing: 'border-box',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0f172a',
    }}>
      <div style={{
        background: '#1e293b', borderRadius: 16, padding: '40px 36px',
        width: '100%', maxWidth: 400, border: '1px solid #334155',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', background: '#3b82f6', borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <ShoppingBag size={32} color="white" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>Mall POS</h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>Counter Terminal — Sign In</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>USERNAME</label>
            <input style={inp} type="text" placeholder="Enter username" value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))} autoFocus autoComplete="username" />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>PASSWORD</label>
            <div style={{ position: 'relative' }}>
              <input style={{ ...inp, paddingRight: 44 }} type={showPw ? 'text' : 'password'} placeholder="••••••••"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} autoComplete="current-password" />
              <button type="button" onClick={() => setShowPw(!showPw)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
              <Monitor size={12} style={{ display: 'inline', marginRight: 4 }} />COUNTER (Optional)
            </label>
            <select style={{ ...inp, cursor: 'pointer' }} value={form.counter_id} onChange={e => setForm(f => ({ ...f, counter_id: e.target.value }))}>
              <option value="">— Select Counter —</option>
              {counters.map(c => (
                <option key={c.id} value={c.id}>{c.counter_number} — {c.location || 'No location'}</option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '13px', background: loading ? '#1d4ed8' : '#3b82f6',
            color: 'white', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.5px',
          }}>
            {loading ? 'SIGNING IN…' : 'SIGN IN'}
          </button>
        </form>
      </div>
    </div>
  );
}
