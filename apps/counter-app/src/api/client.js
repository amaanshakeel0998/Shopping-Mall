import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('counter_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('counter_token');
      localStorage.removeItem('counter_user');
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (username, password, counter_id) =>
    api.post('/auth/login', { username, password, counter_id }).then(r => r.data),
  logout: () => api.post('/auth/logout').then(r => r.data),
};

export const productsApi = {
  scan: (barcode) => api.get(`/products/scan/${encodeURIComponent(barcode)}`).then(r => r.data),
  search: (q, page = 1) => api.get('/products/search', { params: { q, page, limit: 20 } }).then(r => r.data),
};

export const billsApi = {
  create: (data) => api.post('/bills', data).then(r => r.data),
  hold: (data) => api.post('/bills/hold', data).then(r => r.data),
  getHeld: (counter_id) => api.get(`/bills/held/${counter_id}`).then(r => r.data),
  resume: (id) => api.post(`/bills/${id}/resume`).then(r => r.data),
  deleteHeld: (id) => api.delete(`/bills/held/${id}`).then(r => r.data),
  receipt: (id) => api.get(`/bills/${id}/receipt`).then(r => r.data),
  downloadPdf: async (id) => {
    const res = await api.get(`/bills/${id}/pdf`, { responseType: 'blob' });
    const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const disposition = res.headers['content-disposition'] || '';
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const filename = match?.[1] || `invoice-${id}.pdf`;

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  },
};

export const categoriesApi = {
  counters: () => api.get('/categories/counters').then(r => r.data),
  heartbeat: (counter_id) => api.post('/categories/sync/heartbeat', { counter_id }).then(r => r.data),
};

export default api;
