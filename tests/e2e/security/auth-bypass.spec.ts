/**
 * security/auth-bypass.spec.ts
 * Попытки обхода авторизации, привилегий, IDOR.
 */
import { test, expect } from '../../fixtures';
import { API, bookCottage } from '../../helpers/api';
import { makeUser, futureDate, SQL_PAYLOADS } from '../../helpers/factories';

test.describe('Auth bypass attempts', () => {

  test('forged session cookie does not grant access', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({
      baseURL: 'http://localhost:8000',
      extraHTTPHeaders: {
        // Поддельный session cookie
        'Cookie': 'PHPSESSID=fakeSessionId12345678901234567890',
      },
    });

    const resp = await API.me(ctx);
    expect(resp.status()).toBe(401);
    await ctx.dispose();
  });

  test('manipulated user_id in session does not expose other user data', async ({ playwright }) => {
    // Нет возможности напрямую подделать сессию без доступа к серверу
    // Тест: /me возвращает только СВОИ данные
    const ctx1 = await playwright.request.newContext({ baseURL: 'http://localhost:8000' });
    const ctx2 = await playwright.request.newContext({ baseURL: 'http://localhost:8000' });

    const u1 = makeUser();
    const u2 = makeUser();
    await API.register(ctx1, u1);
    await API.register(ctx2, u2);

    const me1 = await API.me(ctx1);
    const me2 = await API.me(ctx2);
    const body1 = await me1.json();
    const body2 = await me2.json();

    // Каждый видит только себя
    expect(body1.user.email).toBe(u1.email);
    expect(body2.user.email).toBe(u2.email);
    expect(body1.user.email).not.toBe(body2.user.email);

    await ctx1.dispose();
    await ctx2.dispose();
  });

  test('privilege escalation: cannot set own role to admin via update_profile', async ({ freshUser }) => {
    // update_profile принимает first_name, last_name, phone — не role
    const resp = await API.updateProfile(freshUser.request, {
      first_name: 'hacker',
      // @ts-expect-error intentional test
      role: 'admin',
    });
    // Должен вернуть 200 (обновление профиля), но role НЕ должна смениться
    if (resp.status() === 200) {
      const me = await API.me(freshUser.request);
      const body = await me.json();
      expect(body.user.role).toBe('user');
    }
  });

  test('SQL injection in login email does not bypass auth', async ({ anonRequest }) => {
    for (const payload of SQL_PAYLOADS) {
      const resp = await API.login(anonRequest, payload, 'anything');
      // Должен быть 401 (auth fail) или 422 (validation), НЕ 200
      expect(resp.status()).not.toBe(200);
      expect(resp.status()).toBeLessThan(500);
    }
  });

  test('path traversal in slug does not expose filesystem', async ({ anonRequest }) => {
    const resp = await API.getCottageBySlug(anonRequest, '../../../etc/passwd');
    // 404 (не найден), не 200 с файлом
    expect(resp.status()).toBe(404);
    const text = await resp.text();
    expect(text).not.toMatch(/root:/); // passwd format
  });

  test('HTTP method override headers are ignored', async ({ anonRequest }) => {
    // Попытка переопределить DELETE через X-HTTP-Method-Override
    const resp = await anonRequest.get('/api/cottages.php?id=1', {
      headers: { 'X-HTTP-Method-Override': 'DELETE' },
    });
    // GET не должен выполнять DELETE
    const body = await resp.json();
    // Должен вернуть list, не success от delete
    expect(body).not.toMatchObject({ success: true });
  });

  test('cancel booking with id=0 returns error', async ({ freshUser }) => {
    const resp = await API.cancelBooking(freshUser.request, 0);
    expect(resp.status()).toBeGreaterThanOrEqual(400);
  });

  test('cancel booking with id=-1 returns error', async ({ freshUser }) => {
    const resp = await freshUser.request.delete('/api/bookings.php?id=-1');
    expect(resp.status()).toBeGreaterThanOrEqual(400);
  });

  test('cards: cannot delete another user\'s card', async ({ playwright }) => {
    const { makeUser, makeCard } = await import('../../helpers/factories');
    const ctxA = await playwright.request.newContext({ baseURL: 'http://localhost:8000' });
    const ctxB = await playwright.request.newContext({ baseURL: 'http://localhost:8000' });

    await API.register(ctxA, makeUser());
    await API.register(ctxB, makeUser());

    // A добавляет карту
    await API.addCard(ctxA, makeCard());
    const cardsA = await API.getCards(ctxA);
    const bodyA = await cardsA.json();
    const cardId = bodyA.cards[0]?.id;

    if (cardId) {
      // B пытается удалить карту A
      const resp = await API.deleteCard(ctxB, cardId);
      // rowCount() = 0 → но возможно 200 без side effect
      // Проверяем что карта A не удалена
      const checkA = await API.getCards(ctxA);
      const checkBody = await checkA.json();
      expect(checkBody.cards).toHaveLength(1);
    }

    await ctxA.dispose();
    await ctxB.dispose();
  });
});
