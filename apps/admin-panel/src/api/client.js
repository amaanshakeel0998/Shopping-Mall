import axios from 'axios';

const BASE_URL = '/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally — redirect to login
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }).then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
};

// ─── Dashboard ────────────────────────────────────────────────────────────
export const reportsApi = {
  dashboard: () => api.get('/reports/dashboard').then((r) => r.data),
  sales: (params) => api.get('/reports/sales', { params }).then((r) => r.data),
  products: (params) => api.get('/reports/products', { params }).then((r) => r.data),
  employees: (params) => api.get('/reports/employees', { params }).then((r) => r.data),
  tax: (params) => api.get('/reports/tax', { params }).then((r) => r.data),
  inventory: (params) => api.get('/reports/inventory', { params }).then((r) => r.data),
  auditLogs: (params) => api.get('/reports/audit-logs', { params }).then((r) => r.data),
  counters: (params) => api.get('/reports/counters', { params }).then((r) => r.data),
};

// ─── Products ─────────────────────────────────────────────────────────────
export const productsApi = {
  list: (params) => api.get('/products', { params }).then((r) => r.data),
  get: (id) => api.get(`/products/${id}`).then((r) => r.data),
  create: (data) => api.post('/products', data).then((r) => r.data),
  update: (id, data) => api.put(`/products/${id}`, data).then((r) => r.data),
  adjustStock: (id, adjustment, reason) =>
    api.patch(`/products/${id}/stock`, { adjustment, reason }).then((r) => r.data),
  delete: (id) => api.delete(`/products/${id}`).then((r) => r.data),
};

// ─── Categories ───────────────────────────────────────────────────────────
export const categoriesApi = {
  list: () => api.get('/categories').then((r) => r.data),
  create: (data) => api.post('/categories', data).then((r) => r.data),
  update: (id, data) => api.put(`/categories/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/categories/${id}`).then((r) => r.data),
  taxRates: () => api.get('/categories/tax-rates').then((r) => r.data),
  createTaxRate: (data) => api.post('/categories/tax-rates', data).then((r) => r.data),
  discounts: () => api.get('/categories/discounts').then((r) => r.data),
  createDiscount: (data) => api.post('/categories/discounts', data).then((r) => r.data),
  counters: () => api.get('/categories/counters').then((r) => r.data),
  createCounter: (data) => api.post('/categories/counters', data).then((r) => r.data),
};

// ─── Employees ────────────────────────────────────────────────────────────
export const employeesApi = {
  list: (params) => api.get('/employees', { params }).then((r) => r.data),
  get: (id) => api.get(`/employees/${id}`).then((r) => r.data),
  create: (data) => api.post('/employees', data).then((r) => r.data),
  update: (id, data) => api.put(`/employees/${id}`, data).then((r) => r.data),
  resetPassword: (id, new_password) =>
    api.post(`/employees/${id}/reset-password`, { new_password }).then((r) => r.data),
  delete: (id) => api.delete(`/employees/${id}`).then((r) => r.data),
};

// ─── Bills ────────────────────────────────────────────────────────────────
export const billsApi = {
  list: (params) => api.get('/bills', { params }).then((r) => r.data),
  get: (id) => api.get(`/bills/${id}`).then((r) => r.data),
  cancel: (id, reason) => api.delete(`/bills/${id}`, { data: { reason } }).then((r) => r.data),
  pdfUrl: (id) => `${BASE_URL}/bills/${id}/pdf`,
};

export default api;
