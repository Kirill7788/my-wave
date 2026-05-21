<?php
require_once 'config.php';

$pdo = getPDO();
$stmt = $pdo->prepare("SELECT id, email, password_hash, first_name FROM users");
$stmt->execute();
$users = $stmt->fetchAll();

echo "<h2>Пользователи в БД:</h2><pre>";
foreach ($users as $u) {
    echo "Email: {$u['email']}\n";
    echo "Hash: {$u['password_hash']}\n";
    echo "Проверка 123456: " . (password_verify('123456', $u['password_hash']) ? '✅ OK' : '❌ FAIL') . "\n\n";
}
echo "</pre>";
