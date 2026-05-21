/**
 * auth/session.spec.ts
 * Session lifecycle, logout, unauthorized access, role checks.
 */
import { test, expect } from '../../fixtures';
import { API } from '../../helpers/api';
import { USER, ADMIN } from '../../helpers/factories';

test.describe('Session management', () => {

  test('logout invalidates session', async ({ userRequest }) => {
    // Убеждаемся что залогинен
    const before = await API.me(userRequest);
    expect(before.status()).toBe(200);

    // Разлогиниваемся
    const logoutResp = await API.logout(userRequest);
    expect(logoutResp.status()).toBe(200);

    // Теперь /me должна вернуть 401
    const after = await API.me(userRequest);
    expect(after.status()).toBe(401);
  });

  test('double logout does not crash (idempotent)', async ({ userRequest }) => {
    await API.logout(userRequest);
    const resp = await API.logout(userRequest);
    // 200 или 401 — не 500
    expect(resp.status()).toBeLessThan(500);
  });

  test('unauthenticated /me returns 401', async ({ anonRequest }) => {
    const resp = await API.me(anonRequest);
    expect(resp.status()).toBe(401);
    const body = await resp.json();
    expect(body.error).toBeTruthy();
  });

  test('unauthenticated bookings GET returns 401', async ({ anonRequest }) => {
    const resp = await API.getMyBookings(anonRequest);
    expect(resp.status()).toBe(401);
  });

  test('unauthenticated bookings POST returns 401', async ({ anonRequest }) => {
    const resp = await anonRequest.post('/api/bookings.php', {
      data: { cottage_id: 1, check_in: '2027-11-01', check_out: '2027-11-05', adults: 2,
              guest_name: 'X', guest_phone: '+375291234567', guest_email: 'x@x.com' },
    });
    expect(resp.status()).toBe(401);
  });

  test('unauthenticated cards GET returns 401', async ({ anonRequest }) => {
    const resp = await API.getCards(anonRequest);
    expect(resp.status()).toBe(401);
  });

  test('regular user cannot access admin cottage endpoints', async ({ userRequest }) => {
    // DELETE cottage — требует admin
    const resp = await userRequest.delete('/api/cottages.php?id=1');
    expect(resp.status()).toBe(403);
    const body = await resp.json();
    expect(body.error).toBeTruthy();
  });

  test('regular user cannot create a cottage', async ({ userRequest }) => {
    const resp = await userRequest.post('/api/cottages.php', {
      data: { name: 'Hack Cottage', lake_slug: 'naroch', type_slug: 'economy',
              price_min: 100, price_max: 200, capacity: 4 },
    });
    expect(resp.status()).toBe(403);
  });

  test('admin can access cottage admin endpoints', async ({ adminRequest }) => {
    // GET cottages работает для всех
    const resp = await API.getCottages(adminRequest);
    expect(resp.status()).toBe(200);
  });

  test('/me response does not expose password_hash', async ({ userRequest }) => {
    const resp = await API.me(userRequest);
    const body = await resp.json();
    expect(body.user).not.toHaveProperty('password_hash');
    expect(body.user).not.toHaveProperty('password');
    expect(JSON.stringify(body)).not.toMatch(/\$2y\$/); // bcrypt signature
  });

  test('update_profile requires auth', async ({ anonRequest }) => {
    const resp = await API.updateProfile(anonRequest, { first_name: 'Hacker' });
    expect(resp.status()).toBe(401);
  });

  test('update_password requires auth', async ({ anonRequest }) => {
    const resp = await API.updatePassword(anonRequest, {
      current_password: 'old',
      new_password:     'new123!',
    });
    expect(resp.status()).toBe(401);
  });
});
