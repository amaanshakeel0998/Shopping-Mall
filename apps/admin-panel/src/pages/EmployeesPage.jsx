import React, { useState, useEffect, useCallback } from 'react';
import { employeesApi } from '../api/client.js';
import toast from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, Users, X, Key, ChevronLeft, ChevronRight } from 'lucide-react';

function Modal({ title, onClose, children, width = 460 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

const inp = { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', background: 'white', boxSizing: 'border-box' };

function Field({ label, children, required }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pwTarget, setPwTarget] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [saving, setSaving] = useState(false);
  const LIMIT = 20;

  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'employee', phone: '', email: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await employeesApi.list({ page, limit: LIMIT, q: search });
      setEmployees(res.data);
      setTotal(res.meta.pagination.total);
    } catch { toast.error('Failed to load employees.'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ username: '', password: '', full_name: '', role: 'employee', phone: '', email: '' });
    setShowModal(true);
  };

  const openEdit = (e) => {
    setEditing(e);
    setForm({ username: e.username, password: '', full_name: e.full_name, role: e.role, phone: e.phone || '', email: e.email || '' });
    setShowModal(true);
  };

  const handleSave = async (ev) => {
    ev.preventDefault();
    if (!form.full_name || (!editing && (!form.username || !form.password))) {
      toast.error('Please fill all required fields.'); return;
    }
    setSaving(true);
    try {
      if (editing) {
        await employeesApi.update(editing.id, { full_name: form.full_name, role: form.role, phone: form.phone, email: form.email });
        toast.success('Employee updated.');
      } else {
        await employeesApi.create(form);
        toast.success('Employee created.');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Save failed.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (emp) => {
    if (!confirm(`Disable account for "${emp.full_name}"?`)) return;
    try {
      await employeesApi.delete(emp.id);
      toast.success('Employee disabled.');
      load();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed.'); }
  };

  const handleResetPw = async (e) => {
    e.preventDefault();
    if (!newPw || newPw.length < 8) { toast.error('Password must be at least 8 characters.'); return; }
    setSaving(true);
    try {
      await employeesApi.resetPassword(pwTarget.id, newPw);
      toast.success('Password reset. All sessions terminated.');
      setShowPwModal(false);
      setNewPw('');
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  const pages = Math.ceil(total / LIMIT);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Employees</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 2 }}>{total} staff members</p>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          <Plus size={16} /> Add Employee
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: 10, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input style={{ ...inp, paddingLeft: 32 }} placeholder="Search name, username, code…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading employees…</div>
        ) : employees.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
            <Users size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <div>No employees found.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                  {['Code', 'Name', 'Username', 'Role', 'Phone', 'Status', 'Last Login', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{emp.employee_code}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1e293b' }}>{emp.full_name}</td>
                    <td style={{ padding: '11px 14px', color: '#64748b' }}>{emp.username}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: emp.role === 'admin' ? '#fef3c7' : '#eff6ff', color: emp.role === 'admin' ? '#d97706' : '#3b82f6' }}>
                        {emp.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', color: '#64748b' }}>{emp.phone || '—'}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: emp.is_active ? '#ecfdf5' : '#fef2f2', color: emp.is_active ? '#059669' : '#ef4444' }}>
                        {emp.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: 12 }}>
                      {emp.last_login_at ? new Date(emp.last_login_at).toLocaleDateString('en-PK') : 'Never'}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setPwTarget(emp); setNewPw(''); setShowPwModal(true); }} title="Reset Password"
                          style={{ padding: '5px 8px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 6, cursor: 'pointer', color: '#d97706' }}>
                          <Key size={13} />
                        </button>
                        <button onClick={() => openEdit(emp)} title="Edit"
                          style={{ padding: '5px 8px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', color: '#3b82f6' }}>
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleDelete(emp)} title="Disable"
                          style={{ padding: '5px 8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', color: '#ef4444' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Page {page} of {pages}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: 'pointer' }}><ChevronLeft size={14} /></button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: 'pointer' }}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <Modal title={editing ? 'Edit Employee' : 'Add New Employee'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave}>
            <Field label="Full Name" required>
              <input style={inp} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Ahmed Ali" />
            </Field>
            {!editing && (
              <>
                <Field label="Username" required>
                  <input style={inp} value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="cashier01" />
                </Field>
                <Field label="Password" required>
                  <input style={inp} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" />
                </Field>
              </>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Field label="Role">
                <select style={inp} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>
              <Field label="Phone">
                <input style={inp} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0300-1234567" />
              </Field>
            </div>
            <Field label="Email">
              <input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="employee@mall.com" />
            </Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" onClick={() => setShowModal(false)} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ padding: '9px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {saving ? 'Saving…' : editing ? 'Update' : 'Create Employee'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showPwModal && pwTarget && (
        <Modal title={`Reset Password — ${pwTarget.full_name}`} onClose={() => setShowPwModal(false)} width={380}>
          <form onSubmit={handleResetPw}>
            <Field label="New Password" required>
              <input style={inp} type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min 8 characters" autoFocus />
            </Field>
            <p style={{ fontSize: 12, color: '#f59e0b', marginBottom: 16 }}>⚠ All active sessions for this employee will be terminated.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowPwModal(false)} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ padding: '9px 20px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {saving ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
