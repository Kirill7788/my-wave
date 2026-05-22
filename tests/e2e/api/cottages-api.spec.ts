/**
 * api/cottages-api.spec.ts
 * Полное API-покрытие endpoint коттеджей: листинг, фильтры, slug, admin CRUD.
 */
import { test, expect } from '../../fixtures';
import { API } from '../../helpers/api';

test.describe('GET /cottages.php', () => {

  test('returns array of cottages with correct shape', async ({ anonRequest }) => {
    const resp = await API.getCottages(anonRequest);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(Array.isArray(body.cottages)).toBe(true);
    expect(body.cottages.length).toBeGreaterThan(0);

    const c = body.cottages[0];
    expect(c).toHaveProperty('id');
    expect(c).toHaveProperty('slug');
    expect(c).toHaveProperty('name');
    expect(c).toHaveProperty('price_min');
    expect(c).toHaveProperty('price_max');
    expect(c).toHaveProperty('lake_name');
    expect(c).toHaveProperty('type_name');
    expect(Array.isArray(c.features)).toBe(true);
  });

  test('filter by type=economy returns only economy cottages', async ({ anonRequest }) => {
    const resp = await API.getCottages(anonRequest, { type: 'economy' });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.cottages.every((c: { type_slug: string }) => c.type_slug === 'economy')).toBe(true);
  });

  test('filter by type=comfort returns only comfort cottages', async ({ anonRequest }) => {
    const resp = await API.getCottages(anonRequest, { type: 'comfort' });
    const body = await resp.json();
    expect(body.cottages.every((c: { type_slug: string }) => c.type_slug === 'comfort')).toBe(true);
  });

  test('filter by lake=naroch returns only naroch cottages', async ({ anonRequest }) => {
    const resp = await API.getCottages(anonRequest, { lake: 'naroch' });
    const body = await resp.json();
    expect(body.cottages.length).toBeGreaterThan(0);
    expect(body.cottages.every((c: { lake_slug: string }) => c.lake_slug === 'naroch')).toBe(true);
  });

  test('filter by min_price excludes cheaper cottages', async ({ anonRequest }) => {
    const resp = await API.getCottages(anonRequest, { min_price: '200' });
    const body = await resp.json();
    // price_max должен быть >= 200 для каждого результата
    expect(
      body.cottages.every((c: { price_max: number }) => Number(c.price_max) >= 200)
    ).toBe(true);
  });

  test('filter by max_price excludes expensive cottages', async ({ anonRequest }) => {
    const resp = await API.getCottages(anonRequest, { max_price: '150' });
    const body = await resp.json();
    expect(
      body.cottages.every((c: { price_min: number }) => Number(c.price_min) <= 150)
    ).toBe(true);
  });

  test('combined filters type+lake return correct subset', async ({ anonRequest }) => {
    const resp = await API.getCottages(anonRequest, { type: 'premium', lake: 'naroch' });
    const body = await resp.json();
    expect(body.cottages.every(
      (c: { type_slug: string; lake_slug: string }) =>
        c.type_slug === 'premium' && c.lake_slug === 'naroch'
    )).toBe(true);
  });

  test('has_bath=1 filter returns only cottages with bath/sauna', async ({ anonRequest }) => {
    const resp = await API.getCottages(anonRequest, { has_bath: '1' });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    // Все коттеджи должны иметь Баня или Сауна в features
    for (const c of body.cottages) {
      const hasBath = (c.features as string[]).some(
        (f: string) => f.includes('Баня') || f.includes('Сауна')
      );
      expect(hasBath, `cottage "${c.name}" has no bath/sauna`).toBe(true);
    }
  });

  test('limit parameter restricts result count', async ({ anonRequest }) => {
    const resp = await API.getCottages(anonRequest, { limit: '3' });
    const body = await resp.json();
    expect(body.cottages.length).toBeLessThanOrEqual(3);
  });

  test('nonexistent type returns empty array not error', async ({ anonRequest }) => {
    const resp = await API.getCottages(anonRequest, { type: 'nonexistent-type' });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.cottages).toHaveLength(0);
  });

  test('response does not expose internal DB fields', async ({ anonRequest }) => {
    const resp = await API.getCottages(anonRequest);
    const body = await resp.json();
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/lake_id/);
    expect(raw).not.toMatch(/type_id/);
    expect(raw).not.toMatch(/deleted_at/);
  });
});

test.describe('GET /cottages.php?slug=', () => {

  test('valid slug returns single cottage', async ({ anonRequest }) => {
    const resp = await API.getCottageBySlug(anonRequest, 'naroch-econ-1');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.cottage.slug).toBe('naroch-econ-1');
    expect(body.cottage.lake_slug).toBe('naroch');
    expect(body.cottage.type_slug).toBe('economy');
  });

  test('nonexistent slug returns 404', async ({ anonRequest }) => {
    const resp = await API.getCottageBySlug(anonRequest, 'does-not-exist');
    expect(resp.status()).toBe(404);
  });

  test('SQL injection in slug parameter does not break server', async ({ anonRequest }) => {
    const resp = await API.getCottageBySlug(anonRequest, "' OR 1=1 --");
    expect(resp.status()).toBeLessThan(500);
    expect(resp.status()).toBe(404);
  });
});

test.describe('Admin CRUD — /cottages.php (POST/PUT/DELETE)', () => {

  test('non-admin DELETE returns 403', async ({ userRequest }) => {
    const resp = await userRequest.delete('/api/cottages.php?id=1');
    expect(resp.status()).toBe(403);
  });

  test('non-admin POST returns 403', async ({ userRequest }) => {
    const resp = await userRequest.post('/api/cottages.php', {
      data: { name: 'Hack', lake_slug: 'naroch', type_slug: 'economy',
              price_min: 100, price_max: 200, capacity: 4 },
    });
    expect(resp.status()).toBe(403);
  });

  test('unsupported method returns 405', async ({ anonRequest }) => {
    const resp = await anonRequest.patch('/api/cottages.php');
    expect(resp.status()).toBe(405);
  });
});
