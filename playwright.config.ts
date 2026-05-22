import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:8000';
const IS_CI    = !!process.env.CI;

export default defineConfig({
  testDir:    './tests',
  outputDir:  './test-results',

  /* Глобальный таймаут на один тест */
  timeout: 30_000,
  /* Таймаут на expect() */
  expect: { timeout: 8_000 },

  /* Параллелизм: в CI — все процессоры, локально — 4 воркера */
  workers:     IS_CI ? '50%' : 4,
  fullyParallel: true,

  /* Повторы при падении */
  retries: IS_CI ? 2 : 0,

  /* Репортеры */
  reporter: IS_CI
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'on-failure' }]],

  /* Глобальный setup/teardown */
  globalSetup:    './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',

  use: {
    baseURL: BASE_URL,

    /* Все запросы идут с credentials */
    extraHTTPHeaders: { 'Accept': 'application/json' },

    /* Артефакты при ошибке */
    screenshot: 'only-on-failure',
    video:      'retain-on-failure',
    trace:      'on-first-retry',

    /* Стабильность */
    actionTimeout:     10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    /* ─── Chromium ─── */
    {
      name: 'chromium',
      use:  { ...devices['Desktop Chrome'] },
    },

    /* ─── Firefox ─── */
    {
      name: 'firefox',
      use:  { ...devices['Desktop Firefox'] },
    },

    /* ─── WebKit / Safari ─── */
    {
      name: 'webkit',
      use:  { ...devices['Desktop Safari'] },
    },

    /* ─── Mobile Chrome ─── */
    {
      name: 'mobile-chrome',
      use:  { ...devices['Pixel 5'] },
      testMatch: ['**/frontend/**', '**/cottages/**', '**/auth/**'],
    },

    /* ─── API tests (без браузера, быстрее) ─── */
    {
      name: 'api',
      use:  { ...devices['Desktop Chrome'] },
      testMatch: ['**/api/**', '**/bookings/race-conditions.spec.ts'],
    },
  ],
});
