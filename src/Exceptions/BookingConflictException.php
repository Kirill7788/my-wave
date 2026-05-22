<?php

declare(strict_types=1);

namespace App\Exceptions;

class BookingConflictException extends AppException
{
    public function __construct(string $message = 'Эти даты уже заняты')
    {
        parent::__construct($message, 409);
    }
}
