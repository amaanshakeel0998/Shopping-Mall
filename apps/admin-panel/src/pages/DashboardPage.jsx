import React, { useState, useEffect } from 'react';
import { reportsApi } from '../api/client.js';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import {
  TrendingUp, ShoppingCart, Package, Users, AlertTriangle,
  Receipt, RefreshCw, ArrowUpRight
} from 'lucide-react';

function StatCard({ icon: Icon, label, value, sub, color = '#3b82f6', bg = '#eff6ff' }) {
  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: '20px 24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{ background: bg, borderRadius: 12, padding: 12, flexShrink: 0 }}>
        <Icon size={22} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function fmt(n) {
  if (n >= 1000000) return `Rs. ${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `Rs. ${(n / 1000).toFixed(1)}K`;
  return `Rs. ${n?.toFixed ? n.toFixed(2) : n}`;
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [dash, sales] = await Promise.all([
        reportsApi.dashboard(),
        reportsApi.sales({ group_by: 'day', from: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0] }),
      ]);
      setData(dash.data);
      setSalesData(sales.data);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const refresh = () => { setRefreshing(true); load(); };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div style={{ textAlign: 'center', color: '#64748b' }}>
        <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
        <div>Loading dashboard…</div>
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Dashboard</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 2 }}>Real-time overview of your mall operations</p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 8,
            cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#374151',
          }}
        >
          <RefreshCw size={14} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard
          icon={TrendingUp} label="Today's Revenue" color="#10b981" bg="#ecfdf5"
          value={fmt(data?.today?.total || 0)}
          sub={`${data?.today?.bill_count || 0} bills today`}
        />
        <StatCard
          icon={ShoppingCart} label="This Month" color="#3b82f6" bg="#eff6ff"
          value={fmt(data?.this_month?.total || 0)}
          sub={`${data?.this_month?.bill_count || 0} bills this month`}
        />
        <StatCard
          icon={Package} label="Active Products" color="#8b5cf6" bg="#f5f3ff"
          value={data?.total_products || 0}
          sub={`${data?.low_stock_count || 0} low stock`}
        />
        <StatCard
          icon={Users} label="Employees" color="#f59e0b" bg="#fffbeb"
          value={data?.total_employees || 0}
          sub="Active staff"
        />
        {data?.low_stock_count > 0 && (
          <StatCard
            icon={AlertTriangle} label="Low Stock Alert" color="#ef4444" bg="#fef2f2"
            value={data.low_stock_count}
            sub="Products need restocking"
          />
        )}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Sales Chart */}
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 20 }}>
            Sales — Last 7 Days
          </h2>
          {salesData?.data?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={salesData.data}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v) => [`Rs. ${v.toFixed(2)}`, 'Revenue']} />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              No sales data for this period
            </div>
          )}
        </div>

        {/* Top Products */}
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 20 }}>
            Top Products Today
          </h2>
          {data?.top_products_today?.length > 0 ? (
            <div>
              {data.top_products_today.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', background: '#eff6ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#3b82f6', flexShrink: 0,
                  }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.product_name}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>Qty: {p.total_qty}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#10b981', flexShrink: 0 }}>
                    {fmt(p.total_revenue)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
              No sales today yet
            </div>
          )}
        </div>
      </div>

      {/* Recent Bills */}
      <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 20 }}>
          Recent Bills
        </h2>
        {data?.recent_bills?.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  {['Invoice', 'Counter', 'Cashier', 'Payment', 'Total', 'Time'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recent_bills.map((b, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#3b82f6' }}>{b.invoice_number}</td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{b.counter_number || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{b.employee_name}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: b.payment_method === 'cash' ? '#ecfdf5' : '#eff6ff',
                        color: b.payment_method === 'cash' ? '#059669' : '#3b82f6',
                      }}>
                        {(b.payment_method || 'cash').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{fmt(b.total)}</td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                      {new Date(b.billed_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
            No bills yet today. Start billing from the counter app!
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
