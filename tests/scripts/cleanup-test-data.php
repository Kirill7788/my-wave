<?php
/**
 * Удаляет все данные с доменом @mywave.test после прогона тестов.
 * Порядок важен: сначала bookings, потом users (FK).
 */

declare(strict_types=1);
require_once __DIR__ . '/../../bootstrap.php';

$pdo = \App\Config\Database::connection();

// Бронирования динамических тест-пользователей
$pdo->exec("
    DELETE b FROM bookings b
    JOIN users u ON b.user_id = u.id
    WHERE u.email LIKE '%@mywave.test'
");

// Карты
$pdo->exec("
    DELETE pc FROM payment_cards pc
    JOIN users u ON pc.user_id = u.id
    WHERE u.email LIKE '%@mywave.test'
");

// Сбросы паролей
$pdo->exec("
    DELETE pr FROM password_resets pr
    JOIN users u ON pr.user_id = u.id
    WHERE u.email LIKE '%@mywave.test'
");

// Пользователи (кроме фиксированных admin/user — они переиспользуются)
$pdo->exec("
    DELETE FROM users
    WHERE email LIKE '%@mywave.test'
      AND email NOT IN ('admin@mywave.test', 'user@mywave.test')
");

echo "[cleanup] Тестовые данные удалены.\n";
