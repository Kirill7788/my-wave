// js/api.js — единственный API-клиент проекта
const API_BASE = 'api';

const API = {
  async request(endpoint, options = {}) {
    const url    = `${API_BASE}/${endpoint}`;
    const config = {
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...options,
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, config);
    const data     = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Ошибка ${response.status}`);
    }
    return data;
  },

  // Auth
  register:       (data) => API.request('auth.php?action=register',        { method: 'POST', body: data }),
  login:          (data) => API.request('auth.php?action=login',           { method: 'POST', body: data }),
  logout:         ()     => API.request('auth.php?action=logout',          { method: 'POST' }),
  getCurrentUser: ()     => API.request('auth.php?action=me'),
  updateProfile:  (data) => API.request('auth.php?action=update_profile',  { method: 'POST', body: data }),
  updatePassword: (data) => API.request('auth.php?action=update_password', { method: 'POST', body: data }),

  // Cottages
  getCottages:     (filters = {}) => API.request(`cottages.php?${new URLSearchParams(filters)}`),
  getCottageBySlug: (slug)        => API.request(`cottages.php?slug=${encodeURIComponent(slug)}`),

  // Bookings
  createBooking: (data) => API.request('bookings.php',              { method: 'POST',   body: data }),
  getMyBookings: ()     => API.request('bookings.php'),
  cancelBooking: (id)   => API.request(`bookings.php?id=${id}`,     { method: 'DELETE' }),

  // Cards
  getCards:      ()   => API.request('cards.php'),
  addCard:       (data) => API.request('cards.php',            { method: 'POST',   body: data }),
  setDefaultCard: (id)  => API.request(`cards.php?id=${id}`,   { method: 'PUT' }),
  removeCard:     (id)  => API.request(`cards.php?id=${id}`,   { method: 'DELETE' }),
};
