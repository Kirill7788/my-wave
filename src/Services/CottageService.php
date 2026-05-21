<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ValidationException;
use App\Repositories\CottageRepository;
use App\Validation\Validator;

class CottageService
{
    private CottageRepository $cottages;
    private Validator         $validator;

    public function __construct()
    {
        $this->cottages  = new CottageRepository();
        $this->validator = new Validator();
    }

    public function getBySlug(string $slug): array
    {
        $cottage = $this->cottages->findBySlug($slug);
        if (!$cottage) {
            throw new \DomainException('Домик не найден');
        }
        return ['cottage' => $cottage];
    }

    public function list(array $filters): array
    {
        $limit    = isset($filters['limit']) ? (int)$filters['limit'] : null;
        $cottages = $this->cottages->findWithFilters($filters, $limit);
        return ['cottages' => $cottages];
    }

    public function create(array $data): array
    {
        $this->validator->validate($data, [
            'name'      => 'required|string',
            'lake_slug' => 'required|string',
            'type_slug' => 'required|string',
            'price_min' => 'required',
            'price_max' => 'required',
            'capacity'  => 'required|integer|min:1',
        ]);

        $lakeId = $this->cottages->getLakeIdBySlug($data['lake_slug']);
        $typeId = $this->cottages->getTypeIdBySlug($data['type_slug']);

        if (!$lakeId || !$typeId) {
            throw new ValidationException(['lake_slug' => ['Неверное озеро или тип домика']]);
        }

        $slug = $this->generateSlug($data['name']);

        $features = is_array($data['features'] ?? null)
            ? $data['features']
            : array_filter(array_map('trim', explode(',', (string)($data['features'] ?? ''))));

        $id = $this->cottages->create([
            'lake_id'     => $lakeId,
            'type_id'     => $typeId,
            'slug'        => $slug,
            'name'        => $data['name'],
            'capacity'    => $data['capacity'],
            'price_min'   => $data['price_min'],
            'price_max'   => $data['price_max'],
            'description' => $data['description'] ?? '',
            'features'    => array_values($features),
            'image_url'   => $data['image_url'] ?? '',
        ]);

        return ['success' => true, 'cottage_id' => $id, 'slug' => $slug];
    }

    public function update(int $id, array $data): array
    {
        $cottage = $this->cottages->findById($id);
        if (!$cottage) {
            throw new \DomainException('Домик не найден');
        }

        $features = is_array($data['features'] ?? null)
            ? $data['features']
            : array_filter(array_map('trim', explode(',', (string)($data['features'] ?? ''))));

        $this->cottages->update($id, array_merge($data, ['features' => array_values($features)]));
        return ['success' => true];
    }

    public function delete(int $id): array
    {
        $this->cottages->softDelete($id);
        return ['success' => true];
    }

    private function generateSlug(string $name): string
    {
        $base = mb_strtolower(trim($name));
        $base = (string)preg_replace('/[^a-z0-9а-яё]+/ui', '-', $base);
        $base = (string)preg_replace('/-+/', '-', $base);
        $base = trim($base, '-');
        $base = substr($base, 0, 60);

        // Гарантируем уникальность — до 10 попыток с разными суффиксами
        $slug = $base;
        $attempt = 0;
        while ($this->cottages->slugExists($slug)) {
            $slug = $base . '-' . substr(bin2hex(random_bytes(3)), 0, 6);
            if (++$attempt >= 10) {
                $slug = $base . '-' . time();
                break;
            }
        }

        return $slug;
    }
}
