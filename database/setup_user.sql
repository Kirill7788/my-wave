-- Запускать от имени root: sudo mysql < database/setup_user.sql

CREATE DATABASE IF NOT EXISTS mywave CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Создать пользователя приложения (изменить пароль перед запуском!)
CREATE USER IF NOT EXISTS 'mywave_app'@'localhost' IDENTIFIED BY 'change_this_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON mywave.* TO 'mywave_app'@'localhost';
FLUSH PRIVILEGES;

-- Применить схему и данные
SOURCE database/schema.sql;
SOURCE database/seed.sql;
SOURCE database/trigger.sql;

SELECT 'Setup complete' AS status;
