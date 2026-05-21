CREATE DATABASE IF NOT EXISTS mywave CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mywave;

-- 1. Пользователи
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Озёра
CREATE TABLE lakes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    region VARCHAR(100) NOT NULL,
    description TEXT,
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_slug (slug)
) ENGINE=InnoDB;

-- 3. Типы домиков
CREATE TABLE cottage_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    price_min DECIMAL(10,2) NOT NULL,
    price_max DECIMAL(10,2) NOT NULL,
    INDEX idx_slug (slug)
) ENGINE=InnoDB;

-- 4. Домики (основная таблица)
CREATE TABLE cottages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    lake_id INT NOT NULL,
    type_id INT NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    capacity INT NOT NULL DEFAULT 4,
    price_min DECIMAL(10,2) NOT NULL,
    price_max DECIMAL(10,2) NOT NULL,
    description TEXT,
    features JSON NOT NULL,
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lake_id) REFERENCES lakes(id) ON DELETE CASCADE,
    FOREIGN KEY (type_id) REFERENCES cottage_types(id) ON DELETE CASCADE,
    INDEX idx_lake (lake_id),
    INDEX idx_type (type_id),
    INDEX idx_price (price_min, price_max)
) ENGINE=InnoDB;

-- 5. Бронирования
CREATE TABLE bookings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    cottage_id INT NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    guests INT NOT NULL DEFAULT 2,
	adults INT NOT NULL DEFAULT 1,
	children INT NOT NULL DEFAULT 0,  
    total_price DECIMAL(10,2) NOT NULL,
    status ENUM('pending','confirmed','cancelled','completed') DEFAULT 'pending',
    guest_name VARCHAR(255) NOT NULL,
    guest_phone VARCHAR(20) NOT NULL,
    guest_email VARCHAR(255) NOT NULL, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (cottage_id) REFERENCES cottages(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_cottage (cottage_id)
) ENGINE=InnoDB;

-- 6. История записей
CREATE TABLE booking_history (
    id INT PRIMARY KEY IDENTITY(1,1),
    booking_id INT NOT NULL FOREIGN KEY REFERENCES bookings(id) ON DELETE CASCADE,
    changed_by INT NULL, 
    action NVARCHAR(50) NOT NULL,
    old_values NVARCHAR(MAX),
    new_values NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETDATE()
);
-- 7. Сброс пароля
CREATE TABLE IF NOT EXISTS password_resets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token)
) ENGINE=InnoDB;

-- 8. Банковская карта
CREATE TABLE IF NOT EXISTS payment_cards (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    card_number_hash VARCHAR(255) NOT NULL,
    card_last_4 VARCHAR(4) NOT NULL,
    card_holder VARCHAR(100) NOT NULL,
    exp_month INT NOT NULL,
    exp_year INT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 9. Логи действий администраторов
CREATE TABLE IF NOT EXISTS admin_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    admin_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_admin (admin_id),
    INDEX idx_action (action)
) ENGINE=InnoDB;

