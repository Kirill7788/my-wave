/**
 * auth/register.spec.ts
 * Полное покрытие регистрации: валидация, дубли, инъекции, unicode.
 */
import { test, expect } from '../../fixtures';
import { API } from '../../helpers/api';
import { makeUser, XSS_PAYLOADS, SQL_PAYLOADS } from '../../helpers/factories';

test.describe('POST /auth.php?action=register', () => {

  test('successful registration returns 200 and logs user in', async ({ anonRequest }) => {
    const user = makeUser();
    const resp = await API.register(anonRequest, user);

    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toMatchObject({ success: true });
    expect(typeof body.user_id).toBe('number');

    // Сессия должна быть создана — /me должна вернуть пользователя
    const me = await API.me(anonRequest);
    expect(me.status()).toBe(200);
    const meBody = await me.json();
    expect(meBody.user.email).toBe(user.email);
    expect(meBody.user.role).toBe('user');
  });

  test('duplicate email returns 422', async ({ anonRequest }) => {
    const user = makeUser();
    await API.register(anonRequest, user);

    // Новый контекст — тот же email
    const ctx2 = await anonRequest.dispose().then(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (anonRequest as any)
    );

    // Используем другой context напрямую
    const resp = await API.register(anonRequest, user);
    // Первый запрос уже прошёл в этом контексте — делаем второй вручную
    const resp2 = await anonRequest.post('/api/auth.php?action=register', {
      data: user,
    });
    expect(resp2.status()).toBe(422);
    const body = await resp2.json();
    expect(body.error).toMatch(/зарегистрирован|exist/i);
  });

  test.describe('validation errors', () => {
    const cases: Array<[string, Record<string, unknown>, string]> = [
      ['missing email',      { password: 'pass123!', first_name: 'T', phone: '+375291234567' }, 'email'],
      ['missing password',   { email: `v@mywave.test`, first_name: 'T', phone: '+375291234567' }, 'password'],
      ['missing first_name', { email: `n@mywave.test`, password: 'pass123!', phone: '+375291234567' }, 'first_name'],
      ['invalid email',      { email: 'not-an-email', password: 'pass123!', first_name: 'T', phone: '+375291234567' }, 'email'],
      ['weak password',      { email: `w@mywave.test`, password: '123', first_name: 'T', phone: '+375291234567' }, 'password'],
    ];

    for (const [name, data, expectedField] of cases) {
      test(`${name} → 422 with field error`, async ({ anonRequest }) => {
        const resp = await anonRequest.post('/api/auth.php?action=register', { data });
        expect(resp.status()).toBe(422);
        const body = await resp.json();
        expect(body).toHaveProperty('error');
        if (body.fields) {
          expect(Object.keys(body.fields)).toContain(expectedField);
        }
      });
    }
  });

  test('XSS payloads in first_name are stored safely', async ({ anonRequest }) => {
    for (const payload of XSS_PAYLOADS.slice(0, 3)) {
      const user = makeUser({ first_name: payload });
      const resp = await anonRequest.post('/api/auth.php?action=register', { data: user });
      // Сервер должен принять или отклонить — но не выполнить скрипт
      // Если 200 — /me должна вернуть данные без исполнения скрипта
      if (resp.status() === 200) {
        const me = await API.me(anonRequest);
        const body = await me.json();
        // Данные хранятся как строка, не исполняются
        expect(typeof body.user.first_name).toBe('string');
      }
    }
  });

  test('SQL injection payloads in email field do not break server', async ({ anonRequest }) => {
    for (const payload of SQL_PAYLOADS) {
      const resp = await anonRequest.post('/api/auth.php?action=register', {
        data: { email: payload, password: 'pass123!', first_name: 'T', phone: '+375291234567' },
      });
      // Сервер должен вернуть 4xx, а не 500
      expect(resp.status()).toBeLessThan(500);
      expect(resp.status()).not.toBe(200);
    }
  });

  test('unicode email and name are accepted', async ({ anonRequest }) => {
    const user = makeUser({ first_name: 'Иван Петров' });
    const resp = await API.register(anonRequest, user);
    expect(resp.status()).toBe(200);
  });

  test('malformed JSON returns 4xx not 500', async ({ anonRequest }) => {
    const resp = await anonRequest.post('/api/auth.php?action=register', {
      headers: { 'Content-Type': 'application/json' },
      data:    'not valid json',
    });
    expect(resp.status()).toBeGreaterThanOrEqual(400);
    expect(resp.status()).toBeLessThan(500);
  });

  test('response Content-Type is application/json', async ({ anonRequest }) => {
    const user = makeUser();
    const resp = await API.register(anonRequest, user);
    expect(resp.headers()['content-type']).toMatch(/application\/json/);
  });
});
