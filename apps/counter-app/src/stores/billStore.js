import { create } from 'zustand';

/**
 * Central billing state for the counter POS.
 * All amounts stored as floats (display values), paise conversion happens at API call time.
 */
export const useBillStore = create((set, get) => ({
  // Current bill items
  items: [],

  // Last scanned product (highlighted in yellow)
  lastScannedId: null,

  // Add or increment a product
  addItem: (product) => {
    const { items } = get();
    const existing = items.find(i => i.product_id === product.id);

    if (existing) {
      set({
        items: items.map(i =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ),
        lastScannedId: product.id,
      });
    } else {
      set({
        items: [...items, {
          product_id: product.id,
          barcode: product.barcode,
          product_name: product.name,
          quantity: 1,
          unit_price: product.price,
          unit_price_paise: product.price_paise,
          tax_rate_pct: product.tax_rate_pct || 0,
          tax_name: product.tax_name || '',
          category_name: product.category_name || '',
          unit: product.unit || 'piece',
          stock_quantity: product.stock_quantity,
        }],
        lastScannedId: product.id,
      });
    }
  },

  // Update quantity for an item
  updateQty: (product_id, qty) => {
    const q = parseFloat(qty);
    if (isNaN(q) || q <= 0) {
      get().removeItem(product_id);
      return;
    }
    set(state => ({
      items: state.items.map(i =>
        i.product_id === product_id ? { ...i, quantity: q } : i
      ),
    }));
  },

  // Remove an item
  removeItem: (product_id) => {
    set(state => ({
      items: state.items.filter(i => i.product_id !== product_id),
      lastScannedId: state.lastScannedId === product_id ? null : state.lastScannedId,
    }));
  },

  // Clear all items
  clearBill: () => set({ items: [], lastScannedId: null }),

  // Restore items from a held bill
  restoreItems: (items) => set({ items, lastScannedId: null }),

  // Computed totals
  getSubtotal: () => {
    return get().items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  },

  getTax: () => {
    return get().items.reduce((sum, i) => {
      const tax = (i.unit_price * (i.tax_rate_pct || 0) / 100) * i.quantity;
      return sum + tax;
    }, 0);
  },

  getTotal: () => {
    const s = get();
    return s.getSubtotal() + s.getTax();
  },

  getItemCount: () => {
    return get().items.reduce((sum, i) => sum + i.quantity, 0);
  },
}));
