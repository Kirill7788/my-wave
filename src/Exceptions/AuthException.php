<?php

declare(strict_types=1);

namespace App\Exceptions;

class AuthException extends AppException
{
    public function __construct(string $message = 'Требуется авторизация', int $code = 401)
    {
        parent::__construct($message, $code);
    }
}
