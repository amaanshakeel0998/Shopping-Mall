import React from 'react';
import { useAuth } from '../App.jsx';
import { Settings, Shield, Database, Info } from 'lucide-react';

function Card({ title, icon: Icon, color, children }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ background: color + '20', borderRadius: 8, padding: 8 }}><Icon size={16} color={color} /></div>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{title}</h2>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
      <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Settings</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 2 }}>System configuration and information</p>
      </div>

      <Card title="Current User" icon={Shield} color="#3b82f6">
        <Row label="Full Name" value={user?.full_name} />
        <Row label="Username" value={user?.username} />
        <Row label="Employee Code" value={user?.employee_code} />
        <Row label="Role" value={user?.role?.toUpperCase()} />
      </Card>

      <Card title="System Information" icon={Info} color="#10b981">
        <Row label="System" value="Mall POS v1.0.0" />
        <Row label="API Base" value="/api/v1" />
        <Row label="Database" value="SQLite (better-sqlite3)" />
        <Row label="Auth" value="JWT (HS256)" />
        <Row label="Currency" value="Rs. (Paise)" />
      </Card>

      <Card title="API Endpoints" icon={Database} color="#8b5cf6">
        {[
          ['Health Check', 'GET /health'],
          ['Login', 'POST /api/v1/auth/login'],
          ['Products', 'GET /api/v1/products'],
          ['Barcode Scan', 'GET /api/v1/products/scan/:barcode'],
          ['Create Bill', 'POST /api/v1/bills'],
          ['Reports', 'GET /api/v1/reports/dashboard'],
        ].map(([label, endpoint]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f8fafc' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>{label}</span>
            <code style={{ fontSize: 12, background: '#f1f5f9', padding: '3px 8px', borderRadius: 5, color: '#475569' }}>{endpoint}</code>
          </div>
        ))}
      </Card>

      <Card title="Default Credentials" icon={Shield} color="#f59e0b">
        <div style={{ padding: '12px 16px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a', marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: '#92400e', fontWeight: 600, marginBottom: 8 }}>⚠ Change these passwords in production!</p>
          <Row label="Admin" value="admin / Admin@123" />
          <Row label="Cashier" value="cashier01 / Employee@123" />
        </div>
        <p style={{ fontSize: 12, color: '#94a3b8' }}>
          Use the Employees page to reset passwords. All sessions are terminated on password reset.
        </p>
      </Card>

      <Card title="Counter App" icon={Settings} color="#06b6d4">
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
          The Counter App is a separate React application for cashiers. Run it on port 5174.
        </p>
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>
          <div>cd apps/counter-app</div>
          <div>npm install</div>
          <div>npm run dev</div>
        </div>
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 10 }}>
          Counter app runs at <strong>http://localhost:5174</strong> and proxies API calls to the backend on port 3000.
        </p>
      </Card>
    </div>
  );
}
