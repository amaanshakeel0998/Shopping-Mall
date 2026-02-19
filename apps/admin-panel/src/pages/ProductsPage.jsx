import React, { useState, useEffect, useCallback } from 'react';
import { productsApi, categoriesApi } from '../api/client.js';
import toast from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, Package, X, ChevronLeft, ChevronRight, BarChart2 } from 'lucide-react';

const UNITS = ['piece', 'kg', 'gram', 'litre', 'ml', 'metre', 'pack', 'box', 'bottle', 'bag', 'carton', 'loaf', 'cup'];

function Modal({ title, onClose, children, width = 520 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'white', borderRadius: 14, width: '100%', maxWidth: width,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

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

const inp = {
  width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0',
  borderRadius: 8, fontSize: 13, outline: 'none', background: 'white',
  boxSizing: 'border-box',
};

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState('true');
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [stockTarget, setStockTarget] = useState(null);
  const [stockAdj, setStockAdj] = useState('');
  const [stockReason, setStockReason] = useState('');
  const [saving, setSaving] = useState(false);
  const LIMIT = 20;

  const [form, setForm] = useState({
    barcode: '', sku: '', name: '', description: '', category_id: '',
    price: '', tax_rate_id: '', stock_quantity: 0, unit: 'piece', is_active: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productsApi.list({ page, limit: LIMIT, q: search, category: catFilter, active_only: activeOnly });
      setProducts(res.data);
      setTotal(res.meta.pagination.total);
    } catch { toast.error('Failed to load products.'); }
    finally { setLoading(false); }
  }, [page, search, catFilter, activeOnly]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([categoriesApi.list(), categoriesApi.taxRates()]).then(([c, t]) => {
      setCategories(c.data || []);
      setTaxRates(t.data || []);
    });
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ barcode: '', sku: '', name: '', description: '', category_id: categories[0]?.id || '', price: '', tax_rate_id: '', stock_quantity: 0, unit: 'piece', is_active: true });
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      barcode: p.barcode, sku: p.sku, name: p.name, description: p.description || '',
      category_id: p.category_id, price: p.price, tax_rate_id: p.tax_rate_id || '',
      stock_quantity: p.stock_quantity, unit: p.unit, is_active: p.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.barcode || !form.sku || !form.name || !form.category_id || form.price === '') {
      toast.error('Please fill all required fields.'); return;
    }
    setSaving(true);
    try {
      if (editing) {
        await productsApi.update(editing.id, form);
        toast.success('Product updated.');
      } else {
        await productsApi.create(form);
        toast.success('Product created.');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Save failed.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (p) => {
    if (!confirm(`Deactivate "${p.name}"?`)) return;
    try {
      await productsApi.delete(p.id);
      toast.success('Product deactivated.');
      load();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed.'); }
  };

  const handleStockAdjust = async (e) => {
    e.preventDefault();
    if (!stockAdj || isNaN(parseInt(stockAdj))) { toast.error('Enter a valid adjustment.'); return; }
    setSaving(true);
    try {
      await productsApi.adjustStock(stockTarget.id, parseInt(stockAdj), stockReason);
      toast.success(`Stock updated. New qty: ${stockTarget.stock_quantity + parseInt(stockAdj)}`);
      setShowStockModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed.'); }
    finally { setSaving(false); }
  };

  const pages = Math.ceil(total / LIMIT);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Products</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 2 }}>{total} products total</p>
        </div>
        <button onClick={openCreate} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
          background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8,
          cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}>
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* Filters */}
      <div style={{ background: 'white', borderRadius: 10, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            style={{ ...inp, paddingLeft: 32 }}
            placeholder="Search name, barcode, SKU…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select style={{ ...inp, flex: '0 1 180px' }} value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select style={{ ...inp, flex: '0 1 140px' }} value={activeOnly} onChange={e => { setActiveOnly(e.target.value); setPage(1); }}>
          <option value="true">Active Only</option>
          <option value="false">All Products</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading products…</div>
        ) : products.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
            <Package size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <div>No products found.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                  {['Barcode', 'SKU', 'Name', 'Category', 'Price', 'Stock', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{p.barcode}</td>
                    <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{p.sku}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 500, color: '#1e293b', maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    </td>
                    <td style={{ padding: '11px 14px', color: '#64748b' }}>{p.category_name || '—'}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#0f172a' }}>Rs. {p.price?.toFixed(2)}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{
                        fontWeight: 600,
                        color: p.stock_quantity === 0 ? '#ef4444' : p.stock_quantity <= 5 ? '#f59e0b' : '#10b981',
                      }}>
                        {p.stock_quantity} {p.unit}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: p.is_active ? '#ecfdf5' : '#fef2f2',
                        color: p.is_active ? '#059669' : '#ef4444',
                      }}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => { setStockTarget(p); setStockAdj(''); setStockReason(''); setShowStockModal(true); }}
                          title="Adjust Stock"
                          style={{ padding: '5px 8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer', color: '#16a34a' }}
                        >
                          <BarChart2 size={13} />
                        </button>
                        <button
                          onClick={() => openEdit(p)}
                          title="Edit"
                          style={{ padding: '5px 8px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', color: '#3b82f6' }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          title="Deactivate"
                          style={{ padding: '5px 8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', color: '#ef4444' }}
                        >
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

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Page {page} of {pages} ({total} total)
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', color: '#374151' }}>
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: page === pages ? 'not-allowed' : 'pointer', color: '#374151' }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal title={editing ? 'Edit Product' : 'Add New Product'} onClose={() => setShowModal(false)} width={580}>
          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Field label="Barcode" required>
                <input style={inp} value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} placeholder="8901030874543" />
              </Field>
              <Field label="SKU" required>
                <input style={inp} value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="GRO-001" />
              </Field>
            </div>
            <Field label="Product Name" required>
              <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Basmati Rice 5kg" />
            </Field>
            <Field label="Description">
              <textarea style={{ ...inp, resize: 'vertical', minHeight: 60 }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description…" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Field label="Category" required>
                <select style={inp} value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                  <option value="">Select category…</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Tax Rate">
                <select style={inp} value={form.tax_rate_id} onChange={e => setForm(f => ({ ...f, tax_rate_id: e.target.value }))}>
                  <option value="">No Tax</option>
                  {taxRates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
              <Field label="Price (Rs.)" required>
                <input style={inp} type="number" step="0.01" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" />
              </Field>
              <Field label="Stock Quantity">
                <input style={inp} type="number" min="0" value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))} />
              </Field>
              <Field label="Unit">
                <select style={inp} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select style={inp} value={form.is_active ? 'true' : 'false'} onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'true' }))}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" onClick={() => setShowModal(false)} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 13 }}>
                Cancel
              </button>
              <button type="submit" disabled={saving} style={{ padding: '9px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {saving ? 'Saving…' : editing ? 'Update Product' : 'Create Product'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Stock Adjust Modal */}
      {showStockModal && stockTarget && (
        <Modal title={`Adjust Stock — ${stockTarget.name}`} onClose={() => setShowStockModal(false)} width={400}>
          <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 8 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>Current Stock: </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{stockTarget.stock_quantity} {stockTarget.unit}</span>
          </div>
          <form onSubmit={handleStockAdjust}>
            <Field label="Adjustment (+ to add, - to remove)" required>
              <input style={inp} type="number" value={stockAdj} onChange={e => setStockAdj(e.target.value)} placeholder="+50 or -10" autoFocus />
            </Field>
            {stockAdj && !isNaN(parseInt(stockAdj)) && (
              <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f0fdf4', borderRadius: 6, fontSize: 13, color: '#16a34a' }}>
                New quantity: <strong>{stockTarget.stock_quantity + parseInt(stockAdj)} {stockTarget.unit}</strong>
              </div>
            )}
            <Field label="Reason">
              <input style={inp} value={stockReason} onChange={e => setStockReason(e.target.value)} placeholder="Restock, damage, correction…" />
            </Field>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowStockModal(false)} style={{ padding: '9px 20px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ padding: '9px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {saving ? 'Saving…' : 'Apply Adjustment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
