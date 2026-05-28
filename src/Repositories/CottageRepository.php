<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Config\Database;
use PDO;

class CottageRepository
{
    private PDO $pdo;

    private const BASE_SELECT = "
        SELECT c.id, c.slug, c.name, c.capacity, c.price_min, c.price_max,
               c.description, c.features, c.image_url, c.created_at,
               l.name  AS lake_name,  l.slug AS lake_slug,  l.region,
               t.name  AS type_name,  t.slug AS type_slug
        FROM cottages c
        JOIN lakes l ON c.lake_id = l.id
        JOIN cottage_types t ON c.type_id = t.id
        WHERE c.is_active = 1
    ";

    public function __construct()
    {
        $this->pdo = Database::connection();
    }

    public function findBySlug(string $slug): ?array
    {
        $stmt = $this->pdo->prepare(self::BASE_SELECT . " AND c.slug = ?");
        $stmt->execute([$slug]);
        $cottage = $stmt->fetch();
        if (!$cottage) return null;
        return $this->decodeFeatures($cottage);
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->pdo->prepare(self::BASE_SELECT . " AND c.id = ?");
        $stmt->execute([$id]);
        $cottage = $stmt->fetch();
        if (!$cottage) return null;
        return $this->decodeFeatures($cottage);
    }

    public function findWithFilters(array $filters, ?int $limit = null): array
    {
        $sql    = self::BASE_SELECT;
        $params = [];

        if (!empty($filters['type'])) {
            $sql      .= " AND t.slug = ?";
            $params[] = $filters['type'];
        }
        if (!empty($filters['region'])) {
            $sql      .= " AND l.region = ?";
            $params[] = $filters['region'];
        }
        if (!empty($filters['lake'])) {
            $sql      .= " AND l.slug = ?";
            $params[] = $filters['lake'];
        }
        if (!empty($filters['min_price'])) {
            $sql      .= " AND c.price_max >= ?";
            $params[] = (float)$filters['min_price'];
        }
        if (!empty($filters['max_price'])) {
            $sql      .= " AND c.price_min <= ?";
            $params[] = (float)$filters['max_price'];
        }
        if (!empty($filters['has_bath'])) {
            // LIKE по JSON-строке — самый надёжный способ без JSON_TABLE (MySQL 5.7+)
            $sql .= " AND (c.features LIKE '%Баня%' OR c.features LIKE '%Сауна%')";
        }

        $sql .= " ORDER BY c.created_at DESC";

        if ($limit !== null) {
            $sql .= " LIMIT " . (int)$limit;
        }

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        return array_map([$this, 'decodeFeatures'], $rows);
    }

    public function create(array $data): int
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO cottages
                (lake_id, type_id, slug, name, capacity, price_min, price_max, description, features, image_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['lake_id'],
            $data['type_id'],
            $data['slug'],
            $data['name'],
            (int)$data['capacity'],
            (float)$data['price_min'],
            (float)$data['price_max'],
            $data['description'] ?? '',
            json_encode($data['features'] ?? [], JSON_UNESCAPED_UNICODE),
            $data['image_url'] ?? '',
        ]);
        return (int)$this->pdo->lastInsertId();
    }

    public function update(int $id, array $data): void
    {
        $stmt = $this->pdo->prepare("
            UPDATE cottages
            SET name = ?, capacity = ?, price_min = ?, price_max = ?,
                description = ?, features = ?, image_url = ?
            WHERE id = ? AND is_active = 1
        ");
        $stmt->execute([
            $data['name'],
            (int)$data['capacity'],
            (float)$data['price_min'],
            (float)$data['price_max'],
            $data['description'] ?? '',
            json_encode($data['features'] ?? [], JSON_UNESCAPED_UNICODE),
            $data['image_url'] ?? '',
            $id,
        ]);
    }

    public function softDelete(int $id): void
    {
        $stmt = $this->pdo->prepare(
            "UPDATE cottages SET is_active = 0, deleted_at = NOW() WHERE id = ?"
        );
        $stmt->execute([$id]);
    }

    public function getLakeIdBySlug(string $slug): ?int
    {
        $stmt = $this->pdo->prepare("SELECT id FROM lakes WHERE slug = ?");
        $stmt->execute([$slug]);
        $id = $stmt->fetchColumn();
        return $id !== false ? (int)$id : null;
    }

    public function getTypeIdBySlug(string $slug): ?int
    {
        $stmt = $this->pdo->prepare("SELECT id FROM cottage_types WHERE slug = ?");
        $stmt->execute([$slug]);
        $id = $stmt->fetchColumn();
        return $id !== false ? (int)$id : null;
    }

    public function slugExists(string $slug): bool
    {
        $stmt = $this->pdo->prepare("SELECT 1 FROM cottages WHERE slug = ?");
        $stmt->execute([$slug]);
        return (bool)$stmt->fetchColumn();
    }

    private function decodeFeatures(array $cottage): array
    {
        if (is_string($cottage['features'])) {
            $cottage['features'] = json_decode($cottage['features'], true) ?? [];
        }
        return $cottage;
    }
}
