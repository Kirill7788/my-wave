<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Exceptions\AuthException;
use App\Exceptions\ValidationException;
use App\Http\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\RateLimiter;
use App\Services\AuthService;

class AuthController
{
    private AuthService $service;

    public function __construct()
    {
        $this->service = new AuthService();
    }

    public function handle(): never
    {
        $method = $_SERVER['REQUEST_METHOD'];
        $action = $_GET['action'] ?? '';

        try {
            $result = match ([$method, $action]) {
                ['POST', 'register']       => $this->register(),
                ['POST', 'login']          => $this->login(),
                ['POST', 'logout']         => $this->logout(),
                ['GET',  'me']             => $this->me(),
                ['POST', 'update_profile'] => $this->updateProfile(),
                ['POST', 'update_password']=> $this->updatePassword(),
                ['POST', 'reset_password'] => $this->resetPassword(),
                ['POST', 'confirm_reset']  => $this->confirmReset(),
                default                    => Response::json(['error' => 'Неизвестное действие'], 404),
            };
            Response::json($result);

        } catch (ValidationException $e) {
            Response::json(['error' => $e->getMessage(), 'fields' => $e->getErrors()], 422);
        } catch (AuthException $e) {
            Response::json(['error' => $e->getMessage()], $e->getCode() ?: 401);
        } catch (\DomainException $e) {
            Response::json(['error' => $e->getMessage()], 400);
        } catch (\Throwable $e) {
            error_log('[AuthController] ' . $e->getMessage() . ' ' . $e->getFile() . ':' . $e->getLine());
            Response::json(['error' => 'Внутренняя ошибка сервера'], 500);
        }
    }

    private function register(): array
    {
        RateLimiter::check('register', 10, 3600);
        return $this->service->register($this->input());
    }

    private function login(): array
    {
        RateLimiter::check('login', 10, 300);
        return $this->service->login($this->input());
    }

    private function logout(): array
    {
        return $this->service->logout();
    }

    private function me(): array
    {
        $userId = AuthMiddleware::requireAuth();
        return $this->service->me($userId);
    }

    private function updateProfile(): array
    {
        $userId = AuthMiddleware::requireAuth();
        return $this->service->updateProfile($userId, $this->input());
    }

    private function updatePassword(): array
    {
        $userId = AuthMiddleware::requireAuth();
        return $this->service->updatePassword($userId, $this->input());
    }

    private function resetPassword(): array
    {
        RateLimiter::check('reset_password', 3, 3600);
        return $this->service->resetPassword($this->input());
    }

    private function confirmReset(): array
    {
        return $this->service->confirmReset($this->input());
    }

    private function input(): array
    {
        $raw = file_get_contents('php://input');
        return json_decode($raw ?: '{}', true) ?? [];
    }
}
