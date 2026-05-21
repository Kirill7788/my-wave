<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Config\Session;
use App\Exceptions\AuthException;

class AuthMiddleware
{
    public static function requireAuth(): int
    {
        $userId = Session::get('user_id');
        if (!$userId) {
            throw new AuthException('Требуется авторизация', 401);
        }
        return (int)$userId;
    }
}
