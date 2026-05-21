/**
 * global-teardown.ts
 * Запускается один раз после всех тестов.
 * Удаляет тестовые данные с доменом @mywave.test.
 */
import { execSync } from 'child_process';

export default async function globalTeardown() {
  console.log('\n[teardown] Очистка тестовых данных...');
  try {
    execSync('php tests/scripts/cleanup-test-data.php', { stdio: 'inherit' });
  } catch (err) {
    // Не бросаем — teardown не должен ронять CI
    console.warn('[teardown] Ошибка очистки:', err);
  }
  console.log('[teardown] Готово.\n');
}
