<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Config\Database;
use PDO;

class UserRepository
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Database::connection();
    }

    public function findByEmail(string $email): ?array
    {
        $stmt = $this->pdo->prepare(
            "SELECT id, email, password_hash, first_name, last_name, phone, role
             FROM users WHERE email = ? AND is_active = 1"
        );
        $stmt->execute([$email]);
        return $stmt->fetch() ?: null;
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            "SELECT id, email, first_name, last_name, phone, role
             FROM users WHERE id = ? AND is_active = 1"
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function emailExists(string $email): bool
    {
        $stmt = $this->pdo->prepare("SELECT 1 FROM users WHERE email = ?");
        $stmt->execute([$email]);
        return (bool)$stmt->fetchColumn();
    }

    public function create(string $email, string $passwordHash, string $firstName, string $phone): int
    {
        $stmt = $this->pdo->prepare(
            "INSERT INTO users (email, password_hash, first_name, phone, role) VALUES (?, ?, ?, ?, 'user')"
        );
        $stmt->execute([$email, $passwordHash, $firstName, $phone]);
        return (int)$this->pdo->lastInsertId();
    }

    public function updateProfile(int $id, string $firstName, string $lastName, string $phone): void
    {
        $stmt = $this->pdo->prepare(
            "UPDATE users SET first_name = ?, last_name = ?, phone = ? WHERE id = ?"
        );
        $stmt->execute([$firstName, $lastName, $phone, $id]);
    }

    public function updatePassword(int $id, string $passwordHash): void
    {
        $stmt = $this->pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
        $stmt->execute([$passwordHash, $id]);
    }

    public function getPasswordHash(int $id): ?string
    {
        $stmt = $this->pdo->prepare("SELECT password_hash FROM users WHERE id = ?");
        $stmt->execute([$id]);
        $hash = $stmt->fetchColumn();
        return $hash !== false ? $hash : null;
    }

    public function createPasswordReset(int $userId, string $token, string $expiresAt): void
    {
        $stmt = $this->pdo->prepare(
            "INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)"
        );
        $stmt->execute([$userId, $token, $expiresAt]);
    }

    public function findPasswordReset(string $token): ?array
    {
        $stmt = $this->pdo->prepare(
            "SELECT user_id, expires_at FROM password_resets
             WHERE token = ? AND used = 0"
        );
        $stmt->execute([$token]);
        return $stmt->fetch() ?: null;
    }

    public function markResetUsed(string $token): void
    {
        $stmt = $this->pdo->prepare("UPDATE password_resets SET used = 1 WHERE token = ?");
        $stmt->execute([$token]);
    }
}
