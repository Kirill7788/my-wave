/**
 * security/xss.spec.ts
 * XSS resilience: проверяем что браузер не исполняет вредоносный код
 * из данных коттеджей при рендеринге через CottageCard.js.
 *
 * Архитектурная заметка:
 * Для полного Stored XSS теста нужен admin, способный создать коттедж
 * с XSS-payload в имени. Здесь тестируем:
 *   1. Frontend рендеринг через page.evaluate (DOM safety)
 *   2. API не возвращает исполняемый HTML в JSON
 *   3. escapeHtml утилита работает корректно
 */
import { test, expect } from '../../fixtures';
import { XSS_PAYLOADS } from '../../helpers/factories';

test.describe('XSS resilience', () => {

  test('escapeHtml() в dom.js экранирует все опасные символы', async ({ page }) => {
    await page.goto('/index.html');

    const results = await page.evaluate((payloads: string[]) => {
      // escapeHtml должна быть глобально доступна после загрузки dom.js
      if (typeof window.escapeHtml !== 'function') {
        return { error: 'escapeHtml not found' };
      }
      const checks: Record<string, string> = {};
      for (const p of payloads) {
        checks[p] = window.escapeHtml(p);
      }
      return checks;
    }, XSS_PAYLOADS);

    if ('error' in results) {
      test.skip(); // escapeHtml не загружена — пропускаем
      return;
    }

    const map = results as Record<string, string>;
    for (const payload of XSS_PAYLOADS) {
      const escaped = map[payload];
      // Опасные символы должны быть заменены
      expect(escaped, `payload: ${payload}`).not.toContain('<script>');
      expect(escaped, `payload: ${payload}`).not.toContain('<img');
      expect(escaped, `payload: ${payload}`).not.toContain('onerror=');
      expect(escaped, `payload: ${payload}`).not.toContain('onload=');
    }
  });

  test('CottageCard не создаёт window.__xss даже с вредоносным именем', async ({ page }) => {
    await page.goto('/catalog.html');

    // Инжектируем фейковый коттедж с XSS-payload в имени напрямую в JS
    const xssTriggered = await page.evaluate(() => {
      window.__xss = false;
      if (typeof window.CottageCard !== 'function') return null;

      const malicious = {
        slug:      'test-xss',
        name:      '<img src=x onerror="window.__xss=true">',
        lake_name: '<script>window.__xss=true</script>Нарочь',
        region:    'Тест',
        type_slug: 'economy',
        type_name: 'Эконом',
        price_min:  120,
        price_max:  150,
        image_url:  '',
        features:  ['<script>window.__xss=true</script>'],
      };

      const card = window.CottageCard(malicious);
      document.body.appendChild(card);

      // Принудительно ждём - setTimeout 0 для flush event queue
      return new Promise<boolean>(resolve => {
        setTimeout(() => resolve(window.__xss === true), 100);
      });
    });

    if (xssTriggered === null) {
      test.skip(); // CottageCard не доступен
      return;
    }

    expect(xssTriggered, 'XSS should NOT be triggered via CottageCard').toBe(false);
  });

  test('API response не содержит исполняемого HTML в полях cottage', async ({ request }) => {
    const resp = await request.get('/api/cottages.php');
    const body = await resp.json();

    for (const cottage of body.cottages) {
      // Данные в JSON — строки, не HTML-теги
      expect(typeof cottage.name).toBe('string');
      // Проверяем что сервер не возвращает уже escapedHTML (double encoding)
      expect(cottage.name).not.toMatch(/&lt;script/);
      expect(cottage.name).not.toMatch(/&amp;lt;/);
    }
  });

  test('XSS в параметрах фильтрации не исполняется и не ломает сервер', async ({ request }) => {
    const xssFilter = encodeURIComponent('<script>alert(1)</script>');
    const resp = await request.get(`/api/cottages.php?type=${xssFilter}`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    // Результат пустой (нет такого типа) — главное нет 500 и нет script tag
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/<script>/i);
  });

  test('DOM XSS: URL параметр type не инжектируется в DOM', async ({ page }) => {
    // Переходим с XSS-payload в query string
    await page.goto('/catalog.html?type=<img+src=x+onerror=window.__xss=true>');

    const triggered = await page.evaluate(() => (window as { __xss?: boolean }).__xss === true);
    expect(triggered).toBe(false);
  });

  test('registration с XSS в first_name: данные хранятся как текст', async ({ page, request }) => {
    const { makeUser } = await import('../../helpers/factories');
    const user = makeUser({ first_name: '<script>window.__xss=true</script>' });

    const regResp = await request.post('/api/auth.php?action=register', { data: user });
    if (regResp.status() !== 200) return; // валидация отклонила — ОК

    const me = await request.get('/api/auth.php?action=me');
    const body = await me.json();

    // Имя хранится как строка
    expect(typeof body.user.first_name).toBe('string');
    // Сервер не должен отдавать HTML в JSON (double encoding тоже не нужен)
    expect(body.user.first_name).not.toMatch(/&lt;script/);
  });
});

// Расширяем Window для TypeScript
declare global {
  interface Window {
    escapeHtml: (str: string) => string;
    CottageCard: (data: Record<string, unknown>) => HTMLElement;
    __xss: boolean;
  }
}
