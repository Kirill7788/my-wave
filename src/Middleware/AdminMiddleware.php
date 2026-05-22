<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Config\Database;
use App\Config\Session;
use App\Exceptions\AuthException;

class AdminMiddleware
{
    public static function requireAdmin(): int
    {
        $userId = Session::get('user_id');
        if (!$userId) {
            throw new AuthException('Требуется авторизация', 401);
        }

        $pdo  = Database::connection();
        $stmt = $pdo->prepare("SELECT role FROM users WHERE id = ? AND is_active = 1");
        $stmt->execute([$userId]);
        $role = $stmt->fetchColumn();

        if ($role !== 'admin') {
            throw new AuthException('Доступ запрещён', 403);
        }

        return (int)$userId;
    }
}
