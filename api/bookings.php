<?php
// api/bookings.php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

// ===== ПОСТ: создание бронирования =====
if ($method === 'POST') {
    try {
        $userId = authRequired();
        $data = json_decode(file_get_contents('php://input'), true);

        if (!$data) {
            throw new Exception('Неверные данные');
        }

        $required = ['cottage_id', 'check_in', 'check_out', 'guest_name', 'guest_phone', 'guest_email'];
        foreach ($required as $f) {
            if (empty($data[$f])) {
                throw new Exception("Поле $f обязательно");
            }
        }

        $pdo = getPDO();

        // 1. Проверка пересечения дат
        $stmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM bookings 
                               WHERE cottage_id = ? AND status != 'cancelled' 
                               AND check_in < ? AND check_out > ?");
        $stmt->execute([$data['cottage_id'], $data['check_out'], $data['check_in']]);
        if ($stmt->fetch()['cnt'] > 0) {
            throw new Exception('Эти даты уже заняты');
        }

        // 2. Получаем цену и вместимость домика
        $stmt = $pdo->prepare("SELECT price_min, capacity FROM cottages WHERE id = ?");
        $stmt->execute([$data['cottage_id']]);
        $cottage = $stmt->fetch();
        if (!$cottage) {
            throw new Exception('Домик не найден');
        }

        // 3. Расчет гостей (JS отправляет adults + children)
        $adults   = isset($data['adults']) ? (int)$data['adults'] : 1;
        $children = isset($data['children']) ? (int)$data['children'] : 0;
        $infants  = isset($data['infants']) ? (int)$data['infants'] : 0;
        
        $totalGuests = $adults + $children + $infants;
        if ($totalGuests < 1) $totalGuests = 1;
        if ($totalGuests > $cottage['capacity']) {
            throw new Exception('Превышена вместимость домика (' . $cottage['capacity'] . ' чел.)');
        }

        // 4. Расчет ночей и цены
        $nights = (strtotime($data['check_out']) - strtotime($data['check_in'])) / 86400;
        if ($nights < 1) {
            throw new Exception('Дата выезда должна быть позже заезда');
        }

        $totalPrice = $cottage['price_min'] * $nights;

        // 5. Сохранение в БД
        // Используем имена колонок, которые точно есть в твоей БД: guests, adults, children
        $stmt = $pdo->prepare("INSERT INTO bookings (user_id, cottage_id, check_in, check_out, guests, adults, children, total_price, guest_name, guest_phone, guest_email, status) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')");
        $stmt->execute([
            $userId, 
            $data['cottage_id'], 
            $data['check_in'], 
            $data['check_out'],
            $totalGuests, // В колонку guests пишем общую сумму
            $adults,      // В колонку adults
            $children,    // В колонку children
            $totalPrice,
            $data['guest_name'], 
            $data['guest_phone'], 
            $data['guest_email']
        ]);

        jsonResponse(['success' => true, 'booking_id' => $pdo->lastInsertId()]);

    } catch (Exception $e) {
        error_log('Bookings Error: ' . $e->getMessage());
        jsonResponse(['error' => $e->getMessage()], 500);
    }
}

// ===== ГЕТ: мои бронирования =====
if ($method === 'GET') {
    try {
        $userId = authRequired();
        $pdo = getPDO();
        
        $stmt = $pdo->prepare("SELECT b.*, c.name as cottage_name, c.slug as cottage_slug 
                               FROM bookings b 
                               JOIN cottages c ON b.cottage_id = c.id 
                               WHERE b.user_id = ? 
                               ORDER BY b.created_at DESC");
        $stmt->execute([$userId]);
        
        jsonResponse(['bookings' => $stmt->fetchAll()]);
        
    } catch (Exception $e) {
        jsonResponse(['error' => $e->getMessage()], 500);
    }
}

// ===== DELETE: отмена =====
if ($method === 'DELETE' && !empty($_GET['id'])) {
    try {
        $userId = authRequired();
        $pdo = getPDO();
        
        $stmt = $pdo->prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ? AND user_id = ?");
        $stmt->execute([$_GET['id'], $userId]);
        
        jsonResponse(['success' => true]);
        
    } catch (Exception $e) {
        jsonResponse(['error' => $e->getMessage()], 500);
    }
}
?>