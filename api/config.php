<?php

error_reporting(0);
ini_set('display_errors', 0);

// api/config.php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

function getPDO() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=localhost;dbname=mywave;charset=utf8mb4';
        $pdo = new PDO($dsn, 'root', '', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
    }
    return $pdo;
}

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function authRequired() {
    if (!isset($_SESSION['user_id'])) {
        jsonResponse(['error' => 'Требуется авторизация'], 401);
    }
    return $_SESSION['user_id'];
}
?>