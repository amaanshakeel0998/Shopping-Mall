# 🛍️ Mall POS System

<p align="center">
  <strong>Production-ready Point of Sale (POS) platform for shopping mall operations</strong><br/>
  <em>Backend API + Admin Panel + Counter Application</em>
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white" />
  <img alt="Express" src="https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=000000" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white" />
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white" />
</p>

---

## 📌 Overview

The **Mall POS System** is a full-stack solution designed for multi-counter billing operations in a shopping mall environment.

It includes:

- **API Server** for authentication, billing, products, reports, and user management
- **Admin Panel** for operations, analytics, employee management, and configuration
- **Counter App** optimized for cashier workflow and fast billing execution

---

## 👨‍💻 Developer

- **Muhammad Amaan**

---

## 🧱 Tech Stack

### Backend (`apps/api`)
- Node.js
- Express.js
- better-sqlite3 (SQLite)
- JWT Authentication
- bcryptjs
- PDFKit

### Frontend (`apps/admin-panel`, `apps/counter-app`)
- React 18
- Vite
- Axios
- React Hot Toast
- Recharts (Admin reporting)
- Zustand (Counter billing state)

---

## 🧩 Core Modules

### 🔐 Authentication & Sessions
- JWT access/refresh token flow
- Session table with token JTI and revocation support
- Role-based route protection (`admin`, `employee`)

### 📦 Product & Category Management
- Product CRUD with pricing, tax, stock, and activation controls
- Category, tax rate, discount, and counter configuration
- Barcode scan endpoint for counter-side fast lookup

### 🧾 Billing Engine
- Bill creation with line-item processing
- Invoice number generation
- Stock updates on billing
- Hold/resume bills support
- PDF invoice and text receipt generation

### 📊 Reporting
- Dashboard KPIs
- Sales reports by date grouping
- Product/employee/tax/inventory reports
- Audit logs and counter-level summaries

---

## 📁 Project Structure

```text
Shopping-Mall/
├── MallPOS_Architecture_Blueprint.docx
├── README.md
└── apps/
    ├── admin-panel/
    │   ├── index.html
    │   ├── package.json
    │   ├── package-lock.json
    │   ├── vite.config.js
    │   └── src/
    │       ├── main.jsx
    │       ├── App.jsx
    │       ├── api/
    │       │   └── client.js
    │       ├── components/
    │       │   └── Layout.jsx
    │       └── pages/
    │           ├── LoginPage.jsx
    │           ├── DashboardPage.jsx
    │           ├── ProductsPage.jsx
    │           ├── CategoriesPage.jsx
    │           ├── EmployeesPage.jsx
    │           ├── BillsPage.jsx
    │           ├── ReportsPage.jsx
    │           └── SettingsPage.jsx
    ├── api/
    │   ├── .env
    │   ├── .env.example
    │   ├── package.json
    │   ├── package-lock.json
    │   ├── data/
    │   │   ├── mallpos.db
    │   │   ├── mallpos.db-shm
    │   │   └── mallpos.db-wal
    │   └── src/
    │       ├── server.js
    │       ├── lib/
    │       │   ├── database.js
    │       │   ├── initDb.js
    │       │   ├── response.js
    │       │   └── audit.js
    │       ├── middleware/
    │       │   └── auth.js
    │       ├── routes/
    │       │   ├── auth.js
    │       │   ├── products.js
    │       │   ├── categories.js
    │       │   ├── employees.js
    │       │   ├── bills.js
    │       │   └── reports.js
    │       └── services/
    │           ├── billing.js
    │           └── pdfGenerator.js
    └── counter-app/
        ├── index.html
        ├── package.json
        ├── package-lock.json
        ├── vite.config.js
        └── src/
            ├── main.jsx
            ├── App.jsx
            ├── api/
            │   └── client.js
            ├── pages/
            │   ├── LoginPage.jsx
            │   └── BillingPage.jsx
            └── stores/
                └── billStore.js
```

---

## ⚙️ Environment Setup

1. Copy env template:

```bash
cp apps/api/.env.example apps/api/.env
```

2. Update required values in `apps/api/.env`:
- `JWT_SECRET`
- `PORT`
- `MALL_NAME`, `CURRENCY_SYMBOL`, and related metadata

---

## 🚀 Run Commands

> Run each app in a separate terminal from the project root.

### 1) Start API Server

```bash
cd apps/api
npm install
npm run dev
```

### 2) Start Admin Panel

```bash
cd apps/admin-panel
npm install
npm run dev
```

### 3) Start Counter App

```bash
cd apps/counter-app
npm install
npm run dev
```

### 4) Access URLs

- Admin Panel: `http://localhost:5173/`
- Counter App: `http://localhost:5174/`
- API Base: `http://localhost:3000/api/v1/`
- Health Check: `http://localhost:3000/health`

