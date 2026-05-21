/**
 * auth/password-reset.spec.ts
 * Сброс пароля: валидация, token lifecycle, защита от перебора.
 */
import { test, expect } from '../../fixtures';
import { API } from '../../helpers/api';
import { makeUser } from '../../helpers/factories';

test.describe('Password reset flow', () => {

  test('reset_password returns 200 for valid email (no enumeration)', async ({ anonRequest }) => {
    const resp = await API.resetPassword(anonRequest, 'user@mywave.test');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    // debug_link НЕ должен присутствовать в ответе
    expect(body).not.toHaveProperty('debug_link');
    expect(body).not.toHaveProperty('token');
    expect(body).not.toHaveProperty('link');
  });

  test('reset_password returns 200 for NONEXISTENT email (anti-enumeration)', async ({ anonRequest }) => {
    const resp = await API.resetPassword(anonRequest, 'nobody@nowhere.test');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBe(true);
    // Поведение одинаково — нельзя отличить существующий email от несуществующего
  });

  test('invalid token returns 400', async ({ anonRequest }) => {
    const resp = await API.confirmReset(anonRequest, {
      token:        'faketoken1234567890',
      new_password: 'NewPass123!',
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.error).toBeTruthy();
  });

  test('tampered token returns 400', async ({ anonRequest }) => {
    // Тот же токен с изменённым символом
    const resp = await API.confirmReset(anonRequest, {
      token:        'a'.repeat(64), // 64 hex chars but all 'a'
      new_password: 'NewPass123!',
    });
    expect(resp.status()).toBe(400);
  });

  test('update_password without current_password returns 422', async ({ userRequest }) => {
    const resp = await userRequest.post('/api/auth.php?action=update_password', {
      data: { new_password: 'NewPass123!' }, // нет current_password
    });
    expect(resp.status()).toBe(422);
  });

  test('update_password with wrong current_password returns 403', async ({ userRequest }) => {
    const resp = await API.updatePassword(userRequest, {
      current_password: 'WrongCurrentPass!',
      new_password:     'NewPass123!',
    });
    expect(resp.status()).toBe(403);
    const body = await resp.json();
    expect(body.error).toBeTruthy();
  });

  test('update_password with correct current_password succeeds', async ({ playwright }) => {
    // Создаём свежего пользователя чтобы не сломать глобальный USER
    const ctx   = await playwright.request.newContext({ baseURL: 'http://localhost:8000' });
    const user  = makeUser();
    await API.register(ctx, user);

    const resp = await API.updatePassword(ctx, {
      current_password: user.password,
      new_password:     'NewStrong456!',
    });
    expect(resp.status()).toBe(200);

    // Старый пароль больше не работает
    const ctx2 = await playwright.request.newContext({ baseURL: 'http://localhost:8000' });
    const old  = await API.login(ctx2, user.email, user.password);
    expect(old.status()).toBe(401);

    // Новый работает
    const newLogin = await API.login(ctx2, user.email, 'NewStrong456!');
    expect(newLogin.status()).toBe(200);

    await ctx.dispose();
    await ctx2.dispose();
  });

  test('reset_password response does not leak reset link in body', async ({ anonRequest }) => {
    const resp = await API.resetPassword(anonRequest, 'user@mywave.test');
    const text = await resp.text();
    expect(text).not.toMatch(/reset-password/i);
    expect(text).not.toMatch(/token=/i);
    expect(text).not.toMatch(/localhost/i);
  });
});
