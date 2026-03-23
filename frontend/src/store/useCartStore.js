import { create } from 'zustand';
import api from '../lib/api';

// Ensure a guest sessionId always exists in localStorage
function ensureSessionId() {
  if (typeof window === 'undefined') return;
  if (!localStorage.getItem('sessionId')) {
    localStorage.setItem('sessionId', crypto.randomUUID());
  }
}

const useCartStore = create((set, get) => ({
  cart: null,
  loading: false,

  fetchCart: async () => {
    ensureSessionId();
    try {
      set({ loading: true });
      const res = await api.get('/cart');
      set({ cart: res.data.data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addToCart: async (productId, quantity = 1, variantId = null) => {
    ensureSessionId();
    const res = await api.post('/cart/items', { productId, quantity, variantId });
    set({ cart: res.data.data });
    return res.data;
  },

  updateItem: async (itemId, quantity) => {
    const res = await api.put(`/cart/items/${itemId}`, { quantity });
    set({ cart: res.data.data });
  },

  removeItem: async (itemId) => {
    const res = await api.delete(`/cart/items/${itemId}`);
    set({ cart: res.data.data });
  },

  applyCoupon: async (couponCode) => {
    const res = await api.post('/cart/coupon', { couponCode });
    set({ cart: res.data.data });
    return res.data;
  },

  applyCoins: async (coinsToRedeem) => {
    const res = await api.post('/cart/coins', { coinsToRedeem });
    set({ cart: res.data.data });
    return res.data;
  },

  removeCoins: async () => {
    const res = await api.delete('/cart/coins');
    set({ cart: res.data.data });
    return res.data;
  },

  removeCoupon: async () => {
    const res = await api.delete('/cart/coupon');
    set({ cart: res.data.data });
  },

  clearCart: () => set({ cart: null }),
}));

export default useCartStore;