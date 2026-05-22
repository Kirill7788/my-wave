<?php
/**
 * Создаёт фиксированных тестовых пользователей для Playwright.
 * Запускается из globalSetup перед всеми тестами.
 *
 * Создаёт:
 *   admin@mywave.test  / AdminPass123!  (role=admin)
 *   user@mywave.test   / UserPass123!   (role=user)
 */

declare(strict_types=1);
require_once __DIR__ . '/../../bootstrap.php';

$pdo = \App\Config\Database::connection();

$users = [
    [
        'email'      => 'admin@mywave.test',
        'password'   => 'AdminPass123!',
        'first_name' => 'Test Admin',
        'phone'      => '+375291234567',
        'role'       => 'admin',
    ],
    [
        'email'      => 'user@mywave.test',
        'password'   => 'UserPass123!',
        'first_name' => 'Test User',
        'phone'      => '+375291234568',
        'role'       => 'user',
    ],
];

foreach ($users as $u) {
    $hash = password_hash($u['password'], PASSWORD_BCRYPT, ['cost' => 12]);

    // Используем INSERT ... ON DUPLICATE KEY UPDATE для идемпотентности
    $pdo->prepare("
        INSERT INTO users (email, password_hash, first_name, phone, role, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
            password_hash = VALUES(password_hash),
            role          = VALUES(role),
            is_active     = 1
    ")->execute([$u['email'], $hash, $u['first_name'], $u['phone'], $u['role']]);

    echo "[seed] {$u['email']} ({$u['role']}) — OK\n";
}
