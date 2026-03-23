import axios from 'axios';
import useAuthStore from '@/store/useAuthStore';

// Always use a relative /api base so every request goes through
// the Next.js rewrite proxy -> backend, regardless of environment.
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Auto attach access token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) config.headers['x-session-id'] = sessionId;
  }
  return config;
});

// Auto refresh token on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const url = original?.url || '';
    // Avoid infinite loop if /auth/refresh itself returns 401
    if (error.response?.status === 401 && url.includes('/auth/refresh')) {
      localStorage.removeItem('accessToken');
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(error);
    }
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        // use the same axios instance so the baseURL / credentials
      // configuration is consistent and we avoid mismatched domains
      const res = await api.post('/auth/refresh', {});
        const newToken = res.data.accessToken;
        localStorage.setItem('accessToken', newToken);
        
        // Update the store with new token
        const store = useAuthStore.getState();
        if (store.user) {
          store.setAuth(store.user, newToken);
        }
        
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        localStorage.removeItem('accessToken');
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;