<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ValidationException;
use App\Repositories\BookingRepository;
use App\Repositories\CottageRepository;
use App\Validation\Validator;

class BookingService
{
    private BookingRepository  $bookings;
    private CottageRepository  $cottages;
    private Validator          $validator;

    public function __construct()
    {
        $this->bookings  = new BookingRepository();
        $this->cottages  = new CottageRepository();
        $this->validator = new Validator();
    }

    public function create(int $userId, array $data): array
    {
        $this->validator->validate($data, [
            'cottage_id'  => 'required|integer',
            'check_in'    => 'required|date',
            'check_out'   => 'required|date|after:check_in',
            'guest_name'  => 'required|string',
            'guest_phone' => 'required|string',
            'guest_email' => 'required|email',
            'adults'      => 'required|integer|min:1',
        ]);

        if ($data['check_in'] <= date('Y-m-d')) {
            throw new ValidationException(['check_in' => ['Дата заезда должна быть в будущем']]);
        }

        $cottage = $this->cottages->findById((int)$data['cottage_id']);
        if (!$cottage) {
            throw new \DomainException('Коттедж не найден');
        }

        $adults   = (int)$data['adults'];
        $children = (int)($data['children'] ?? 0);
        $total    = $adults + $children;

        if ($total > $cottage['capacity']) {
            throw new ValidationException([
                'adults' => ["Превышена вместимость: максимум {$cottage['capacity']} гостей"],
            ]);
        }

        $checkIn  = new \DateTime($data['check_in']);
        $checkOut = new \DateTime($data['check_out']);
        $nights   = (int)$checkIn->diff($checkOut)->days;

        if ($nights < 1) {
            throw new ValidationException(['check_out' => ['Минимальное бронирование — 1 ночь']]);
        }

        $totalPrice = round((float)$cottage['price_min'] * $nights, 2);

        // createWithLock выполняет транзакцию + SELECT FOR UPDATE + повторную проверку конфликта
        $bookingId = $this->bookings->createWithLock($userId, $data, $totalPrice);

        return ['success' => true, 'booking_id' => $bookingId, 'total_price' => $totalPrice];
    }

    public function listByUser(int $userId): array
    {
        return ['bookings' => $this->bookings->findByUser($userId)];
    }

    public function cancel(int $bookingId, int $userId): array
    {
        $cancelled = $this->bookings->cancel($bookingId, $userId);
        if (!$cancelled) {
            throw new \DomainException('Бронирование не найдено или не может быть отменено');
        }
        return ['success' => true];
    }
}
