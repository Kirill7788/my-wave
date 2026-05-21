<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Exceptions\AuthException;
use App\Exceptions\BookingConflictException;
use App\Exceptions\ValidationException;
use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Services\BookingService;

class BookingController
{
    private BookingService $service;

    public function __construct()
    {
        $this->service = new BookingService();
    }

    public function handle(): never
    {
        $method = $_SERVER['REQUEST_METHOD'];

        try {
            $userId = AuthMiddleware::requireAuth();

            $result = match ($method) {
                'GET'    => $this->service->listByUser($userId),
                'POST'   => $this->service->create($userId, $this->input()),
                'DELETE' => $this->cancel($userId),
                default  => Response::json(['error' => 'Метод не поддерживается'], 405),
            };

            $code = ($method === 'POST') ? 201 : 200;
            Response::json($result, $code);

        } catch (BookingConflictException $e) {
            Response::json(['error' => $e->getMessage()], 409);
        } catch (ValidationException $e) {
            Response::json(['error' => $e->getMessage(), 'fields' => $e->getErrors()], 422);
        } catch (AuthException $e) {
            Response::json(['error' => $e->getMessage()], $e->getCode() ?: 401);
        } catch (\DomainException $e) {
            Response::json(['error' => $e->getMessage()], 400);
        } catch (\Throwable $e) {
            error_log('[BookingController] ' . $e->getMessage() . ' ' . $e->getFile() . ':' . $e->getLine());
            Response::json(['error' => 'Внутренняя ошибка сервера'], 500);
        }
    }

    private function cancel(int $userId): array
    {
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) {
            throw new \DomainException('Не указан ID бронирования');
        }
        return $this->service->cancel($id, $userId);
    }

    private function input(): array
    {
        $decoded = json_decode(file_get_contents('php://input') ?: '{}', true);
        return is_array($decoded) ? $decoded : [];
    }
}
