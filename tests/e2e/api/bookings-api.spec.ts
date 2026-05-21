/**
 * api/bookings-api.spec.ts
 * Покрытие bookings API: schema validation, wrong methods, state machine.
 */
import { test, expect } from '../../fixtures';
import { API, bookCottage } from '../../helpers/api';
import { futureDate, makeBooking } from '../../helpers/factories';

const COTTAGE_ID = 5; // lukoml-econ-1

test.describe('Bookings API contract', () => {

  test('GET returns bookings array with correct schema', async ({ freshUser }) => {
    await bookCottage(freshUser.request, COTTAGE_ID, futureDate(0), futureDate(4));

    const resp = await API.getMyBookings(freshUser.request);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(Array.isArray(body.bookings)).toBe(true);

    const b = body.bookings[0];
    expect(b).toHaveProperty('id');
    expect(b).toHaveProperty('check_in');
    expect(b).toHaveProperty('check_out');
    expect(b).toHaveProperty('status');
    expect(b).toHaveProperty('total_price');
    expect(b).toHaveProperty('cottage_name');
    // Чувствительные данные других пользователей не должны утекать
    expect(b).not.toHaveProperty('password_hash');
  });

  test('GET only returns bookings for current user (no IDOR)', async ({ playwright }) => {
    const { makeUser } = await import('../../helpers/factories');
    const ctxA = await playwright.request.newContext({ baseURL: 'http://localhost:8000' });
    const ctxB = await playwright.request.newContext({ baseURL: 'http://localhost:8000' });

    await API.register(ctxA, makeUser());
    await API.register(ctxB, makeUser());

    await bookCottage(ctxA, COTTAGE_ID, futureDate(10), futureDate(14));

    // B видит только свои бронирования (пусто)
    const respB = await API.getMyBookings(ctxB);
    const bodyB = await respB.json();
    expect(bodyB.bookings).toHaveLength(0);

    await ctxA.dispose();
    await ctxB.dispose();
  });

  test('POST with completely empty body returns 422', async ({ freshUser }) => {
    const resp = await freshUser.request.post('/api/bookings.php', { data: {} });
    expect(resp.status()).toBe(422);
  });

  test('POST with invalid JSON returns 4xx not 500', async ({ freshUser }) => {
    const resp = await freshUser.request.post('/api/bookings.php', {
      headers: { 'Content-Type': 'application/json' },
      data:    '{{invalid json',
    });
    expect(resp.status()).toBeGreaterThanOrEqual(400);
    expect(resp.status()).toBeLessThan(500);
  });

  test('PUT method on /bookings.php returns 405', async ({ freshUser }) => {
    const resp = await freshUser.request.put('/api/bookings.php');
    expect(resp.status()).toBe(405);
  });

  test('response shape is consistent between empty and non-empty lists', async ({ freshUser }) => {
    // Пустой список
    const emptyResp = await API.getMyBookings(freshUser.request);
    const emptyBody = await emptyResp.json();
    expect(emptyBody).toHaveProperty('bookings');
    expect(emptyBody.bookings).toHaveLength(0);

    // Не-пустой список
    await bookCottage(freshUser.request, COTTAGE_ID, futureDate(20), futureDate(24));
    const fullResp = await API.getMyBookings(freshUser.request);
    const fullBody = await fullResp.json();
    expect(fullBody).toHaveProperty('bookings');
    expect(fullBody.bookings.length).toBeGreaterThan(0);
  });

  test('bookings are ordered newest first', async ({ freshUser }) => {
    await bookCottage(freshUser.request, COTTAGE_ID, futureDate(30), futureDate(33));
    await bookCottage(freshUser.request, COTTAGE_ID, futureDate(40), futureDate(43));

    const resp = await API.getMyBookings(freshUser.request);
    const body = await resp.json();
    const dates = body.bookings.map((b: { created_at: string }) => b.created_at);
    const sorted = [...dates].sort().reverse();
    expect(dates).toEqual(sorted);
  });

  test('cancelled booking has status=cancelled in response', async ({ freshUser }) => {
    const b = await bookCottage(freshUser.request, COTTAGE_ID, futureDate(50), futureDate(53));
    await API.cancelBooking(freshUser.request, b.booking_id);

    const resp = await API.getMyBookings(freshUser.request);
    const body = await resp.json();
    const cancelled = body.bookings.find(
      (bk: { id: number }) => bk.id === b.booking_id
    );
    expect(cancelled?.status).toBe('cancelled');
  });
});
