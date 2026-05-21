<?php
// api/cards.php
require_once 'config.php';
$method = $_SERVER['REQUEST_METHOD'];

// Проверка авторизации
$userId = authRequired();
$pdo = getPDO();

try {
    // ===== GET: Список карт =====
    if ($method === 'GET') {
        $stmt = $pdo->prepare("SELECT * FROM payment_cards WHERE user_id = ? ORDER BY is_default DESC, created_at DESC");
        $stmt->execute([$userId]);
        jsonResponse(['cards' => $stmt->fetchAll()]);
    }

    // ===== POST: Добавить карту =====
    if ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        $required = ['card_number', 'card_holder', 'exp_month', 'exp_year', 'cvc'];
        foreach ($required as $field) if (empty($data[$field])) jsonResponse(['error' => "Поле $field обязательно"], 400);

        // Валидация и очистка номера
        $cardNumber = preg_replace('/\s+/', '', $data['card_number']);
        if (!preg_match('/^\d{16}$/', $cardNumber)) jsonResponse(['error' => 'Неверный формат карты'], 400);

        $last4 = substr($cardNumber, -4);
        // В учебном проекте сохраняем хеш и последние 4 цифры. CVC не храним!
        $stmt = $pdo->prepare("INSERT INTO payment_cards (user_id, card_number_hash, card_last_4, card_holder, exp_month, exp_year) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$userId, hash('sha256', $cardNumber), $last4, strtoupper($data['card_holder']), $data['exp_month'], $data['exp_year']]);

        jsonResponse(['success' => true]);
    }

    // ===== PUT: Сделать основной =====
    if ($method === 'PUT') {
        $cardId = $_GET['id'] ?? 0;
        $pdo->prepare("UPDATE payment_cards SET is_default = FALSE WHERE user_id = ?")->execute([$userId]);
        $pdo->prepare("UPDATE payment_cards SET is_default = TRUE WHERE id = ? AND user_id = ?")->execute([$cardId, $userId]);
        jsonResponse(['success' => true]);
    }

    // ===== DELETE: Удалить =====
    if ($method === 'DELETE' && !empty($_GET['id'])) {
        $stmt = $pdo->prepare("DELETE FROM payment_cards WHERE id = ? AND user_id = ?");
        $stmt->execute([$_GET['id'], $userId]);
        jsonResponse(['success' => true]);
    }

} catch (Exception $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}
?>