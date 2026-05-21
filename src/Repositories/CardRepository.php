<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Config\Database;
use PDO;

class CardRepository
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Database::connection();
    }

    public function findByUser(int $userId): array
    {
        $stmt = $this->pdo->prepare("
            SELECT id, card_last_4, card_holder, exp_month, exp_year, is_default, created_at
            FROM payment_cards
            WHERE user_id = ?
            ORDER BY is_default DESC, created_at DESC
        ");
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    public function create(int $userId, array $data): void
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO payment_cards (user_id, card_last_4, card_holder, exp_month, exp_year)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $userId,
            $data['last_4'],
            strtoupper($data['card_holder']),
            (int)$data['exp_month'],
            (int)$data['exp_year'],
        ]);
    }

    public function setDefault(int $cardId, int $userId): void
    {
        $this->pdo->prepare(
            "UPDATE payment_cards SET is_default = 0 WHERE user_id = ?"
        )->execute([$userId]);

        $this->pdo->prepare(
            "UPDATE payment_cards SET is_default = 1 WHERE id = ? AND user_id = ?"
        )->execute([$cardId, $userId]);
    }

    public function delete(int $cardId, int $userId): void
    {
        $stmt = $this->pdo->prepare(
            "DELETE FROM payment_cards WHERE id = ? AND user_id = ?"
        );
        $stmt->execute([$cardId, $userId]);
    }
}
