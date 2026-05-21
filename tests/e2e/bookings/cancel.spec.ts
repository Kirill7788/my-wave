/**
 * bookings/cancel.spec.ts
 * Отмена: IDOR защита, double-cancel, статусные переходы.
 */
import { test, expect } from '../../fixtures';
import { API, bookCottage } from '../../helpers/api';
import { futureDate } from '../../helpers/factories';

const COTTAGE_ID = 4; // zaslavl-econ-1

test.describe('DELETE /bookings.php?id= — cancel booking', () => {

  test('user can cancel their own pending booking', async ({ freshUser }) => {
    const b = await bookCottage(freshUser.request, COTTAGE_ID, futureDate(0), futureDate(3));
    const resp = await API.cancelBooking(freshUser.request, b.booking_id);
    expect(resp.status()).toBe(200);

    // Проверяем статус в списке
    const list = await API.getMyBookings(freshUser.request);
    const body = await list.json();
    const booking = body.bookings.find(
      (bk: { id: number }) => bk.id === b.booking_id
    );
    expect(booking?.status).toBe('cancelled');
  });

  test('double cancel returns error (not 200)', async ({ freshUser }) => {
    const b = await bookCottage(freshUser.request, COTTAGE_ID, futureDate(10), futureDate(14));
    await API.cancelBooking(freshUser.request, b.booking_id);
    const resp2 = await API.cancelBooking(freshUser.request, b.booking_id);
    // Уже отменено — rowCount() = 0 → ошибка
    expect(resp2.status()).not.toBe(200);
  });

  test('IDOR: user cannot cancel another user\'s booking', async ({ playwright }) => {
    // Пользователь A создаёт бронирование
    const ctxA = await playwright.request.newContext({ baseURL: 'http://localhost:8000' });
    const ctxB = await playwright.request.newContext({ baseURL: 'http://localhost:8000' });

    const { makeUser } = await import('../../helpers/factories');
    const userA = makeUser();
    const userB = makeUser();
    await API.register(ctxA, userA);
    await API.register(ctxB, userB);

    const b = await bookCottage(ctxA, COTTAGE_ID, futureDate(20), futureDate(24));

    // Пользователь B пытается отменить бронирование A
    const resp = await API.cancelBooking(ctxB, b.booking_id);
    // Должен получить ошибку — rowCount()=0 → DomainException
    expect(resp.status()).not.toBe(200);

    // Бронирование A остаётся нетронутым
    const list = await API.getMyBookings(ctxA);
    const body = await list.json();
    const stillActive = body.bookings.find(
      (bk: { id: number; status: string }) => bk.id === b.booking_id && bk.status === 'pending'
    );
    expect(stillActive).toBeDefined();

    await ctxA.dispose();
    await ctxB.dispose();
  });

  test('cancel without auth returns 401', async ({ anonRequest, freshUser }) => {
    const b = await bookCottage(freshUser.request, COTTAGE_ID, futureDate(30), futureDate(34));
    const resp = await anonRequest.delete(`/api/bookings.php?id=${b.booking_id}`);
    expect(resp.status()).toBe(401);
  });

  test('cancel nonexistent booking id returns error', async ({ freshUser }) => {
    const resp = await API.cancelBooking(freshUser.request, 999999);
    expect(resp.status()).not.toBe(200);
  });

  test('cancel without id parameter returns error', async ({ freshUser }) => {
    const resp = await freshUser.request.delete('/api/bookings.php');
    expect(resp.status()).toBeGreaterThanOrEqual(400);
  });
});
