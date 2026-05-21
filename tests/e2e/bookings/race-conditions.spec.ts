/**
 * bookings/race-conditions.spec.ts
 * ══════════════════════════════════════════════════════════════════════════════
 * КРИТИЧЕСКИЙ МОДУЛЬ: проверка SELECT FOR UPDATE + транзакция в createWithLock.
 *
 * Тесты запускать с --workers=1 чтобы все конкурентные запросы шли в рамках
 * одного воркера (реальный параллелизм через Promise.all).
 * Команда: npm run test:race
 * ══════════════════════════════════════════════════════════════════════════════
 */
import { test, expect } from '../../fixtures';
import { API } from '../../helpers/api';
import { makeUser, makeBooking, futureDate } from '../../helpers/factories';

const COTTAGE_ID = 2; // braslav-econ-1 — отдельный коттедж для race тестов

/** Создаёт N независимых авторизованных request-контекстов. */
async function createAuthContexts(
  playwright: import('@playwright/test').PlaywrightWorkerArgs['playwright'],
  n: number
): Promise<import('@playwright/test').APIRequestContext[]> {
  const contexts = await Promise.all(
    Array.from({ length: n }, async () => {
      const ctx  = await playwright.request.newContext({ baseURL: 'http://localhost:8000' });
      const user = makeUser();
      await API.register(ctx, user);
      return ctx;
    })
  );
  return contexts;
}

async function disposeAll(contexts: import('@playwright/test').APIRequestContext[]) {
  await Promise.all(contexts.map(c => c.dispose().catch(() => {})));
}

test.describe('Race conditions — BookingRepository::createWithLock()', () => {

  test('2 concurrent requests for same dates: exactly 1 succeeds, 1 gets 409', async ({ playwright }) => {
    await test.step('setup: create 2 users', async () => {});

    const [ctx1, ctx2] = await createAuthContexts(playwright, 2);
    const checkIn  = futureDate(200);
    const checkOut = futureDate(204);

    const booking = makeBooking({ cottage_id: COTTAGE_ID, check_in: checkIn, check_out: checkOut });

    await test.step('fire 2 concurrent booking requests', async () => {});

    const [r1, r2] = await Promise.all([
      API.createBooking(ctx1, booking),
      API.createBooking(ctx2, booking),
    ]);

    const statuses = [r1.status(), r2.status()].sort();

    await test.step('assert: exactly one 201 and one 409', async () => {
      expect(statuses).toEqual([201, 409]);
    });

    await disposeAll([ctx1, ctx2]);
  });

  test('5 concurrent requests for same dates: exactly 1 succeeds', async ({ playwright }) => {
    const N = 5;
    const contexts = await createAuthContexts(playwright, N);

    const checkIn  = futureDate(210);
    const checkOut = futureDate(215);
    const booking  = makeBooking({ cottage_id: COTTAGE_ID, check_in: checkIn, check_out: checkOut });

    const responses = await Promise.all(
      contexts.map(ctx => API.createBooking(ctx, booking))
    );

    const statuses    = responses.map(r => r.status());
    const successCount = statuses.filter(s => s === 201).length;
    const conflictCount = statuses.filter(s => s === 409).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(N - 1);

    // Нет 500 — транзакция должна откатываться чисто, без DB ошибок
    const serverErrors = statuses.filter(s => s >= 500);
    expect(serverErrors).toHaveLength(0);

    await disposeAll(contexts);
  });

  test('no duplicate bookings in DB after concurrent requests', async ({ playwright }) => {
    const N = 4;
    const contexts = await createAuthContexts(playwright, N);

    const checkIn  = futureDate(220);
    const checkOut = futureDate(224);
    const booking  = makeBooking({ cottage_id: COTTAGE_ID, check_in: checkIn, check_out: checkOut });

    await Promise.all(contexts.map(ctx => API.createBooking(ctx, booking)));

    // Получаем бронирования всех пользователей — суммарно должно быть ровно 1 активное
    const allBookings: unknown[] = [];
    for (const ctx of contexts) {
      const resp = await API.getMyBookings(ctx);
      const body = await resp.json();
      const match = (body.bookings as Array<{
        check_in: string; check_out: string; cottage_id: number; status: string;
      }>).filter(
        b => b.check_in === checkIn &&
             b.check_out === checkOut &&
             b.cottage_id === COTTAGE_ID &&
             b.status !== 'cancelled'
      );
      allBookings.push(...match);
    }

    // Ровно одно активное бронирование — гарантия транзакционной целостности
    expect(allBookings).toHaveLength(1);

    await disposeAll(contexts);
  });

  test('different cottages can be booked concurrently without conflict', async ({ playwright }) => {
    const [ctx1, ctx2] = await createAuthContexts(playwright, 2);
    const checkIn  = futureDate(230);
    const checkOut = futureDate(234);

    // Разные коттеджи — оба должны пройти
    const [r1, r2] = await Promise.all([
      API.createBooking(ctx1, makeBooking({ cottage_id: 1, check_in: checkIn, check_out: checkOut })),
      API.createBooking(ctx2, makeBooking({ cottage_id: 3, check_in: checkIn, check_out: checkOut })),
    ]);

    expect(r1.status()).toBe(201);
    expect(r2.status()).toBe(201);

    await disposeAll([ctx1, ctx2]);
  });

  test('retry storm: 10 rapid retries from one user do not create duplicates', async ({ freshUser }) => {
    const checkIn  = futureDate(240);
    const checkOut = futureDate(244);
    const booking  = makeBooking({ cottage_id: COTTAGE_ID, check_in: checkIn, check_out: checkOut });

    // Симулируем клиента который агрессивно ретраит
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => API.createBooking(freshUser.request, booking))
    );

    const successCount = responses.filter(r => r.status() === 201).length;
    expect(successCount).toBe(1);

    const bookings = await API.getMyBookings(freshUser.request);
    const body = await bookings.json();
    const active = body.bookings.filter(
      (b: { check_in: string; check_out: string; status: string }) =>
        b.check_in === checkIn && b.check_out === checkOut && b.status !== 'cancelled'
    );
    expect(active).toHaveLength(1);
  });

  test('transaction rollback: server error does not leave partial booking', async ({ freshUser }) => {
    // Невалидные данные — транзакция должна откатиться
    const resp = await freshUser.request.post('/api/bookings.php', {
      data: {
        cottage_id:  COTTAGE_ID,
        check_in:    futureDate(250),
        check_out:   futureDate(254),
        adults:      999, // превышение вместимости — rollback
        guest_name:  'Test',
        guest_phone: '+375291234567',
        guest_email: `t@mywave.test`,
      },
    });
    // Должен вернуть ошибку
    expect(resp.status()).not.toBe(201);

    // Список бронирований не должен содержать эту запись
    const list = await API.getMyBookings(freshUser.request);
    const body = await list.json();
    const found = body.bookings.find(
      (b: { check_in: string }) => b.check_in === futureDate(250)
    );
    expect(found).toBeUndefined();
  });
});
