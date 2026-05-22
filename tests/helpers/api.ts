/**
 * helpers/api.ts
 * Типизированный API-клиент для тестов. Используется напрямую
 * или через APIRequestContext из Playwright.
 */
import { APIRequestContext, APIResponse } from '@playwright/test';

export const API = {
  BASE: '/api',

  // ── Auth ──────────────────────────────────────────────────────────────────

  async register(req: APIRequestContext, data: {
    email: string; password: string; first_name: string; phone: string;
  }): Promise<APIResponse> {
    return req.post(`${API.BASE}/auth.php?action=register`, { data });
  },

  async login(req: APIRequestContext, email: string, password: string): Promise<APIResponse> {
    return req.post(`${API.BASE}/auth.php?action=login`, { data: { email, password } });
  },

  async logout(req: APIRequestContext): Promise<APIResponse> {
    return req.post(`${API.BASE}/auth.php?action=logout`);
  },

  async me(req: APIRequestContext): Promise<APIResponse> {
    return req.get(`${API.BASE}/auth.php?action=me`);
  },

  async updateProfile(req: APIRequestContext, data: {
    first_name?: string; last_name?: string; phone?: string;
  }): Promise<APIResponse> {
    return req.post(`${API.BASE}/auth.php?action=update_profile`, { data });
  },

  async updatePassword(req: APIRequestContext, data: {
    current_password: string; new_password: string;
  }): Promise<APIResponse> {
    return req.post(`${API.BASE}/auth.php?action=update_password`, { data });
  },

  async resetPassword(req: APIRequestContext, email: string): Promise<APIResponse> {
    return req.post(`${API.BASE}/auth.php?action=reset_password`, { data: { email } });
  },

  async confirmReset(req: APIRequestContext, data: {
    token: string; new_password: string;
  }): Promise<APIResponse> {
    return req.post(`${API.BASE}/auth.php?action=confirm_reset`, { data });
  },

  // ── Cottages ──────────────────────────────────────────────────────────────

  async getCottages(req: APIRequestContext, filters: Record<string, string> = {}): Promise<APIResponse> {
    const qs = new URLSearchParams(filters).toString();
    return req.get(`${API.BASE}/cottages.php${qs ? '?' + qs : ''}`);
  },

  async getCottageBySlug(req: APIRequestContext, slug: string): Promise<APIResponse> {
    return req.get(`${API.BASE}/cottages.php?slug=${encodeURIComponent(slug)}`);
  },

  // ── Bookings ──────────────────────────────────────────────────────────────

  async createBooking(req: APIRequestContext, data: {
    cottage_id: number;
    check_in: string;
    check_out: string;
    adults: number;
    children?: number;
    guest_name: string;
    guest_phone: string;
    guest_email: string;
  }): Promise<APIResponse> {
    return req.post(`${API.BASE}/bookings.php`, { data });
  },

  async getMyBookings(req: APIRequestContext): Promise<APIResponse> {
    return req.get(`${API.BASE}/bookings.php`);
  },

  async cancelBooking(req: APIRequestContext, id: number): Promise<APIResponse> {
    return req.delete(`${API.BASE}/bookings.php?id=${id}`);
  },

  // ── Cards ─────────────────────────────────────────────────────────────────

  async getCards(req: APIRequestContext): Promise<APIResponse> {
    return req.get(`${API.BASE}/cards.php`);
  },

  async addCard(req: APIRequestContext, data: {
    card_number: string; card_holder: string;
    exp_month: number;  exp_year: number;  cvc: string;
  }): Promise<APIResponse> {
    return req.post(`${API.BASE}/cards.php`, { data });
  },

  async setDefaultCard(req: APIRequestContext, id: number): Promise<APIResponse> {
    return req.put(`${API.BASE}/cards.php?id=${id}`);
  },

  async deleteCard(req: APIRequestContext, id: number): Promise<APIResponse> {
    return req.delete(`${API.BASE}/cards.php?id=${id}`);
  },
};

// ── Convenience helpers ───────────────────────────────────────────────────────

/** Регистрирует пользователя и возвращает его данные. Бросает при ошибке. */
export async function registerAndLogin(
  req: APIRequestContext,
  email: string,
  password = 'TestPass123!'
): Promise<{ id: number; email: string; role: string }> {
  await API.register(req, {
    email,
    password,
    first_name: 'Test',
    phone: '+375291234567',
  });
  const loginResp = await API.login(req, email, password);
  const body = await loginResp.json();
  return body.user;
}

/** Создаёт бронирование с дефолтными данными. */
export async function bookCottage(
  req: APIRequestContext,
  cottageId: number,
  checkIn: string,
  checkOut: string,
  userEmail = 'test@mywave.test'
): Promise<{ booking_id: number; total_price: number }> {
  const resp = await API.createBooking(req, {
    cottage_id: cottageId,
    check_in:   checkIn,
    check_out:  checkOut,
    adults:     2,
    guest_name:  'Test Guest',
    guest_phone: '+375291234567',
    guest_email: userEmail,
  });
  if (resp.status() !== 201) {
    const body = await resp.json();
    throw new Error(`createBooking failed ${resp.status()}: ${JSON.stringify(body)}`);
  }
  return resp.json();
}
