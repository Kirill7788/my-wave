CREATE DATABASE IF NOT EXISTS mywave CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mywave;

-- 1. Пользователи
CREATE TABLE IF NOT EXISTS users (
    id           INT PRIMARY KEY AUTO_INCREMENT,
    email        VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name   VARCHAR(100),
    last_name    VARCHAR(100),
    phone        VARCHAR(20),
    role         ENUM('user','admin','manager') NOT NULL DEFAULT 'user',
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at   TIMESTAMP NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB;

-- 2. Озёра
CREATE TABLE IF NOT EXISTS lakes (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    region      VARCHAR(100) NOT NULL,
    description TEXT,
    image_url   VARCHAR(255),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_slug (slug)
) ENGINE=InnoDB;

-- 3. Типы домиков
CREATE TABLE IF NOT EXISTS cottage_types (
    id        INT PRIMARY KEY AUTO_INCREMENT,
    slug      VARCHAR(50) UNIQUE NOT NULL,
    name      VARCHAR(100) NOT NULL,
    price_min DECIMAL(10,2) NOT NULL,
    price_max DECIMAL(10,2) NOT NULL,
    INDEX idx_slug (slug)
) ENGINE=InnoDB;

-- 4. Домики
CREATE TABLE IF NOT EXISTS cottages (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    lake_id     INT NOT NULL,
    type_id     INT NOT NULL,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    capacity    INT NOT NULL DEFAULT 4,
    price_min   DECIMAL(10,2) NOT NULL,
    price_max   DECIMAL(10,2) NOT NULL,
    description TEXT,
    features    JSON NOT NULL,
    image_url   VARCHAR(255),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at  TIMESTAMP NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lake_id) REFERENCES lakes(id) ON DELETE RESTRICT,
    FOREIGN KEY (type_id) REFERENCES cottage_types(id) ON DELETE RESTRICT,
    INDEX idx_lake (lake_id),
    INDEX idx_type (type_id),
    INDEX idx_price (price_min, price_max),
    INDEX idx_active (is_active)
) ENGINE=InnoDB;

-- 5. Бронирования
CREATE TABLE IF NOT EXISTS bookings (
    id           INT PRIMARY KEY AUTO_INCREMENT,
    user_id      INT NULL,
    cottage_id   INT NOT NULL,
    check_in     DATE NOT NULL,
    check_out    DATE NOT NULL,
    guests       INT NOT NULL DEFAULT 2,
    adults       INT NOT NULL DEFAULT 1,
    children     INT NOT NULL DEFAULT 0,
    total_price  DECIMAL(10,2) NOT NULL,
    status       ENUM('pending','confirmed','cancelled','completed') DEFAULT 'pending',
    guest_name   VARCHAR(255) NOT NULL,
    guest_phone  VARCHAR(20) NOT NULL,
    guest_email  VARCHAR(255) NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    -- ON DELETE RESTRICT: удаление коттеджа невозможно, пока есть бронирования
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (cottage_id) REFERENCES cottages(id) ON DELETE RESTRICT,
    INDEX idx_user (user_id),
    INDEX idx_cottage (cottage_id),
    -- Составной индекс для проверки конфликта дат
    INDEX idx_booking_conflict (cottage_id, status, check_in, check_out),
    INDEX idx_user_date (user_id, created_at)
) ENGINE=InnoDB;

-- 6. История изменений бронирования (триггер в trigger.sql)
CREATE TABLE IF NOT EXISTS booking_history (
    id         BIGINT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT NOT NULL,
    changed_by INT NULL,
    action     ENUM('created','updated','cancelled','confirmed','completed') NOT NULL,
    old_values JSON NULL,
    new_values JSON NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_booking (booking_id),
    INDEX idx_changed_by (changed_by),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- 7. Сброс пароля
CREATE TABLE IF NOT EXISTS password_resets (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    user_id    INT NOT NULL,
    token      VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    used       BOOLEAN DEFAULT FALSE,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token_used (token, used),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB;

-- 8. Платёжные карты (только last_4 — без хранения номера карты)
CREATE TABLE IF NOT EXISTS payment_cards (
    id           INT PRIMARY KEY AUTO_INCREMENT,
    user_id      INT NOT NULL,
    card_last_4  VARCHAR(4) NOT NULL,
    card_holder  VARCHAR(100) NOT NULL,
    exp_month    TINYINT NOT NULL,
    exp_year     SMALLINT NOT NULL,
    is_default   BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_default (user_id, is_default)
) ENGINE=InnoDB;

-- 9. Логи действий администратора
CREATE TABLE IF NOT EXISTS admin_logs (
    id          INT PRIMARY KEY AUTO_INCREMENT,
    admin_id    INT NOT NULL,
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id   INT,
    details     JSON,
    ip_address  VARCHAR(45) NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_admin (admin_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- 10. Миграции (версионирование схемы)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
