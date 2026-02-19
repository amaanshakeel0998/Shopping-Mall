import React, { useState, useEffect } from 'react';
import { categoriesApi } from '../api/client.js';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Tag, X, Percent, Monitor } from 'lucide-react';

function Modal({ title, onClose, children, width = 420 }) {
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

function Section({ title, icon: Icon, color, children, action }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: 24 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: color + '20', borderRadius: 8, padding: 8 }}>
            <Icon size={16} color={color} />
          </div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{title}</h2>
        </div>
        {action}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [counters, setCounters] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCatModal, setShowCatModal] = useState(false);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [showDiscModal, setShowDiscModal] = useState(false);
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [saving, setSaving] = useState(false);

  const [catForm, setCatForm] = useState({ name: '', sort_order: 0 });
  const [taxForm, setTaxForm] = useState({ name: '', rate_pct: '' });
  const [discForm, setDiscForm] = useState({ name: '', type: 'percentage', value: '', valid_from: '', valid_to: '' });
  const [counterForm, setCounterForm] = useState({ counter_number: '', location: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [c, t, d, co] = await Promise.all([
        categoriesApi.list(), categoriesApi.taxRates(),
        categoriesApi.discounts(), categoriesApi.counters(),
      ]);
      setCategories(c.data || []);
      setTaxRates(t.data || []);
      setDiscounts(d.data || []);
      setCounters(co.data || []);
    } catch { toast.error('Failed to load data.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSaveCat = async (e) => {
    e.preventDefault();
    if (!catForm.name) { toast.error('Name is required.'); return; }
    setSaving(true);
    try {
      if (editingCat) {
        await categoriesApi.update(editingCat.id, catForm);
        toast.success('Category updated.');
      } else {
        await categoriesApi.create(catForm);
        toast.success('Category created.');
      }
      setShowCatModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  const handleDeleteCat = async (c) => {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    try {
      await categoriesApi.delete(c.id);
      toast.success('Category deleted.');
      load();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed.'); }
  };

  const handleSaveTax = async (e) => {
    e.preventDefault();
    if (!taxForm.name || taxForm.rate_pct === '') { toast.error('Fill all fields.'); return; }
    setSaving(true);
    try {
      await categoriesApi.createTaxRate(taxForm);
      toast.success('Tax rate created.');
      setShowTaxModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  const handleSaveDisc = async (e) => {
    e.preventDefault();
    if (!discForm.name || discForm.value === '') { toast.error('Fill all fields.'); return; }
    setSaving(true);
    try {
      await categoriesApi.createDiscount(discForm);
      toast.success('Discount created.');
      setShowDiscModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  const handleSaveCounter = async (e) => {
    e.preventDefault();
    if (!counterForm.counter_number) { toast.error('Counter number is required.'); return; }
    setSaving(true);
    try {
      await categoriesApi.createCounter(counterForm);
      toast.success('Counter created.');
      setShowCounterModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>;

  const addBtn = (label, onClick) => (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
      <Plus size={13} /> {label}
    </button>
  );

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Categories & Settings</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 2 }}>Manage product categories, tax rates, discounts, and counters</p>
      </div>

      {/* Categories */}
      <Section title="Product Categories" icon={Tag} color="#8b5cf6" action={addBtn('Add Category', () => { setEditingCat(null); setCatForm({ name: '', sort_order: 0 }); setShowCatModal(true); })}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {categories.map(c => (
            <div key={c.id} style={{ border: '1.5px solid #f1f5f9', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{c.name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.product_count} products</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => { setEditingCat(c); setCatForm({ name: c.name, sort_order: c.sort_order }); setShowCatModal(true); }}
                  style={{ padding: '4px 7px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 5, cursor: 'pointer', color: '#3b82f6' }}>
                  <Edit2 size={11} />
                </button>
                <button onClick={() => handleDeleteCat(c)}
                  style={{ padding: '4px 7px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 5, cursor: 'pointer', color: '#ef4444' }}>
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Tax Rates */}
      <Section title="Tax Rates" icon={Percent} color="#10b981" action={addBtn('Add Tax Rate', () => { setTaxForm({ name: '', rate_pct: '' }); setShowTaxModal(true); })}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {taxRates.map(t => (
            <div key={t.id} style={{ border: '1.5px solid #f1f5f9', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.name}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>{t.rate_pct}%</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Discounts */}
      <Section title="Discounts" icon={Tag} color="#f59e0b" action={addBtn('Add Discount', () => { setDiscForm({ name: '', type: 'percentage', value: '', valid_from: '', valid_to: '' }); setShowDiscModal(true); })}>
        {discounts.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: 13 }}>No discounts configured.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {discounts.map(d => (
              <div key={d.id} style={{ border: '1.5px solid #f1f5f9', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{d.name}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f59e0b' }}>
                  {d.type === 'percentage' ? `${d.value}%` : `Rs. ${d.value}`}
                </div>
                {d.valid_from && <div style={{ fontSize: 11, color: '#94a3b8' }}>{d.valid_from} → {d.valid_to || '∞'}</div>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Counters */}
      <Section title="Billing Counters" icon={Monitor} color="#3b82f6" action={addBtn('Add Counter', () => { setCounterForm({ counter_number: '', location: '' }); setShowCounterModal(true); })}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {counters.map(c => (
            <div key={c.id} style={{ border: '1.5px solid #f1f5f9', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.last_seen_at && (new Date() - new Date(c.last_seen_at)) < 120000 ? '#10b981' : '#d1d5db' }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{c.counter_number}</div>
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{c.location || 'No location set'}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                Last seen: {c.last_seen_at ? new Date(c.last_seen_at).toLocaleString('en-PK') : 'Never'}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Category Modal */}
      {showCatModal && (
        <Modal title={editingCat ? 'Edit Category' : 'Add Category'} onClose={() => setShowCatModal(false)}>
          <form onSubmit={handleSaveCat}>
            <Field label="Category Name" required>
              <input style={inp} value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="Groceries" autoFocus />
            </Field>
            <Field label="Sort Order">
              <input style={inp} type="number" value={catForm.sort_order} onChange={e => setCatForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
            </Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowCatModal(false)} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ padding: '9px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {saving ? 'Saving…' : editingCat ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Tax Modal */}
      {showTaxModal && (
        <Modal title="Add Tax Rate" onClose={() => setShowTaxModal(false)}>
          <form onSubmit={handleSaveTax}>
            <Field label="Name" required><input style={inp} value={taxForm.name} onChange={e => setTaxForm(f => ({ ...f, name: e.target.value }))} placeholder="GST 18%" autoFocus /></Field>
            <Field label="Rate (%)" required><input style={inp} type="number" step="0.01" min="0" max="100" value={taxForm.rate_pct} onChange={e => setTaxForm(f => ({ ...f, rate_pct: e.target.value }))} placeholder="18" /></Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowTaxModal(false)} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ padding: '9px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{saving ? 'Saving…' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Discount Modal */}
      {showDiscModal && (
        <Modal title="Add Discount" onClose={() => setShowDiscModal(false)}>
          <form onSubmit={handleSaveDisc}>
            <Field label="Name" required><input style={inp} value={discForm.name} onChange={e => setDiscForm(f => ({ ...f, name: e.target.value }))} placeholder="Summer Sale" autoFocus /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Field label="Type">
                <select style={inp} value={discForm.type} onChange={e => setDiscForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="flat">Flat Amount (Rs.)</option>
                </select>
              </Field>
              <Field label="Value" required><input style={inp} type="number" step="0.01" min="0" value={discForm.value} onChange={e => setDiscForm(f => ({ ...f, value: e.target.value }))} placeholder="10" /></Field>
              <Field label="Valid From"><input style={inp} type="date" value={discForm.valid_from} onChange={e => setDiscForm(f => ({ ...f, valid_from: e.target.value }))} /></Field>
              <Field label="Valid To"><input style={inp} type="date" value={discForm.valid_to} onChange={e => setDiscForm(f => ({ ...f, valid_to: e.target.value }))} /></Field>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowDiscModal(false)} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ padding: '9px 20px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{saving ? 'Saving…' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Counter Modal */}
      {showCounterModal && (
        <Modal title="Add Counter" onClose={() => setShowCounterModal(false)}>
          <form onSubmit={handleSaveCounter}>
            <Field label="Counter Number" required><input style={inp} value={counterForm.counter_number} onChange={e => setCounterForm(f => ({ ...f, counter_number: e.target.value }))} placeholder="C06" autoFocus /></Field>
            <Field label="Location"><input style={inp} value={counterForm.location} onChange={e => setCounterForm(f => ({ ...f, location: e.target.value }))} placeholder="Main Entrance - Counter 6" /></Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowCounterModal(false)} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ padding: '9px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{saving ? 'Saving…' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
