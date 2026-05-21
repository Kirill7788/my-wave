# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

My Wave — сервис аренды коттеджей у озёр Беларуси (30 коттеджей, 10 озёр). UI на русском языке. Стек: vanilla PHP 8.1+ / vanilla JS / plain CSS / MySQL 8. MPA: статические HTML-страницы + JSON API.

## Setup

```bash
# Зависимости (только autoloader — внешних пакетов нет)
composer install

# База данных — Ubuntu/Debian: root использует auth_socket, нужен sudo
sudo mysql < database/setup_user.sql   # создаёт mywave_app + схему + seed + триггеры

# Либо вручную от любого mysql-пользователя с правами CREATE:
mysql -u <user> -p mywave < database/schema.sql
mysql -u <user> -p mywave < database/seed.sql
mysql -u <user> -p mywave < database/trigger.sql

# Скопировать и заполнить .env (DB_USER, DB_PASS от только что созданного mywave_app)
cp .env.example .env

# Запуск
php -S localhost:8000
```

## Architecture

Каждый файл в `api/` — три строки: `require bootstrap.php → new Controller()->handle()`. Вся логика в `src/`.

```
bootstrap.php              .env loader → composer autoload → error handler → Session::start()

src/
  Config/
    Database.php           PDO singleton; credentials только из getenv()
    Session.php            настройка cookie (Strict/httponly/secure) + start/regenerate/destroy
  Http/
    Response.php           Response::json($data, $code) — единственный способ отдавать JSON;
                           автоматически добавляет X-Content-Type-Options, X-Frame-Options и др.
  Middleware/
    AuthMiddleware.php     ::requireAuth() → int $userId или 401
    AdminMiddleware.php    ::requireAdmin() → проверяет role='admin' в БД или 403
    RateLimiter.php        ::check('action', $max, $window) → APCu или файловый fallback
  Exceptions/
    AuthException          → HTTP 401/403
    BookingConflictException → HTTP 409
    ValidationException    → HTTP 422 + массив ошибок по полям
  Validation/
    Validator.php          pipe-правила: required|email|date|after:field|integer|min:N|max:N|min_length:N
  Repositories/            только SQL, никакой бизнес-логики
    BookingRepository      createWithLock() — транзакция + SELECT FOR UPDATE + конфликт дат
    CottageRepository      findWithFilters() — динамический WHERE по type/lake/price/has_bath
    UserRepository         CRUD пользователей + password_resets
    CardRepository         хранит только last_4 (без номера карты)
  Services/                бизнес-логика, валидация, оркестрация репозиториев
  Controllers/             HTTP dispatch по $_SERVER['REQUEST_METHOD'] + $_GET['action']

js/
  utils/dom.js             escapeHtml(), formatPrice(), formatDate() — грузить до всего остального
  components/CottageCard.js  единственный канонический шаблон карточки; данные через textContent
  api.js                   API.*  — все fetch только отсюда; updatePassword, login, bookings и т.д.
  catalog-filters.js       фильтры каталога + сортировка по data-price атрибуту
  auth.js                  состояние сессии через sessionStorage + кнопка header
  main.js                  burger-меню, scroll-эффект шапки (подключается на всех страницах)
```

## Key Conventions

**PHP — строго соблюдать:**
- Бизнес-логика → только Services; SQL → только Repositories; HTTP → только Controllers.
- `Response::json()` — единственный способ выйти из запроса. Никаких прямых `echo` / `header()` в контроллерах.
- Смена пароля: принимать `{current_password, new_password}`, верифицировать server-side в `AuthService::updatePassword()`. Отдельного endpoint для проверки пароля нет и не должно быть.
- Новые бронирования — только через `BookingRepository::createWithLock()`: транзакция + `FOR UPDATE` на строке коттеджа + повторная проверка конфликта дат внутри транзакции.
- Удаление коттеджей — soft delete (`is_active=0, deleted_at=NOW()`), не `DELETE`. Каскадное удаление бронирований заблокировано через `ON DELETE RESTRICT`.

**JS — строго соблюдать:**
- Данные из API в DOM — только через `CottageCard(cottage)` или `element.textContent = value`. `innerHTML` с API-данными запрещён.
- Все fetch-запросы только через `API.*` из `js/api.js`. Прямые `fetch()` в страницах — признак ошибки.
- Сортировка карточек — по `card.dataset.price` (число), не по текстовому содержимому DOM.
- Порядок подключения скриптов: `dom.js` → `CottageCard.js` → `api.js` → всё остальное.

## Database

10 таблиц: `users` (role: user/admin/manager), `lakes`, `cottage_types`, `cottages` (soft delete), `bookings`, `booking_history`, `password_resets`, `payment_cards`, `admin_logs`, `schema_migrations`.

Критичные индексы: `idx_booking_conflict (cottage_id, status, check_in, check_out)` — используется при каждом бронировании. Триггер `after_booking_update` (в `trigger.sql`) пишет изменения в `booking_history`.

## API

Все URL сохраняют обратную совместимость с HTML-страницами.

| Метод | URL | Auth |
|---|---|---|
| POST | `api/auth.php?action=register\|login\|logout\|update_profile\|update_password\|reset_password\|confirm_reset` | varies |
| GET | `api/auth.php?action=me` | ✓ |
| GET | `api/cottages.php[?slug=&type=&lake=&min_price=&max_price=&has_bath=1&limit=]` | — |
| POST/PUT/DELETE | `api/cottages.php[?id=]` | admin |
| GET/POST/PUT/DELETE | `api/bookings.php[?id=]` | ✓ |
| GET/POST/PUT/DELETE | `api/cards.php[?id=]` | ✓ |
