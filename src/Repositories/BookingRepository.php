<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Config\Database;
use PDO;

class BookingRepository
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Database::connection();
    }

    public function findByUser(int $userId): array
    {
        $stmt = $this->pdo->prepare("
            SELECT b.id, b.cottage_id, b.check_in, b.check_out, b.guests, b.adults, b.children,
                   b.total_price, b.status, b.guest_name, b.guest_phone, b.guest_email, b.created_at,
                   c.name AS cottage_name, c.slug AS cottage_slug
            FROM bookings b
            JOIN cottages c ON b.cottage_id = c.id
            WHERE b.user_id = ?
            ORDER BY b.created_at DESC
        ");
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->pdo->prepare("SELECT * FROM bookings WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    /**
     * Проверяет конфликт дат БЕЗ блокировки (используется до транзакции для быстрого ответа).
     */
    public function hasConflict(int $cottageId, string $checkIn, string $checkOut, ?int $excludeBookingId = null): bool
    {
        $sql    = "SELECT COUNT(*) FROM bookings
                   WHERE cottage_id = ? AND status NOT IN ('cancelled')
                   AND check_in < ? AND check_out > ?";
        $params = [$cottageId, $checkOut, $checkIn];

        if ($excludeBookingId !== null) {
            $sql      .= " AND id != ?";
            $params[] = $excludeBookingId;
        }

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return (int)$stmt->fetchColumn() > 0;
    }

    /**
     * Создаёт бронирование внутри транзакции с блокировкой строки коттеджа.
     * Возвращает ID созданного бронирования.
     */
    public function createWithLock(int $userId, array $data, float $totalPrice): int
    {
        $this->pdo->beginTransaction();

        try {
            // Блокируем строку коттеджа на всё время транзакции
            $stmt = $this->pdo->prepare(
                "SELECT id FROM cottages WHERE id = ? AND is_active = 1 FOR UPDATE"
            );
            $stmt->execute([$data['cottage_id']]);
            if (!$stmt->fetch()) {
                throw new \DomainException('Коттедж не найден');
            }

            // Повторная проверка конфликта уже внутри транзакции (после блокировки)
            if ($this->hasConflict($data['cottage_id'], $data['check_in'], $data['check_out'])) {
                throw new \App\Exceptions\BookingConflictException();
            }

            $stmt = $this->pdo->prepare("
                INSERT INTO bookings
                    (user_id, cottage_id, check_in, check_out, guests, adults, children,
                     total_price, guest_name, guest_phone, guest_email, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            ");
            $adults   = (int)($data['adults'] ?? 1);
            $children = (int)($data['children'] ?? 0);

            $stmt->execute([
                $userId,
                (int)$data['cottage_id'],
                $data['check_in'],
                $data['check_out'],
                $adults + $children,
                $adults,
                $children,
                $totalPrice,
                $data['guest_name'],
                $data['guest_phone'],
                $data['guest_email'],
            ]);

            $id = (int)$this->pdo->lastInsertId();
            $this->pdo->commit();
            return $id;

        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    public function cancel(int $id, int $userId): bool
    {
        $stmt = $this->pdo->prepare(
            "UPDATE bookings SET status = 'cancelled'
             WHERE id = ? AND user_id = ? AND status IN ('pending', 'confirmed')"
        );
        $stmt->execute([$id, $userId]);
        return $stmt->rowCount() > 0;
    }
}
