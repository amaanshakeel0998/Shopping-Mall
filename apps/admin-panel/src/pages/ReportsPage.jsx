import React, { useState, useEffect } from 'react';
import { reportsApi } from '../api/client.js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BarChart3, RefreshCw } from 'lucide-react';

const TABS = ['Sales', 'Products', 'Employees', 'Tax', 'Inventory', 'Audit Log'];
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
const fmt = (n) => `Rs. ${(n || 0).toFixed(2)}`;
const inp = { padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', background: 'white' };

function Card({ children, style = {} }) {
  return <div style={{ background: 'white', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', ...style }}>{children}</div>;
}

export default function ReportsPage() {
  const [tab, setTab] = useState('Sales');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const today = new Date().toISOString().split('T')[0];
  const monthStart = new Date(); monthStart.setDate(1);
  const [from, setFrom] = useState(monthStart.toISOString().split('T')[0]);
  const [to, setTo] = useState(today);
  const [groupBy, setGroupBy] = useState('day');

  const load = async () => {
    setLoading(true);
    setData(null);
    try {
      const params = { from, to };
      let res;
      if (tab === 'Sales') res = await reportsApi.sales({ ...params, group_by: groupBy });
      else if (tab === 'Products') res = await reportsApi.products(params);
      else if (tab === 'Employees') res = await reportsApi.employees(params);
      else if (tab === 'Tax') res = await reportsApi.tax(params);
      else if (tab === 'Inventory') res = await reportsApi.inventory({});
      else if (tab === 'Audit Log') res = await reportsApi.auditLogs({ limit: 100 });
      setData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab, from, to, groupBy]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Reports & Analytics</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 2 }}>Business intelligence and operational insights</p>
        </div>
        <button onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151' }}>
          <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'white', padding: 6, borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 600 : 400,
            background: tab === t ? '#3b82f6' : 'transparent', color: tab === t ? 'white' : '#64748b', transition: 'all 0.15s',
          }}>{t}</button>
        ))}
      </div>

      {/* Date Filters */}
      {tab !== 'Inventory' && tab !== 'Audit Log' && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>From:</label>
            <input style={inp} type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>To:</label>
            <input style={inp} type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          {tab === 'Sales' && (
            <select style={inp} value={groupBy} onChange={e => setGroupBy(e.target.value)}>
              <option value="day">By Day</option>
              <option value="month">By Month</option>
              <option value="hour">By Hour</option>
            </select>
          )}
        </div>
      )}

      {loading && <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading report…</div>}

      {/* ── SALES ── */}
      {!loading && tab === 'Sales' && data && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
            {[
              ['Total Bills', data.summary?.total_bills],
              ['Revenue', fmt(data.summary?.total)],
              ['Tax Collected', fmt(data.summary?.tax)],
              ['Discounts', fmt(data.summary?.discount)],
              ['Avg Bill', fmt(data.summary?.avg_bill)],
            ].map(([k, v]) => (
              <Card key={k}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>{k}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{v}</div>
              </Card>
            ))}
          </div>
          {data.data?.length > 0 && (
            <Card style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 16 }}>Revenue Over Time</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={v => [`Rs. ${v.toFixed(2)}`, 'Revenue']} />
                  <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
          {data.payment_breakdown?.length > 0 && (
            <Card>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 16 }}>Payment Methods</h3>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {data.payment_breakdown.map((p, i) => (
                  <div key={i} style={{ padding: '12px 20px', background: '#f8fafc', borderRadius: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{(p.method || 'CASH').toUpperCase()}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: COLORS[i % COLORS.length] }}>{p.count}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{fmt(p.total)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── PRODUCTS ── */}
      {!loading && tab === 'Products' && data && (
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 16 }}>Top Products by Revenue</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                {['#', 'Product', 'Category', 'Qty Sold', 'Bills', 'Revenue'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.products?.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '10px 12px', color: '#94a3b8', fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 500, color: '#1e293b' }}>{p.product_name}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{p.category_name || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{p.total_qty}</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{p.bill_count}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#10b981' }}>{fmt(p.total_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── EMPLOYEES ── */}
      {!loading && tab === 'Employees' && data && (
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 16 }}>Employee Performance</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                {['Code', 'Name', 'Bills', 'Avg Bill', 'Total Revenue', 'Last Bill'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.employees?.map((e, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{e.employee_code}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e293b' }}>{e.full_name}</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{e.bill_count}</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{fmt(e.avg_bill)}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: '#10b981' }}>{fmt(e.total_revenue)}</td>
                  <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: 12 }}>{e.last_bill_at ? new Date(e.last_bill_at).toLocaleDateString('en-PK') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── TAX ── */}
      {!loading && tab === 'Tax' && data && (
        <div>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Total Tax Collected</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a' }}>{fmt(data.total_tax_collected)}</div>
          </Card>
          <Card>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 16 }}>Tax Breakdown by Rate</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                  {['Tax Rate', 'Bills', 'Qty', 'Taxable Amount', 'Tax Collected'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.by_rate?.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#3b82f6' }}>{r.tax_rate_pct}%</td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{r.bill_count}</td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{r.total_qty}</td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{fmt(r.taxable_amount)}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#10b981' }}>{fmt(r.tax_collected)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ── INVENTORY ── */}
      {!loading && tab === 'Inventory' && data && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 20 }}>
            {[
              ['Total Products', data.summary?.total, '#3b82f6'],
              ['Out of Stock', data.summary?.out_of_stock, '#ef4444'],
              ['Critical (≤5)', data.summary?.critical, '#f59e0b'],
              ['Low (≤10)', data.summary?.low, '#f97316'],
            ].map(([k, v, c]) => (
              <Card key={k}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>{k}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
              </Card>
            ))}
          </div>
          <Card>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 16 }}>Stock Levels</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                  {['SKU', 'Product', 'Category', 'Stock', 'Sold (30d)', 'Status'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.products?.map((p, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{p.sku}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#1e293b' }}>{p.name}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{p.category_name}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: p.stock_quantity === 0 ? '#ef4444' : p.stock_quantity <= 5 ? '#f59e0b' : '#10b981' }}>
                      {p.stock_quantity} {p.unit}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{p.sold_last_30_days}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: p.stock_status === 'out_of_stock' ? '#fef2f2' : p.stock_status === 'critical' ? '#fff7ed' : p.stock_status === 'low' ? '#fefce8' : '#ecfdf5',
                        color: p.stock_status === 'out_of_stock' ? '#ef4444' : p.stock_status === 'critical' ? '#ea580c' : p.stock_status === 'low' ? '#ca8a04' : '#059669',
                      }}>
                        {p.stock_status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ── AUDIT LOG ── */}
      {!loading && tab === 'Audit Log' && data && (
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 16 }}>Audit Log (Last 100 entries)</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                  {['Time', 'Actor', 'Action', 'Entity', 'IP'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.logs?.map((l, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '9px 12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString('en-PK')}</td>
                    <td style={{ padding: '9px 12px', color: '#374151' }}>{l.actor_name || '—'}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#475569', fontFamily: 'monospace' }}>
                        {l.action}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', color: '#64748b' }}>{l.entity}</td>
                    <td style={{ padding: '9px 12px', color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>{l.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
