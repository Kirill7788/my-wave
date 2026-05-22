<?php

declare(strict_types=1);

namespace App\Services;

use App\Config\Session;
use App\Exceptions\AuthException;
use App\Exceptions\ValidationException;
use App\Repositories\UserRepository;
use App\Validation\Validator;

class AuthService
{
    private UserRepository $users;
    private Validator $validator;

    public function __construct()
    {
        $this->users     = new UserRepository();
        $this->validator = new Validator();
    }

    public function register(array $data): array
    {
        $this->validator->validate($data, [
            'email'      => 'required|email',
            'password'   => 'required|min_length:6',
            'first_name' => 'required|string',
            'phone'      => 'required|string',
        ]);

        if ($this->users->emailExists($data['email'])) {
            throw new ValidationException(['email' => ['Email уже зарегистрирован']]);
        }

        $hash   = password_hash($data['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        $userId = $this->users->create($data['email'], $hash, $data['first_name'], $data['phone']);

        Session::regenerate();
        Session::set('user_id', $userId);

        return ['success' => true, 'user_id' => $userId];
    }

    public function login(array $data): array
    {
        $this->validator->validate($data, [
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        $user = $this->users->findByEmail($data['email']);

        // Timing attack protection: bcrypt вычисляется даже для несуществующего email.
        // Константа — полноценный bcrypt-хеш строки "dummy", чтобы password_verify
        // тратила одинаковое время независимо от того, найден пользователь или нет.
        $hash  = $user['password_hash'] ?? '$2y$12$abcdefghijklmnopqrstuuCvCgvAfFQL9jCc.7U4oMSMlXnrZF4S6';
        $valid = password_verify($data['password'], $hash);

        if (!$user || !$valid) {
            throw new AuthException('Неверный email или пароль', 401);
        }

        Session::regenerate();
        Session::set('user_id', $user['id']);

        return [
            'success' => true,
            'user'    => [
                'id'         => $user['id'],
                'name'       => $user['first_name'],
                'email'      => $user['email'],
                'role'       => $user['role'],
                'first_name' => $user['first_name'],
            ],
        ];
    }

    public function logout(): array
    {
        Session::destroy();
        return ['success' => true];
    }

    public function me(int $userId): array
    {
        $user = $this->users->findById($userId);
        if (!$user) {
            throw new AuthException('Пользователь не найден', 404);
        }
        return ['user' => $user];
    }

    public function updateProfile(int $userId, array $data): array
    {
        $current = $this->users->findById($userId);
        if (!$current) {
            throw new AuthException('Пользователь не найден', 404);
        }

        $firstName = $data['first_name'] ?? $current['first_name'];
        $lastName  = $data['last_name']  ?? $current['last_name'];
        $phone     = $data['phone']       ?? $current['phone'];

        $this->users->updateProfile($userId, (string)$firstName, (string)$lastName, (string)$phone);
        return ['success' => true];
    }

    public function updatePassword(int $userId, array $data): array
    {
        $this->validator->validate($data, [
            'current_password' => 'required',
            'new_password'     => 'required|min_length:6',
        ]);

        $currentHash = $this->users->getPasswordHash($userId);
        if (!$currentHash || !password_verify($data['current_password'], $currentHash)) {
            throw new AuthException('Неверный текущий пароль', 403);
        }

        $newHash = password_hash($data['new_password'], PASSWORD_BCRYPT, ['cost' => 12]);
        $this->users->updatePassword($userId, $newHash);

        return ['success' => true];
    }

    public function resetPassword(array $data): array
    {
        $this->validator->validate($data, ['email' => 'required|email']);

        $user = $this->users->findByEmail($data['email']);

        // Всегда возвращаем success — не раскрываем наличие email
        if (!$user) {
            return ['success' => true];
        }

        $token     = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+1 hour'));

        $this->users->createPasswordReset($user['id'], $token, $expiresAt);

        $appUrl    = rtrim(getenv('APP_URL') ?: 'http://localhost', '/');
        $resetLink = "{$appUrl}/reset-password.html?token={$token}";

        // TODO: заменить на реальную отправку email (PHPMailer / SMTP)
        error_log("[PasswordReset] {$user['email']} → {$resetLink}");

        return ['success' => true];
    }

    public function confirmReset(array $data): array
    {
        $this->validator->validate($data, [
            'token'        => 'required',
            'new_password' => 'required|min_length:6',
        ]);

        $reset = $this->users->findPasswordReset($data['token']);

        if (!$reset) {
            throw new AuthException('Неверный или использованный токен', 400);
        }

        if (strtotime($reset['expires_at']) < time()) {
            throw new AuthException('Срок действия токена истёк', 400);
        }

        $newHash = password_hash($data['new_password'], PASSWORD_BCRYPT, ['cost' => 12]);
        $this->users->updatePassword((int)$reset['user_id'], $newHash);
        $this->users->markResetUsed($data['token']);

        return ['success' => true];
    }
}
