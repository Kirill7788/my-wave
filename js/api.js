// js/api.js
const API_BASE = 'api';
const API = {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}/${endpoint}`;
    const config = {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...options,
    };
    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }
    try {
      const response = await fetch(url, config);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ошибка');
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },
  // Auth
  register: (data) => API.request('auth.php?action=register', { method: 'POST', body: data }),
  login: (data) => API.request('auth.php?action=login', { method: 'POST', body: data }),
  logout: () => API.request('auth.php?action=logout', { method: 'POST' }),
  getCurrentUser: () => API.request('auth.php?action=me'),
  getCards: () => API.request('cards.php'),
  addCard: (data) => API.request('cards.php', { method: 'POST', body: data }),
  setDefaultCard: (id) => API.request(`cards.php?id=${id}`, { method: 'PUT' }),
  removeCard: (id) => API.request(`cards.php?id=${id}`, { method: 'DELETE' }),
  
  // ✅ ДОБАВЛЕНО: Метод обновления профиля
  updateProfile: (data) => API.request('auth.php?action=update_profile', { method: 'POST', body: data }),

  // Cottages
  getCottages: (filters = {}) => {
    const params = new URLSearchParams(filters);
    return API.request(`cottages.php?${params}`);
  },
  getCottageBySlug: (slug) => API.request(`cottages.php?slug=${slug}`),
  
  // Bookings
  createBooking: (data) => API.request('bookings.php', { method: 'POST', body: data }),
  getMyBookings: () => API.request('bookings.php'),
  cancelBooking: (id) => API.request(`bookings.php?id=${id}`, { method: 'DELETE' }),
  
  // Lakes
  getLakes: () => API.request('lakes.php'),
};