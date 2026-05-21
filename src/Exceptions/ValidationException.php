<?php

declare(strict_types=1);

namespace App\Exceptions;

class ValidationException extends AppException
{
    private array $errors;

    public function __construct(array $errors)
    {
        $this->errors = $errors;
        $first = reset($errors);
        parent::__construct(is_array($first) ? implode(', ', $first) : $first, 422);
    }

    public function getErrors(): array
    {
        return $this->errors;
    }
}
