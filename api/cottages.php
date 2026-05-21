<?php

error_reporting(0);
ini_set('display_errors', 0);

// api/cottages.php
require_once 'config.php';
$method = $_SERVER['REQUEST_METHOD'];
$pdo = getPDO();

// ===== ПРОВЕРКА АДМИНА =====
function requireAdmin()
{
    if (session_status() === PHP_SESSION_NONE) session_start();
    if (!isset($_SESSION['user_id'])) {
        jsonResponse(['error' => 'Требуется авторизация'], 401);
    }
    global $pdo;
    $stmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    if ($stmt->fetchColumn() !== 'admin') {
        jsonResponse(['error' => 'Доступ запрещён'], 403);
    }
}

// ===== ЧИТАТЬ: один домик или список =====
if ($method === 'GET') {
    $slug = $_GET['slug'] ?? '';
    if ($slug) {
        // Один домик по slug
        $stmt = $pdo->prepare("SELECT c.*, l.name as lake_name, l.slug as lake_slug, l.region,
                               t.name as type_name, t.slug as type_slug
                               FROM cottages c
                               JOIN lakes l ON c.lake_id = l.id
                               JOIN cottage_types t ON c.type_id = t.id
                               WHERE c.slug = ?");
        $stmt->execute([$slug]);
        $cottage = $stmt->fetch();
        if (!$cottage) jsonResponse(['error' => 'Домик не найден'], 404);
        if (isset($cottage['features']) && is_string($cottage['features'])) {
            $cottage['features'] = json_decode($cottage['features'], true);
        }
        jsonResponse(['cottage' => $cottage]);
    } else {
        // Список с фильтрами
        $sql = "SELECT c.*, l.name as lake_name, l.slug as lake_slug, l.region,
                       t.name as type_name, t.slug as type_slug
                FROM cottages c
                JOIN lakes l ON c.lake_id = l.id
                JOIN cottage_types t ON c.type_id = t.id
                WHERE 1=1";
        $params = [];
        if (!empty($_GET['type'])) {
            $sql .= " AND t.slug = ?";
            $params[] = $_GET['type'];
        }
        if (!empty($_GET['lake'])) {
            $sql .= " AND l.slug = ?";
            $params[] = $_GET['lake'];
        }
        if (!empty($_GET['min_price'])) {
            $sql .= " AND c.price_max >= ?";
            $params[] = $_GET['min_price'];
        }
        if (!empty($_GET['max_price'])) {
            $sql .= " AND c.price_min <= ?";
            $params[] = $_GET['max_price'];
        }
        $sql .= " ORDER BY c.created_at DESC";
        if (!empty($_GET['limit'])) $sql .= " LIMIT " . (int)$_GET['limit'];
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $cottages = $stmt->fetchAll();
        foreach ($cottages as &$c) {
            if (is_string($c['features'])) $c['features'] = json_decode($c['features'], true);
        }
        jsonResponse(['cottages' => $cottages]);
    }
}

// ===== АДМИН: УДАЛИТЬ =====
if ($method === 'DELETE' && !empty($_GET['id'])) {
    requireAdmin();
    $stmt = $pdo->prepare("DELETE FROM cottages WHERE id = ?");
    $stmt->execute([$_GET['id']]);
    jsonResponse(['success' => true]);
}

// ===== АДМИН: СОЗДАТЬ =====
if ($method === 'POST') {
    requireAdmin();
    $data = json_decode(file_get_contents('php://input'), true);
    $required = ['name', 'lake_slug', 'type_slug', 'price_min', 'price_max', 'capacity'];
    foreach ($required as $f) if (empty($data[$f])) jsonResponse(['error' => "Поле $f обязательно"], 400);

    // Получаем ID озера и типа
    $stmt = $pdo->prepare("SELECT id FROM lakes WHERE slug = ?");
    $stmt->execute([$data['lake_slug']]);
    $lakeId = $stmt->fetchColumn();
    $stmt = $pdo->prepare("SELECT id FROM cottage_types WHERE slug = ?");
    $stmt->execute([$data['type_slug']]);
    $typeId = $stmt->fetchColumn();
    if (!$lakeId || !$typeId) jsonResponse(['error' => 'Неверное озеро или тип'], 400);

    // Генерируем slug и обрабатываем features
    $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $data['name']))) . '-' . uniqid();
    $features = is_array($data['features'] ?? null) ? $data['features'] : array_filter(array_map('trim', explode(',', $data['features'] ?? '')));

    $stmt = $pdo->prepare("INSERT INTO cottages (lake_id, type_id, slug, name, capacity, price_min, price_max, description, features, image_url)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $lakeId,
        $typeId,
        $slug,
        $data['name'],
        (int)$data['capacity'],
        (float)$data['price_min'],
        (float)$data['price_max'],
        $data['description'] ?? '',
        json_encode($features, JSON_UNESCAPED_UNICODE),
        $data['image_url'] ?? ''
    ]);
    jsonResponse(['success' => true, 'cottage_id' => $pdo->lastInsertId(), 'slug' => $slug]);
}

// ===== АДМИН: ОБНОВИТЬ =====
if ($method === 'PUT' && !empty($_GET['id'])) {
    requireAdmin();
    $data = json_decode(file_get_contents('php://input'), true);
    $features = is_array($data['features'] ?? null) ? $data['features'] : array_filter(array_map('trim', explode(',', $data['features'] ?? '')));
    $stmt = $pdo->prepare("UPDATE cottages SET name=?, capacity=?, price_min=?, price_max=?, description=?, features=?, image_url=? WHERE id=?");
    $stmt->execute([
        $data['name'],
        (int)($data['capacity'] ?? 4),
        (float)$data['price_min'],
        (float)$data['price_max'],
        $data['description'] ?? '',
        json_encode($features, JSON_UNESCAPED_UNICODE),
        $data['image_url'] ?? '',
        $_GET['id']
    ]);
    jsonResponse(['success' => true]);
}
