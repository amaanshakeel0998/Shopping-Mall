import React, { useState, useEffect, useCallback } from 'react';
import { billsApi } from '../api/client.js';
import toast from 'react-hot-toast';
import { Search, Receipt, X, ChevronLeft, ChevronRight, FileText, XCircle } from 'lucide-react';

function Modal({ title, onClose, children, width = 680 }) {
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

function fmt(n) { return `Rs. ${(n || 0).toFixed(2)}`; }

export default function BillsPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ from: '', to: '', status: '' });
  const [viewBill, setViewBill] = useState(null);
  const [loadingBill, setLoadingBill] = useState(false);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.status) params.status = filters.status;
      const res = await billsApi.list(params);
      setBills(res.data);
      setTotal(res.meta.pagination.total);
    } catch { toast.error('Failed to load bills.'); }
    finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  const openBill = async (b) => {
    setLoadingBill(true);
    try {
      const res = await billsApi.get(b.invoice_number);
      setViewBill(res.data);
    } catch { toast.error('Failed to load bill details.'); }
    finally { setLoadingBill(false); }
  };

  const handleCancel = async (b) => {
    const reason = prompt(`Reason for cancelling bill ${b.invoice_number}:`);
    if (reason === null) return;
    try {
      await billsApi.cancel(b.id, reason || 'Cancelled by admin');
      toast.success('Bill cancelled.');
      load();
      setViewBill(null);
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Failed.'); }
  };

  const handleDownloadPdf = async (billId) => {
    try {
      await billsApi.downloadPdf(billId);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to download PDF.');
    }
  };

  const pages = Math.ceil(total / LIMIT);

  const statusColor = (s) => {
    if (s === 'paid') return { bg: '#ecfdf5', color: '#059669' };
    if (s === 'cancelled') return { bg: '#fef2f2', color: '#ef4444' };
    return { bg: '#fef3c7', color: '#d97706' };
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Bills</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 2 }}>{total} bills total</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: 'white', borderRadius: 10, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 1 auto' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>From:</label>
          <input style={{ ...inp, width: 140 }} type="date" value={filters.from} onChange={e => { setFilters(f => ({ ...f, from: e.target.value })); setPage(1); }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 1 auto' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>To:</label>
          <input style={{ ...inp, width: 140 }} type="date" value={filters.to} onChange={e => { setFilters(f => ({ ...f, to: e.target.value })); setPage(1); }} />
        </div>
        <select style={{ ...inp, flex: '0 1 140px' }} value={filters.status} onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }}>
          <option value="">All Status</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button onClick={() => { setFilters({ from: '', to: '', status: '' }); setPage(1); }}
          style={{ padding: '9px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 12, color: '#64748b' }}>
          Clear
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading bills…</div>
        ) : bills.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
            <Receipt size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <div>No bills found.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                  {['Invoice', 'Counter', 'Cashier', 'Payment', 'Subtotal', 'Tax', 'Total', 'Status', 'Date', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bills.map(b => {
                  const sc = statusColor(b.status);
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '11px 14px', fontWeight: 600, color: '#3b82f6', cursor: 'pointer' }} onClick={() => openBill(b)}>{b.invoice_number}</td>
                      <td style={{ padding: '11px 14px', color: '#64748b' }}>{b.counter_number || '—'}</td>
                      <td style={{ padding: '11px 14px', color: '#374151' }}>{b.employee_name}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#eff6ff', color: '#3b82f6' }}>
                          {(b.payment_method || 'cash').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', color: '#374151' }}>{fmt(b.subtotal)}</td>
                      <td style={{ padding: '11px 14px', color: '#374151' }}>{fmt(b.tax)}</td>
                      <td style={{ padding: '11px 14px', fontWeight: 700, color: '#0f172a' }}>{fmt(b.total)}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>
                          {b.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {new Date(b.billed_at).toLocaleDateString('en-PK')}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openBill(b)} title="View"
                            style={{ padding: '5px 8px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', color: '#3b82f6' }}>
                            <FileText size={13} />
                          </button>
                          {b.status !== 'cancelled' && (
                            <button onClick={() => handleCancel(b)} title="Cancel"
                              style={{ padding: '5px 8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', color: '#ef4444' }}>
                              <XCircle size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Page {page} of {pages} ({total} total)</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: 'pointer' }}><ChevronLeft size={14} /></button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: 'pointer' }}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Bill Detail Modal */}
      {viewBill && (
        <Modal title={`Invoice — ${viewBill.invoice_number}`} onClose={() => setViewBill(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            {[
              ['Invoice No', viewBill.invoice_number],
              ['Date', new Date(viewBill.billed_at).toLocaleString('en-PK')],
              ['Counter', viewBill.counter_number || '—'],
              ['Cashier', `${viewBill.employee_name} (${viewBill.employee_code})`],
              ['Payment', (viewBill.payment_method || 'cash').toUpperCase()],
              ['Status', viewBill.status.toUpperCase()],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                {['Item', 'Qty', 'Unit Price', 'Tax%', 'Total'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {viewBill.items?.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '9px 10px', color: '#1e293b' }}>{item.product_name}</td>
                  <td style={{ padding: '9px 10px', color: '#64748b' }}>{item.quantity}</td>
                  <td style={{ padding: '9px 10px', color: '#374151' }}>{fmt(item.unit_price)}</td>
                  <td style={{ padding: '9px 10px', color: '#64748b' }}>{item.tax_rate_pct}%</td>
                  <td style={{ padding: '9px 10px', fontWeight: 600, color: '#0f172a' }}>{fmt(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px 16px' }}>
            {[
              ['Subtotal', fmt(viewBill.subtotal)],
              ['Tax', fmt(viewBill.tax)],
              ['Discount', `-${fmt(viewBill.discount)}`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: '#64748b' }}>
                <span>{k}</span><span>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: '#0f172a', borderTop: '1px solid #e2e8f0', paddingTop: 8, marginTop: 4 }}>
              <span>TOTAL</span><span>{fmt(viewBill.total)}</span>
            </div>
            {viewBill.cash_tendered && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                Cash: {fmt(viewBill.cash_tendered)} | Change: {fmt(viewBill.change_given)}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={() => handleDownloadPdf(viewBill.id)}
              style={{ padding: '9px 18px', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
              Download PDF
            </button>
            {viewBill.status !== 'cancelled' && (
              <button onClick={() => handleCancel(viewBill)}
                style={{ padding: '9px 18px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                Cancel Bill
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
