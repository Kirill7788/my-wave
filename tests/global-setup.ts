/**
 * global-setup.ts
 * Запускается один раз перед всеми тестами.
 * 1. Проверяет доступность PHP-сервера.
 * 2. Создаёт фиксированных тестовых пользователей через PHP-скрипт.
 */
import { execSync } from 'child_process';
import { request } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8000';
const MAX_WAIT_MS = 10_000;

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      await fetch(`${url}/api/cottages.php?limit=1`);
      return; // любой HTTP-ответ означает что сервер слушает
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error(
    `PHP-сервер недоступен на ${url}.\nЗапустите: php -S localhost:8000`
  );
}

export default async function globalSetup() {
  console.log('\n[setup] Проверка PHP-сервера...');
  await waitForServer(BASE_URL);
  console.log('[setup] Сервер доступен.');

  console.log('[setup] Создание тестовых пользователей...');
  try {
    execSync('php tests/scripts/seed-test-users.php', { stdio: 'inherit' });
    console.log('[setup] Готово.\n');
  } catch (err) {
    // Не бросаем — тесты сами покажут что не работает
    console.warn('[setup] ⚠ Seed failed (no DB?):', String(err).split('\n')[0]);
  }
}
