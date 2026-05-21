/**
 * security/headers.spec.ts
 * Проверка HTTP security headers на всех API endpoints.
 */
import { test, expect } from '../../fixtures';

const ENDPOINTS = [
  '/api/auth.php?action=me',
  '/api/cottages.php',
  '/api/bookings.php',
  '/api/cards.php',
];

test.describe('Security headers', () => {

  for (const endpoint of ENDPOINTS) {
    test(`${endpoint} sets X-Content-Type-Options: nosniff`, async ({ anonRequest }) => {
      const resp = await anonRequest.get(endpoint);
      const header = resp.headers()['x-content-type-options'];
      expect(header).toMatch(/nosniff/i);
    });

    test(`${endpoint} sets X-Frame-Options: DENY`, async ({ anonRequest }) => {
      const resp = await anonRequest.get(endpoint);
      const header = resp.headers()['x-frame-options'];
      expect(header).toMatch(/DENY/i);
    });

    test(`${endpoint} sets Referrer-Policy`, async ({ anonRequest }) => {
      const resp = await anonRequest.get(endpoint);
      const header = resp.headers()['referrer-policy'];
      expect(header).toBeTruthy();
    });

    test(`${endpoint} Content-Type is application/json`, async ({ anonRequest }) => {
      const resp = await anonRequest.get(endpoint);
      expect(resp.headers()['content-type']).toMatch(/application\/json/);
    });
  }

  test('session cookie has HttpOnly flag', async ({ anonRequest }) => {
    const resp = await anonRequest.post('/api/auth.php?action=login', {
      data: { email: 'user@mywave.test', password: 'UserPass123!' },
    });
    const setCookie = resp.headers()['set-cookie'] ?? '';
    expect(setCookie).toMatch(/HttpOnly/i);
  });

  test('session cookie has SameSite=Strict', async ({ anonRequest }) => {
    const resp = await anonRequest.post('/api/auth.php?action=login', {
      data: { email: 'user@mywave.test', password: 'UserPass123!' },
    });
    const setCookie = resp.headers()['set-cookie'] ?? '';
    expect(setCookie).toMatch(/SameSite=Strict/i);
  });

  test('API does not expose PHP version in headers', async ({ anonRequest }) => {
    const resp = await anonRequest.get('/api/cottages.php');
    const xPowered = resp.headers()['x-powered-by'] ?? '';
    // Не должно быть "PHP/8.x.x"
    expect(xPowered).not.toMatch(/PHP/i);
  });

  test('API error response does not expose stack trace', async ({ anonRequest }) => {
    // Специально ломаем запрос
    const resp = await anonRequest.post('/api/auth.php?action=register', {
      data: { email: "' OR 1=1 --", password: 'x', first_name: 'x', phone: 'x' },
    });
    const text = await resp.text();
    // Стектрейс PHP не должен утекать
    expect(text).not.toMatch(/Stack trace/i);
    expect(text).not.toMatch(/Fatal error/i);
    expect(text).not.toMatch(/Uncaught/i);
    expect(text).not.toMatch(/\/home\//i); // путь к файлам
  });

  test('404 for unknown action returns JSON not PHP error page', async ({ anonRequest }) => {
    const resp = await anonRequest.get('/api/auth.php?action=unknown_action_xyz');
    expect(resp.headers()['content-type']).toMatch(/application\/json/);
    const body = await resp.json();
    expect(body).toHaveProperty('error');
  });
});
