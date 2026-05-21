<?php
// api/auth.php
error_reporting(0);
ini_set('display_errors', 0);

// ✅ 1. Сначала настройки (ДО подключения config и запуска сессии)
ini_set('session.cookie_path', '/');
ini_set('session.cookie_lifetime', '2592000');
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_samesite', 'Lax');

// Если в php.ini включен auto_start, это поможет сбросить
if (session_status() !== PHP_SESSION_ACTIVE) {
    // Ничего не делаем, ждем явного старта
}

require_once 'config.php';

// ✅ 2. Запуск сессии
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ===== РЕГИСТРАЦИЯ =====
if ($method === 'POST' && $action === 'register') {
    $data = json_decode(file_get_contents('php://input'), true);
    $required = ['email', 'password', 'first_name', 'phone'];
    foreach ($required as $field) {
        if (empty($data[$field])) jsonResponse(['error' => "Поле $field обязательно"], 400);
    }
    $pdo = getPDO();
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$data['email']]);
    if ($stmt->fetch()) jsonResponse(['error' => 'Email уже зарегистрирован'], 409);

    $passwordHash = password_hash($data['password'], PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("INSERT INTO users (email, password_hash, first_name, phone, role) VALUES (?, ?, ?, ?, 'user')");
    $stmt->execute([$data['email'], $passwordHash, $data['first_name'], $data['phone']]);
    $_SESSION['user_id'] = $pdo->lastInsertId();
    jsonResponse(['success' => true, 'user_id' => $pdo->lastInsertId()]);
}

// ===== ВХОД (LOGIN) =====
if ($method === 'POST' && $action === 'login') {
    $data = json_decode(file_get_contents('php://input'), true);
    $pdo = getPDO();
    $stmt = $pdo->prepare("SELECT id, password_hash, first_name, email, role FROM users WHERE email = ?");
    $stmt->execute([$data['email']]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($data['password'], $user['password_hash'])) {
        jsonResponse(['error' => 'Неверный email или пароль'], 401);
    }

    $_SESSION['user_id'] = $user['id'];
    jsonResponse([
        'success' => true,
        'user' => [
            'id' => $user['id'],
            'name' => $user['first_name'],
            'email' => $user['email'],
            'role' => $user['role']
        ]
    ]);
}

// ===== МОЙ ПРОФИЛЬ =====
if ($method === 'GET' && $action === 'me') {
    $userId = authRequired();
    $pdo = getPDO();
    $stmt = $pdo->prepare("SELECT id, email, first_name, last_name, phone, role FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    jsonResponse(['user' => $stmt->fetch()]);
}

// ===== ОБНОВЛЕНИЕ ПРОФИЛЯ =====
if ($method === 'POST' && $action === 'update_profile') {
    $userId = authRequired();
    $data = json_decode(file_get_contents('php://input'), true);
    $pdo = getPDO();

    // 1. Сначала получаем текущие данные пользователя
    $stmt = $pdo->prepare("SELECT first_name, last_name, phone FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $current = $stmt->fetch();

    // 2. Если новые данные есть — берем их, если нет — оставляем старые
    $newFirstName = isset($data['first_name']) ? $data['first_name'] : $current['first_name'];
    $newLastName = isset($data['last_name']) ? $data['last_name'] : $current['last_name'];
    $newPhone = isset($data['phone']) ? $data['phone'] : $current['phone'];

    // 3. Обновляем базу
    $stmt = $pdo->prepare("UPDATE users SET first_name=?, last_name=?, phone=? WHERE id=?");
    $stmt->execute([$newFirstName, $newLastName, $newPhone, $userId]);
    
    jsonResponse(['success' => true]);
}
// ===== ПРОВЕРКА ПАРОЛЯ =====
if ($method === 'POST' && $action === 'verify_password') {
    $data = json_decode(file_get_contents('php://input'), true);
    $pdo = getPDO();
    $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE email = ?");
    $stmt->execute([$data['email']]);
    $hash = $stmt->fetchColumn();
    
    if ($hash && password_verify($data['password'], $hash)) {
        jsonResponse(['valid' => true]);
    } else {
        jsonResponse(['valid' => false]);
    }
}

// ===== ОБНОВЛЕНИЕ ПАРОЛЯ =====
if ($method === 'POST' && $action === 'update_password') {
    $userId = authRequired();
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (empty($data['new_password']) || strlen($data['new_password']) < 6) {
        jsonResponse(['error' => 'Пароль должен быть не менее 6 символов'], 400);
    }
    
    $newHash = password_hash($data['new_password'], PASSWORD_DEFAULT);
    $pdo = getPDO();
    $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
    $stmt->execute([$newHash, $userId]);
    
    jsonResponse(['success' => true]);
}

// ===== СБРОС ПАРОЛЯ =====
if ($method === 'POST' && $action === 'reset_password') {
    $data = json_decode(file_get_contents('php://input'), true);
    $pdo = getPDO();
    
    $stmt = $pdo->prepare("SELECT id, email FROM users WHERE email = ?");
    $stmt->execute([$data['email']]);
    $user = $stmt->fetch();
    
    if (!$user) {
        // Не показываем, существует ли email (безопасность)
        jsonResponse(['success' => true]);
    }
    
    // Генерация токена
    $token = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', strtotime('+1 hour'));
    
    $stmt = $pdo->prepare("INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)");
    $stmt->execute([$user['id'], $token, $expires]);
    
    // Отправка email (в реальном проекте)
    $resetLink = "http://localhost/my-wave/reset-password.html?token=$token";
    // mail($user['email'], 'Сброс пароля', "Ссылка: $resetLink");
    
    error_log("Reset link for {$user['email']}: $resetLink"); // Для отладки
    
    jsonResponse(['success' => true, 'debug_link' => $resetLink]); // Удалить в продакшене
}

// ===== ПОДТВЕРЖДЕНИЕ СБРОСА ПАРОЛЯ =====
if ($method === 'POST' && $action === 'confirm_reset') {
    $data = json_decode(file_get_contents('php://input'), true);
    $pdo = getPDO();
    
    // Проверка токена
    $stmt = $pdo->prepare("SELECT user_id, expires_at FROM password_resets WHERE token = ? AND used = 0");
    $stmt->execute([$data['token']]);
    $reset = $stmt->fetch();
    
    if (!$reset) {
        jsonResponse(['error' => 'Неверный или использованный токен'], 400);
    }
    
    if (strtotime($reset['expires_at']) < time()) {
        jsonResponse(['error' => 'Срок действия токена истёк'], 400);
    }
    
    // Обновление пароля
    $newHash = password_hash($data['new_password'], PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
    $stmt->execute([$newHash, $reset['user_id']]);
    
    // Помечаем токен как использованный
    $stmt = $pdo->prepare("UPDATE password_resets SET used = 1 WHERE token = ?");
    $stmt->execute([$data['token']]);
    
    jsonResponse(['success' => true]);
}

// ===== ВЫХОД =====
if ($method === 'POST' && $action === 'logout') {
    session_destroy();
    jsonResponse(['success' => true]);
}
