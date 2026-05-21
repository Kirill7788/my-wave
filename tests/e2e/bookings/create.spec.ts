/**
 * bookings/create.spec.ts
 * Создание бронирования: happy path, валидация, конфликты дат, вместимость.
 */
import { test, expect } from '../../fixtures';
import { API, bookCottage } from '../../helpers/api';
import { makeBooking, futureDate } from '../../helpers/factories';

const COTTAGE_ID = 1; // naroch-econ-1, capacity=4, price_min=120

test.describe('POST /bookings.php — create booking', () => {

  test('valid booking returns 201 with booking_id and total_price', async ({ freshUser }) => {
    const data = makeBooking({
      cottage_id: COTTAGE_ID,
      check_in:   futureDate(0),
      check_out:  futureDate(3),
    });

    const resp = await API.createBooking(freshUser.request, data);
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body.success).toBe(true);
    expect(typeof body.booking_id).toBe('number');
    expect(body.booking_id).toBeGreaterThan(0);
    // 120 BYN × 3 ночи = 360
    expect(body.total_price).toBe(360);
  });

  test('booking appears in /me bookings list after creation', async ({ freshUser }) => {
    const checkIn  = futureDate(10);
    const checkOut = futureDate(14);
    await bookCottage(freshUser.request, COTTAGE_ID, checkIn, checkOut, freshUser.creds.email);

    const resp = await API.getMyBookings(freshUser.request);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    const found = body.bookings.find(
      (b: { check_in: string; check_out: string }) =>
        b.check_in === checkIn && b.check_out === checkOut
    );
    expect(found).toBeDefined();
    expect(found.status).toBe('pending');
  });

  test('overlapping dates return 409', async ({ freshUser }) => {
    const checkIn  = futureDate(20);
    const checkOut = futureDate(25);

    // Первое бронирование
    await bookCottage(freshUser.request, COTTAGE_ID, checkIn, checkOut);

    // Второе с теми же датами
    const resp = await API.createBooking(freshUser.request, makeBooking({
      cottage_id: COTTAGE_ID,
      check_in:   checkIn,
      check_out:  checkOut,
    }));
    expect(resp.status()).toBe(409);
    const body = await resp.json();
    expect(body.error).toMatch(/даты|заняты|занят/i);
  });

  test.describe('edge overlap cases', () => {

    test('partial overlap from left returns 409', async ({ freshUser }) => {
      // Занято: [30..35], пытаемся: [28..32]
      await bookCottage(freshUser.request, COTTAGE_ID, futureDate(30), futureDate(35));
      const resp = await API.createBooking(freshUser.request, makeBooking({
        cottage_id: COTTAGE_ID, check_in: futureDate(28), check_out: futureDate(32),
      }));
      expect(resp.status()).toBe(409);
    });

    test('partial overlap from right returns 409', async ({ freshUser }) => {
      // Занято: [40..45], пытаемся: [43..48]
      await bookCottage(freshUser.request, COTTAGE_ID, futureDate(40), futureDate(45));
      const resp = await API.createBooking(freshUser.request, makeBooking({
        cottage_id: COTTAGE_ID, check_in: futureDate(43), check_out: futureDate(48),
      }));
      expect(resp.status()).toBe(409);
    });

    test('contained overlap returns 409', async ({ freshUser }) => {
      // Занято: [50..60], пытаемся: [52..55]
      await bookCottage(freshUser.request, COTTAGE_ID, futureDate(50), futureDate(60));
      const resp = await API.createBooking(freshUser.request, makeBooking({
        cottage_id: COTTAGE_ID, check_in: futureDate(52), check_out: futureDate(55),
      }));
      expect(resp.status()).toBe(409);
    });

    test('adjacent dates (checkout = next checkin) do NOT conflict', async ({ freshUser }) => {
      // Занято: [65..70], пытаемся: [70..75] — checkout одного = checkin другого
      await bookCottage(freshUser.request, COTTAGE_ID, futureDate(65), futureDate(70));
      const resp = await API.createBooking(freshUser.request, makeBooking({
        cottage_id: COTTAGE_ID, check_in: futureDate(70), check_out: futureDate(75),
      }));
      // Должно пройти — это стандартная граничная дата
      expect(resp.status()).toBe(201);
    });

    test('cancelled booking does not block new booking for same dates', async ({ freshUser }) => {
      const checkIn  = futureDate(80);
      const checkOut = futureDate(85);

      // Бронируем
      const b = await bookCottage(freshUser.request, COTTAGE_ID, checkIn, checkOut);
      // Отменяем
      await API.cancelBooking(freshUser.request, b.booking_id);

      // Снова те же даты — должно пройти
      const resp = await API.createBooking(freshUser.request, makeBooking({
        cottage_id: COTTAGE_ID, check_in: checkIn, check_out: checkOut,
      }));
      expect(resp.status()).toBe(201);
    });
  });

  test.describe('validation errors', () => {

    test('check_in in the past returns 422', async ({ freshUser }) => {
      const resp = await API.createBooking(freshUser.request, makeBooking({
        check_in:  '2020-01-01',
        check_out: '2020-01-05',
      }));
      expect(resp.status()).toBe(422);
    });

    test('check_out before check_in returns 422', async ({ freshUser }) => {
      const resp = await API.createBooking(freshUser.request, makeBooking({
        check_in:  futureDate(5),
        check_out: futureDate(3),
      }));
      expect(resp.status()).toBe(422);
    });

    test('same day check_in and check_out returns 422', async ({ freshUser }) => {
      const day = futureDate(5);
      const resp = await API.createBooking(freshUser.request, makeBooking({
        check_in:  day,
        check_out: day,
      }));
      expect(resp.status()).toBe(422);
    });

    test('exceeding capacity returns 422', async ({ freshUser }) => {
      // naroch-econ-1: capacity=4, пробуем 5 взрослых
      const resp = await API.createBooking(freshUser.request, makeBooking({
        adults:   5,
        children: 0,
      }));
      expect(resp.status()).toBe(422);
      const body = await resp.json();
      expect(body.error).toMatch(/вместим|капасити|capacity/i);
    });

    test('nonexistent cottage_id returns 400/404', async ({ freshUser }) => {
      const resp = await API.createBooking(freshUser.request, makeBooking({
        cottage_id: 99999,
      }));
      expect([400, 404]).toContain(resp.status());
    });

    test('invalid date format returns 422', async ({ freshUser }) => {
      const resp = await API.createBooking(freshUser.request, makeBooking({
        check_in:  'not-a-date',
        check_out: '2027-09-10',
      }));
      expect(resp.status()).toBe(422);
    });

    test('missing required fields returns 422', async ({ freshUser }) => {
      const resp = await freshUser.request.post('/api/bookings.php', {
        data: { cottage_id: COTTAGE_ID }, // нет дат, гостей
      });
      expect(resp.status()).toBe(422);
    });
  });

  test('total_price calculation: price_min × nights', async ({ freshUser }) => {
    // naroch-econ-1: price_min = 120
    // 7 ночей → 840 BYN
    const resp = await API.createBooking(freshUser.request, makeBooking({
      cottage_id: COTTAGE_ID,
      check_in:   futureDate(100),
      check_out:  futureDate(107),
    }));
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    expect(body.total_price).toBe(840);
  });
});
