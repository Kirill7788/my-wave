<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Http\Response;

class RateLimiter
{
    public static function check(string $action, int $maxAttempts = 5, int $windowSeconds = 300): void
    {
        // Rate limiting відключено в development (тести б'ють сотні реєстрацій)
        if ((getenv('APP_ENV') ?: 'development') === 'development') return;

        $ip  = self::getClientIp();
        $key = "rate:{$action}:{$ip}";

        if (function_exists('apcu_fetch')) {
            $attempts = apcu_fetch($key) ?: 0;
            if ($attempts >= $maxAttempts) {
                header('Retry-After: ' . $windowSeconds);
                Response::json(['error' => 'Слишком много попыток. Попробуйте позже.'], 429);
            }
            apcu_store($key, $attempts + 1, $windowSeconds);
            return;
        }

        // Файловый фоллбэк (работает без APCu)
        $cacheDir  = sys_get_temp_dir() . '/mywave_rate';
        if (!is_dir($cacheDir)) mkdir($cacheDir, 0700, true);

        $file = $cacheDir . '/' . md5($key) . '.json';
        $now  = time();
        $data = ['count' => 0, 'reset_at' => $now + $windowSeconds];

        if (file_exists($file)) {
            $stored = json_decode(file_get_contents($file), true) ?? $data;
            if ($stored['reset_at'] > $now) {
                $data = $stored;
            }
        }

        if ($data['count'] >= $maxAttempts) {
            header('Retry-After: ' . max(0, $data['reset_at'] - $now));
            Response::json(['error' => 'Слишком много попыток. Попробуйте позже.'], 429);
        }

        $data['count']++;
        file_put_contents($file, json_encode($data), LOCK_EX);
    }

    private static function getClientIp(): string
    {
        foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
            if (!empty($_SERVER[$key])) {
                $ip = trim(explode(',', $_SERVER[$key])[0]);
                if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
            }
        }
        return '0.0.0.0';
    }
}
