<?php

declare(strict_types=1);

// Загрузка .env
(function () {
    $envFile = __DIR__ . '/.env';
    if (!file_exists($envFile)) return;

    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) continue;

        [$key, $value] = explode('=', $line, 2);
        $key   = trim($key);
        $value = trim($value, " \t\n\r\0\x0B\"'");

        if (!isset($_ENV[$key]) && !isset($_SERVER[$key])) {
            putenv("$key=$value");
            $_ENV[$key]    = $value;
            $_SERVER[$key] = $value;
        }
    }
})();

// Autoload
require_once __DIR__ . '/vendor/autoload.php';

// Настройка ошибок — display_errors всегда off для API (ошибки не должны ломать JSON)
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Глобальный обработчик непойманных исключений
set_exception_handler(function (Throwable $e) {
    error_log('[Unhandled] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['error' => 'Внутренняя ошибка сервера'], JSON_UNESCAPED_UNICODE);
    exit;
});

// Запуск сессии через конфиг
\App\Config\Session::start();
