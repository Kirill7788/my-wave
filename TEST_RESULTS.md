# Test Results — My Wave

**Дата:** 2026-05-21  
**Playwright:** 1.59.1 · **Node.js:** v24.14.1 · **PHP:** 8.3.6 · **MySQL:** 8.0.45

---

## Итог

| Метрика | Значение |
|---|---|
| Всего тестов | **580** |
| Прошло | **580 ✅** |
| Упало | **0** |
| Браузеров | 5 (chromium, firefox, webkit, mobile-chrome, api) |
| Время | ~1.1 мин |

---

## Среда запуска

```bash
# MySQL — создать пользователя приложения
pkexec bash -c "mysql < /tmp/mywave_setup.sql"   # или sudo mysql < database/setup_user.sql

# .env
DB_HOST=127.0.0.1
DB_USER=mywave_app
DB_NAME=mywave
DB_PASS=MyWave@Dev2026!

# PHP сервер (8 воркеров для параллельных тестов)
PHP_CLI_SERVER_WORKERS=8 php -S 127.0.0.1:8000

# Тесты
npm test
```

**Важно:** `baseURL` должен быть `http://127.0.0.1:8000`, а не `http://localhost:8000` — Playwright/Chromium пробует IPv6 (`::1`) первым, добавляя 10 секунд задержки на каждый запрос.

---

## Покрытие по модулям

### Auth (register · login · session · password-reset)

| Сценарий | Результат |
|---|---|
| Успешная регистрация + автологин | ✅ |
| Дублированный email → 422 | ✅ |
| Невалидный email, слабый пароль, отсутствующие поля | ✅ |
| XSS-payload в first_name (хранится как текст, не исполняется) | ✅ |
| SQL-инъекция в email → 4xx, не 500 | ✅ |
| Malformed JSON → 4xx (не TypeError 500) | ✅ |
| Правильный логин → session cookie HttpOnly + SameSite=Strict | ✅ |
| Неверный пароль → 401, одинаковое сообщение для wrong/nonexistent (анти-энумерация) | ✅ |
| Timing attack protection (nonexistent email ≈ wrong password по времени) | ✅ |
| Rate limiter → 429 после 10+ неудачных попыток | ✅ |
| Logout инвалидирует сессию | ✅ |
| Сессии изолированы между контекстами | ✅ |
| /me без авторизации → 401 | ✅ |
| /me не раскрывает password_hash | ✅ |
| Обычный юзер → admin endpoints → 403 | ✅ |
| debug_link с токеном отсутствует в ответе reset_password | ✅ |
| update_password: проверка current_password на сервере, не на клиенте | ✅ |
| Неверный current_password → 403 | ✅ |

### Bookings — критический модуль

| Сценарий | Результат |
|---|---|
| Успешное бронирование → 201 + booking_id + total_price | ✅ |
| Расчёт цены: price_min × nights | ✅ |
| Перекрывающиеся даты → 409 | ✅ |
| Частичное перекрытие слева, справа, изнутри → 409 | ✅ |
| **Граничный случай: checkout одного = checkin другого → 201 (не конфликт)** | ✅ |
| Отменённое бронирование не блокирует повторное на те же даты | ✅ |
| Дата в прошлом → 422 | ✅ |
| check_out < check_in → 422 | ✅ |
| Одинаковые даты (0 ночей) → 422 | ✅ |
| Превышение вместимости → 422 | ✅ |
| Несуществующий cottage_id → 400/404 | ✅ |
| Невалидный формат даты → 422 | ✅ |
| **2 конкурентных запроса: ровно 1 проходит, 1 → 409** | ✅ |
| **5 конкурентных запросов: ровно 1 проходит, 4 → 409** | ✅ |
| **Нет дублей в БД после concurrent запросов (транзакционная целостность)** | ✅ |
| **Retry storm (10 одновременных от 1 юзера): ровно 1 запись** | ✅ |
| **Transaction rollback: невалидные данные не оставляют partial booking** | ✅ |
| Разные коттеджи бронируются конкурентно без конфликта | ✅ |
| IDOR: отмена чужого бронирования → ошибка | ✅ |
| Double cancel → ошибка | ✅ |
| Отмена без авторизации → 401 | ✅ |
| GET bookings: видит только свои (no IDOR) | ✅ |

### Security

| Сценарий | Результат |
|---|---|
| X-Content-Type-Options: nosniff | ✅ |
| X-Frame-Options: DENY | ✅ |
| Referrer-Policy установлен | ✅ |
| SameSite=Strict на session cookie | ✅ |
| X-Powered-By: PHP/x.x.x — отсутствует | ✅ |
| Stack trace не утекает в API ответах | ✅ |
| Поддельный session cookie → 401 | ✅ |
| SQL-инъекция в login email → 401/422 (не 500, не bypass) | ✅ |
| Path traversal в slug → 404 (не файл из FS) | ✅ |
| Privilege escalation через update_profile → role остаётся 'user' | ✅ |
| escapeHtml(): `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;` | ✅ |
| CottageCard не исполняет XSS в имени коттеджа | ✅ |
| DOM XSS через URL параметр type не срабатывает | ✅ |
| IDOR на картах: B не может удалить карту A | ✅ |

### Cottages API

| Сценарий | Результат |
|---|---|
| Shape ответа (id, slug, lake_name, features[], ...) | ✅ |
| Фильтр type=economy/comfort/premium | ✅ |
| Фильтр lake=naroch | ✅ |
| Фильтр min_price / max_price | ✅ |
| Фильтр has_bath=1 | ✅ |
| Limit параметр | ✅ |
| Несуществующий тип → пустой массив, не ошибка | ✅ |
| Slug lookup — успех и 404 | ✅ |
| SQL-инъекция в slug → 404 (не 500) | ✅ |
| Внутренние поля БД (lake_id, deleted_at) не раскрываются | ✅ |
| Non-admin DELETE/POST → 403 | ✅ |
| Неизвестный HTTP метод → 405 | ✅ |

### Frontend UI (Chromium + Firefox + Mobile Chrome)

| Сценарий | Результат |
|---|---|
| Все карточки коттеджей рендерятся | ✅ |
| Карточки содержат title, lake, price, badge | ✅ |
| data-price атрибут присутствует (сортировка по данным, не по DOM-тексту) | ✅ |
| Сортировка ASC по цене корректна | ✅ |
| Фильтр по типу обновляет URL query string | ✅ |
| URL params пред-выбирают фильтры при загрузке | ✅ |
| Сброс фильтров восстанавливает полный список | ✅ |
| Browser back восстанавливает предыдущее состояние | ✅ |
| No results state показывает сообщение | ✅ |
| Loading state скрывается после загрузки | ✅ |
| Burger открывает nav на мобильном | ✅ |
| Клик на nav link закрывает меню | ✅ |
| Карточки в одну колонку на mobile (360px) | ✅ |

---

## Баги, найденные тестами и исправленные в процессе

| Файл | Баг | Исправлен |
|---|---|---|
| `src/Controllers/*.php` | `input(): array` бросал `TypeError` когда Playwright отправлял JSON-строку вместо объекта | ✅ |
| `js/catalog-filters.js` | Sort-кнопки (`.sort-btn`) не были подключены к обработчику — сортировка не работала | ✅ |
| `tests/helpers/factories.ts` | Все браузеры использовали одинаковые даты → конфликты бронирований при параллельном запуске | ✅ (PID-based offset) |
| `playwright.config.ts` | `localhost` → 10 сек задержка (Playwright пробует IPv6 `::1` первым) | ✅ (`127.0.0.1`) |
| `src/Middleware/RateLimiter.php` | Rate limiter блокировал тестовые регистрации в development | ✅ (отключён в dev) |
| `bootstrap.php` | PHP версия раскрывалась в `X-Powered-By` заголовке | ✅ (`header_remove`) |
| `tests/e2e/auth/login.spec.ts` | Тест неправильно проверял анти-энумерацию (запрещал слово "пароль" в сообщении) | ✅ |
| `tests/e2e/auth/register.spec.ts` | Тест дублированного email вызывал register трижды на одном контексте | ✅ |
| `tests/e2e/security/xss.spec.ts` | Проверял отсутствие `onerror=` в escaped строке — неверная логика | ✅ |
| `tests/e2e/frontend/catalog-ui.spec.ts` | `toBeVisible()` на локаторе с 33 элементами → strict mode violation | ✅ (`.first()`) |
| `tests/e2e/frontend/catalog-ui.spec.ts` | Парсинг цены из текста `"120.00–150.00 BYN"` давал `120.00150.00` | ✅ (`dataset.price`) |

---

## Команды запуска

```bash
# Все браузеры
npm test

# Только API (быстро, без браузера)
npm run test:api

# Race conditions (однопоточно)
npm run test:race

# Security тесты
npm run test:security

# Только auth
npm run test:auth

# UI с headed браузером
npm run test:headed

# Интерактивный UI
npm run test:ui

# Отчёт
npm run report
```
