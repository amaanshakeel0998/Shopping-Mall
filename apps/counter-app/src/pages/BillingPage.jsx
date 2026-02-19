import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../App.jsx';
import { useBillStore } from '../stores/billStore.js';
import { productsApi, billsApi, authApi } from '../api/client.js';
import toast from 'react-hot-toast';
import {
  Search, Trash2, Plus, Minus, ShoppingCart, LogOut,
  CreditCard, Banknote, Smartphone, Pause, Play, X,
  CheckCircle, Printer, RotateCcw
} from 'lucide-react';

const fmt = (n) => `Rs. ${(n || 0).toFixed(2)}`;

// ── Payment Modal ──────────────────────────────────────────────────────────
function PaymentModal({ total, onConfirm, onClose }) {
  const [method, setMethod] = useState('cash');
  const [tendered, setTendered] = useState('');
  const [processing, setProcessing] = useState(false);
  const change = method === 'cash' && tendered ? Math.max(0, parseFloat(tendered) - total) : 0;

  const methods = [
    { id: 'cash', label: 'CASH', icon: Banknote, color: '#10b981' },
    { id: 'card', label: 'CARD', icon: CreditCard, color: '#3b82f6' },
    { id: 'mobile', label: 'MOBILE', icon: Smartphone, color: '#8b5cf6' },
  ];

  const handlePay = async () => {
    if (method === 'cash' && tendered && parseFloat(tendered) < total) {
      toast.error('Insufficient cash tendered.'); return;
    }
    setProcessing(true);
    await onConfirm(method, method === 'cash' ? parseFloat(tendered) || total : null);
    setProcessing(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#1e293b', borderRadius: 16, padding: 32, width: 420, border: '1px solid #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>Payment</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 24, padding: '16px', background: '#0f172a', borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>TOTAL DUE</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#10b981' }}>{fmt(total)}</div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {methods.map(m => (
            <button key={m.id} onClick={() => setMethod(m.id)} style={{
              flex: 1, padding: '12px 8px', borderRadius: 10, border: `2px solid ${method === m.id ? m.color : '#334155'}`,
              background: method === m.id ? m.color + '20' : 'transparent', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <m.icon size={20} color={method === m.id ? m.color : '#64748b'} />
              <span style={{ fontSize: 11, fontWeight: 700, color: method === m.id ? m.color : '#64748b' }}>{m.label}</span>
            </button>
          ))}
        </div>

        {method === 'cash' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>CASH TENDERED</label>
            <input
              type="number" step="0.01" min={total}
              value={tendered} onChange={e => setTendered(e.target.value)}
              placeholder={total.toFixed(2)}
              autoFocus
              style={{ width: '100%', padding: '12px 14px', background: '#0f172a', border: '1.5px solid #334155', borderRadius: 8, fontSize: 18, fontWeight: 700, color: '#f8fafc', outline: 'none', boxSizing: 'border-box' }}
            />
            {tendered && parseFloat(tendered) >= total && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: '#0f172a', borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>Change</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>{fmt(change)}</span>
              </div>
            )}
          </div>
        )}

        <button onClick={handlePay} disabled={processing} style={{
          width: '100%', padding: '14px', background: processing ? '#1d4ed8' : '#3b82f6',
          color: 'white', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700,
          cursor: processing ? 'not-allowed' : 'pointer',
        }}>
          {processing ? 'PROCESSING…' : `CONFIRM PAYMENT — ${fmt(total)}`}
        </button>
      </div>
    </div>
  );
}

// ── Receipt Modal ──────────────────────────────────────────────────────────
function ReceiptModal({ bill, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#1e293b', borderRadius: 16, padding: 32, width: 420, border: '1px solid #334155', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <CheckCircle size={48} color="#10b981" style={{ marginBottom: 12 }} />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f8fafc' }}>Payment Successful!</h2>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>{bill.invoice_number}</p>
        </div>

        <div style={{ background: '#0f172a', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          {bill.items?.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span style={{ color: '#94a3b8' }}>{item.product_name} × {item.quantity}</span>
              <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{fmt(item.line_total)}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #1e293b', marginTop: 10, paddingTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 4 }}>
              <span>Subtotal</span><span>{fmt(bill.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 8 }}>
              <span>Tax</span><span>{fmt(bill.tax)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: '#10b981' }}>
              <span>TOTAL</span><span>{fmt(bill.total)}</span>
            </div>
            {bill.cash_tendered && (
              <div style={{ marginTop: 8, fontSize: 13, color: '#64748b' }}>
                Cash: {fmt(bill.cash_tendered)} | Change: {fmt(bill.change_given)}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <a href={`/api/v1/bills/${bill.id}/pdf`} target="_blank" rel="noreferrer"
            style={{ flex: 1, padding: '11px', background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Printer size={15} /> Print PDF
          </a>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', background: '#10b981', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            NEW BILL
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Billing Page ──────────────────────────────────────────────────────
export default function BillingPage() {
  const { session, logout } = useAuth();
  const { items, addItem, updateQty, removeItem, clearBill, getSubtotal, getTax, getTotal, getItemCount, lastScannedId } = useBillStore();

  const [scanInput, setScanInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [completedBill, setCompletedBill] = useState(null);
  const [discount, setDiscount] = useState(0);
  const scanRef = useRef(null);
  const searchTimer = useRef(null);

  // Auto-focus scan input
  useEffect(() => { scanRef.current?.focus(); }, []);

  // Barcode scan / search
  const handleScanInput = useCallback(async (val) => {
    setScanInput(val);
    clearTimeout(searchTimer.current);

    if (!val.trim()) { setSearchResults([]); return; }

    // If looks like a barcode (all digits, 8-14 chars), scan immediately
    if (/^\d{8,14}$/.test(val.trim())) {
      try {
        const res = await productsApi.scan(val.trim());
        if (res.data) {
          addItem(res.data);
          setScanInput('');
          setSearchResults([]);
          toast.success(`✓ ${res.data.name}`);
        }
      } catch (err) {
        toast.error(err.response?.data?.error?.message || 'Product not found.');
        setScanInput('');
      }
      return;
    }

    // Otherwise debounce search
    searchTimer.current = setTimeout(async () => {
      if (val.trim().length < 2) return;
      setSearching(true);
      try {
        const res = await productsApi.search(val.trim());
        setSearchResults(res.data || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
  }, [addItem]);

  const handleKeyDown = async (e) => {
    if (e.key === 'Enter' && scanInput.trim()) {
      e.preventDefault();
      // Try scan first
      try {
        const res = await productsApi.scan(scanInput.trim());
        if (res.data) {
          addItem(res.data);
          setScanInput('');
          setSearchResults([]);
          toast.success(`✓ ${res.data.name}`);
        }
      } catch {
        // If not found by barcode, use first search result
        if (searchResults.length > 0) {
          addItem(searchResults[0]);
          setScanInput('');
          setSearchResults([]);
        } else {
          toast.error('Product not found.');
        }
      }
    }
    if (e.key === 'Escape') { setScanInput(''); setSearchResults([]); }
  };

  const handleConfirmPayment = async (method, cashTendered) => {
    if (items.length === 0) { toast.error('No items in bill.'); return; }
    try {
      const payload = {
        items: items.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price_paise: Math.round(i.unit_price * 100),
        })),
        payment_method: method,
        discount_paise: Math.round(discount * 100),
        cash_tendered_paise: cashTendered ? Math.round(cashTendered * 100) : undefined,
      };
      const res = await billsApi.create(payload);
      setCompletedBill(res.data);
      setShowPayment(false);
      clearBill();
      setDiscount(0);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to create bill.');
    }
  };

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    logout();
  };

  const subtotal = getSubtotal();
  const tax = getTax();
  const total = Math.max(0, getTotal() - discount);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f172a', color: '#f1f5f9', overflow: 'hidden' }}>

      {/* ── LEFT: Scan + Cart ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #1e293b' }}>

        {/* Header */}
        <div style={{ padding: '12px 16px', background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#3b82f6', borderRadius: 8, padding: 6 }}>
              <ShoppingCart size={16} color="white" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                {session?.user?.full_name}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {session?.user?.counter_number ? `Counter ${session.user.counter_number}` : 'No counter assigned'}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'transparent', border: '1px solid #334155', borderRadius: 6, cursor: 'pointer', color: '#ef4444', fontSize: 12 }}>
            <LogOut size={13} /> Logout
          </button>
        </div>

        {/* Scan Input */}
        <div style={{ padding: '12px 16px', background: '#0f172a', borderBottom: '1px solid #1e293b', position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              ref={scanRef}
              value={scanInput}
              onChange={e => handleScanInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scan barcode or search product…"
              style={{
                width: '100%', padding: '11px 12px 11px 38px', background: '#1e293b',
                border: '1.5px solid #334155', borderRadius: 8, fontSize: 14, color: '#f8fafc',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            {scanInput && (
              <button onClick={() => { setScanInput(''); setSearchResults([]); scanRef.current?.focus(); }}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Search Dropdown */}
          {searchResults.length > 0 && (
            <div style={{ position: 'absolute', left: 16, right: 16, top: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, zIndex: 50, maxHeight: 280, overflow: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
              {searchResults.map(p => (
                <div key={p.id} onClick={() => { addItem(p); setScanInput(''); setSearchResults([]); scanRef.current?.focus(); toast.success(`✓ ${p.name}`); }}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{p.barcode} · {p.category_name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>{fmt(p.price)}</div>
                    <div style={{ fontSize: 11, color: p.stock_quantity <= 0 ? '#ef4444' : '#64748b' }}>
                      Stock: {p.stock_quantity}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Items */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          {items.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#334155' }}>
              <ShoppingCart size={64} style={{ marginBottom: 16, opacity: 0.3 }} />
              <div style={{ fontSize: 16, fontWeight: 600 }}>Scan a product to start</div>
              <div style={{ fontSize: 13, marginTop: 4, opacity: 0.6 }}>Use barcode scanner or search above</div>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.product_id} style={{
                padding: '10px 16px', borderBottom: '1px solid #1e293b',
                background: item.product_id === lastScannedId ? '#1a2744' : 'transparent',
                transition: 'background 0.3s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.product_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {fmt(item.unit_price)} × {item.quantity} = <span style={{ color: '#10b981', fontWeight: 700 }}>{fmt(item.unit_price * item.quantity)}</span>
                      {item.tax_rate_pct > 0 && <span style={{ color: '#f59e0b', marginLeft: 6 }}>+{item.tax_rate_pct}% tax</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => updateQty(item.product_id, item.quantity - 1)}
                      style={{ width: 26, height: 26, borderRadius: 6, background: '#334155', border: 'none', cursor: 'pointer', color: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Minus size={12} />
                    </button>
                    <input
                      type="number" min="0.01" step="0.01"
                      value={item.quantity}
                      onChange={e => updateQty(item.product_id, e.target.value)}
                      style={{ width: 44, textAlign: 'center', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#f8fafc', fontSize: 13, fontWeight: 700, padding: '3px 4px', outline: 'none' }}
                    />
                    <button onClick={() => updateQty(item.product_id, item.quantity + 1)}
                      style={{ width: 26, height: 26, borderRadius: 6, background: '#334155', border: 'none', cursor: 'pointer', color: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Plus size={12} />
                    </button>
                    <button onClick={() => removeItem(item.product_id)}
                      style={{ width: 26, height: 26, borderRadius: 6, background: '#450a0a', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── RIGHT: Totals + Actions ── */}
      <div style={{ width: 300, display: 'flex', flexDirection: 'column', background: '#1e293b' }}>

        {/* Bill Summary */}
        <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 12 }}>
            BILL SUMMARY — {getItemCount()} items
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>
            <span>Subtotal</span><span>{fmt(subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: '#94a3b8' }}>
            <span>Tax</span><span>{fmt(tax)}</span>
          </div>

          {/* Discount */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 13, color: '#f59e0b' }}>
            <span>Discount</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>- Rs.</span>
              <input
                type="number" min="0" step="0.01"
                value={discount || ''}
                onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                placeholder="0"
                style={{ width: 70, textAlign: 'right', background: '#0f172a', border: '1px solid #334155', borderRadius: 5, color: '#f59e0b', fontSize: 13, fontWeight: 600, padding: '3px 6px', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ borderTop: '1px solid #334155', paddingTop: 12, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 800, color: '#10b981' }}>
              <span>TOTAL</span><span>{fmt(total)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <button
            onClick={() => { if (items.length > 0) setShowPayment(true); else toast.error('Add items first.'); }}
            style={{
              width: '100%', padding: '16px', background: items.length > 0 ? '#10b981' : '#1e3a2f',
              color: items.length > 0 ? 'white' : '#334155', border: 'none', borderRadius: 10,
              fontSize: 16, fontWeight: 800, cursor: items.length > 0 ? 'pointer' : 'not-allowed',
              marginBottom: 10, letterSpacing: '0.5px',
            }}
          >
            CHARGE — {fmt(total)}
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { if (confirm('Clear current bill?')) { clearBill(); setDiscount(0); } }}
              style={{ flex: 1, padding: '10px', background: '#450a0a', color: '#ef4444', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
            >
              <RotateCcw size={13} /> CLEAR
            </button>
          </div>
        </div>

        {/* Time */}
        <div style={{ padding: '10px 20px', borderTop: '1px solid #334155', fontSize: 11, color: '#475569', textAlign: 'center' }}>
          {new Date().toLocaleString('en-PK')}
        </div>
      </div>

      {/* Modals */}
      {showPayment && (
        <PaymentModal
          total={total}
          onConfirm={handleConfirmPayment}
          onClose={() => setShowPayment(false)}
        />
      )}

      {completedBill && (
        <ReceiptModal
          bill={completedBill}
          onClose={() => { setCompletedBill(null); scanRef.current?.focus(); }}
        />
      )}
    </div>
  );
}
