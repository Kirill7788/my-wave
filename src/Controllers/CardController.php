<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Exceptions\AuthException;
use App\Exceptions\ValidationException;
use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Services\CardService;

class CardController
{
    private CardService $service;

    public function __construct()
    {
        $this->service = new CardService();
    }

    public function handle(): never
    {
        $method = $_SERVER['REQUEST_METHOD'];

        try {
            $userId = AuthMiddleware::requireAuth();

            $result = match ($method) {
                'GET'    => $this->service->list($userId),
                'POST'   => $this->service->add($userId, $this->input()),
                'PUT'    => $this->setDefault($userId),
                'DELETE' => $this->delete($userId),
                default  => Response::json(['error' => 'Метод не поддерживается'], 405),
            };
            Response::json($result);

        } catch (ValidationException $e) {
            Response::json(['error' => $e->getMessage(), 'fields' => $e->getErrors()], 422);
        } catch (AuthException $e) {
            Response::json(['error' => $e->getMessage()], $e->getCode() ?: 401);
        } catch (\Throwable $e) {
            error_log('[CardController] ' . $e->getMessage() . ' ' . $e->getFile() . ':' . $e->getLine());
            Response::json(['error' => 'Внутренняя ошибка сервера'], 500);
        }
    }

    private function setDefault(int $userId): array
    {
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) throw new \DomainException('Не указан ID карты');
        return $this->service->setDefault($id, $userId);
    }

    private function delete(int $userId): array
    {
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) throw new \DomainException('Не указан ID карты');
        return $this->service->delete($id, $userId);
    }

    private function input(): array
    {
        $decoded = json_decode(file_get_contents('php://input') ?: '{}', true);
        return is_array($decoded) ? $decoded : [];
    }
}
