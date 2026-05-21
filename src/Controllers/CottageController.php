<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Exceptions\AuthException;
use App\Exceptions\ValidationException;
use App\Http\Response;
use App\Middleware\AdminMiddleware;
use App\Services\CottageService;

class CottageController
{
    private CottageService $service;

    public function __construct()
    {
        $this->service = new CottageService();
    }

    public function handle(): never
    {
        $method = $_SERVER['REQUEST_METHOD'];

        try {
            $result = match ($method) {
                'GET'    => $this->get(),
                'POST'   => $this->create(),
                'PUT'    => $this->update(),
                'DELETE' => $this->delete(),
                default  => Response::json(['error' => 'Метод не поддерживается'], 405),
            };
            Response::json($result);

        } catch (ValidationException $e) {
            Response::json(['error' => $e->getMessage(), 'fields' => $e->getErrors()], 422);
        } catch (AuthException $e) {
            Response::json(['error' => $e->getMessage()], $e->getCode() ?: 401);
        } catch (\DomainException $e) {
            Response::json(['error' => $e->getMessage()], 404);
        } catch (\Throwable $e) {
            error_log('[CottageController] ' . $e->getMessage() . ' ' . $e->getFile() . ':' . $e->getLine());
            Response::json(['error' => 'Внутренняя ошибка сервера'], 500);
        }
    }

    private function get(): array
    {
        $slug = $_GET['slug'] ?? '';
        if ($slug !== '') {
            return $this->service->getBySlug($slug);
        }
        return $this->service->list($_GET);
    }

    private function create(): array
    {
        AdminMiddleware::requireAdmin();
        return $this->service->create($this->input());
    }

    private function update(): array
    {
        AdminMiddleware::requireAdmin();
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) throw new \DomainException('Не указан ID домика');
        return $this->service->update($id, $this->input());
    }

    private function delete(): array
    {
        AdminMiddleware::requireAdmin();
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) throw new \DomainException('Не указан ID домика');
        return $this->service->delete($id);
    }

    private function input(): array
    {
        return json_decode(file_get_contents('php://input') ?: '{}', true) ?? [];
    }
}
