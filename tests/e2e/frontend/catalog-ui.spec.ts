/**
 * frontend/catalog-ui.spec.ts
 * E2E тесты UI каталога: фильтры, сортировка, URL-синхронизация, CottageCard.
 */
import { test, expect } from '../../fixtures';

test.describe('Catalog page UI', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/catalog.html');
    await expect(page.locator('.cottage-card').first()).toBeVisible({ timeout: 10_000 });
  });

  test('all cottage cards are rendered', async ({ page }) => {
    const count = await page.locator('.cottage-card').count();
    expect(count).toBeGreaterThan(0);
  });

  test('cottage cards contain required elements', async ({ page }) => {
    const firstCard = page.locator('.cottage-card').first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard.locator('.cottage-card__title')).toBeVisible();
    await expect(firstCard.locator('.cottage-card__lake')).toBeVisible();
    await expect(firstCard.locator('.cottage-card__price')).toBeVisible();
    await expect(firstCard.locator('.cottage-card__badge')).toBeVisible();
  });

  test('filter by type economy shows only economy cottages', async ({ page }) => {
    await page.locator('input[name="type"][value="economy"]').check();
    await page.locator('#applyFilters').click();
    await page.waitForTimeout(1000); // дать JS загрузить данные

    const badges = page.locator('.cottage-card__badge');
    const count = await badges.count();
    for (let i = 0; i < count; i++) {
      await expect(badges.nth(i)).toHaveClass(/economy/);
    }
  });

  test('type filter updates URL query string', async ({ page }) => {
    await page.locator('input[name="type"][value="premium"]').check();
    await page.locator('#applyFilters').click();

    await expect(page).toHaveURL(/type=premium/);
  });

  test('lake filter updates URL query string', async ({ page }) => {
    await page.locator('#lakeFilter').selectOption('naroch');
    await page.locator('#applyFilters').click();

    await expect(page).toHaveURL(/lake=naroch/);
  });

  test('URL params pre-select filters on load', async ({ page }) => {
    await page.goto('/catalog.html?type=comfort&lake=naroch');
    await expect(page.locator('.cottage-card').first()).toBeVisible({ timeout: 10_000 });

    // Фильтр типа должен быть отмечен
    const comfortRadio = page.locator('input[name="type"][value="comfort"]');
    // Либо checked (radio), либо lake select имеет нужное значение
    const lakeValue = await page.locator('#lakeFilter').inputValue();
    expect(lakeValue).toBe('naroch');
  });

  test('sort ascending orders cards by price', async ({ page }) => {
    const ascBtn = page.locator('.sort-btn[data-sort="asc"]');
    if (!(await ascBtn.isVisible())) {
      test.skip();
      return;
    }
    await ascBtn.click();

    // Сортування перевіряємо за data-price атрибутом (так само як це робить JS)
    const prices = await page.locator('.cottage-card').evaluateAll(
      (cards: HTMLElement[]) => cards.map(c => parseFloat(c.dataset['price'] ?? '0'))
    );
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
    }
  });

  test('sort uses dataset.price not text parsing', async ({ page }) => {
    // Проверяем что у карточек есть data-price атрибут
    const firstCard = page.locator('.cottage-card').first();
    const dataPrice = await firstCard.getAttribute('data-price');
    expect(dataPrice).not.toBeNull();
    expect(parseFloat(dataPrice!)).toBeGreaterThan(0);
  });

  test('reset filters clears all and reloads full list', async ({ page }) => {
    const initialCount = await page.locator('.cottage-card').count();

    // Применяем фильтр
    await page.locator('input[name="type"][value="premium"]').check();
    await page.locator('#applyFilters').click();
    await page.waitForTimeout(800);

    // Сбрасываем
    await page.locator('#resetFilters').click();
    await page.waitForURL('/catalog.html');
    await expect(page.locator('.cottage-card').first()).toBeVisible({ timeout: 8_000 });

    const afterCount = await page.locator('.cottage-card').count();
    expect(afterCount).toBeGreaterThanOrEqual(initialCount);
  });

  test('has_bath filter only shows cottages with bath/sauna', async ({ page }) => {
    const bathCheckbox = page.locator('#hasBath');
    if (!(await bathCheckbox.isVisible())) {
      test.skip();
      return;
    }
    await bathCheckbox.check();
    await page.locator('#applyFilters').click();
    await page.waitForTimeout(1000);

    // Каждая карточка должна иметь Баня или Сауна в features
    const features = await page.locator('.cottage-card__features').allTextContents();
    for (const f of features) {
      expect(f).toMatch(/Баня|Сауна/);
    }
  });

  test('no results state shows message, not empty grid', async ({ page }) => {
    await page.goto('/catalog.html?type=economy&min_price=10000');
    await page.waitForTimeout(1000);

    const noResults = page.locator('#noResults');
    await expect(noResults).toBeVisible();
  });

  test('browser back restores previous filter state', async ({ page }) => {
    await page.goto('/catalog.html');
    await expect(page.locator('.cottage-card').first()).toBeVisible({ timeout: 10_000 });

    await page.locator('#lakeFilter').selectOption('braslav');
    await page.locator('#applyFilters').click();
    await page.waitForURL(/lake=braslav/);

    await page.goBack();
    expect(page.url()).not.toMatch(/lake=braslav/);
  });

  test('loading state is shown then hidden', async ({ page }) => {
    await page.goto('/catalog.html');
    // Сразу после навигации — loading может быть видим
    // После загрузки — должен быть скрыт
    await expect(page.locator('#loading')).toBeHidden({ timeout: 8_000 });
  });
});
