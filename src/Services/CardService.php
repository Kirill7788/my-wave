<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ValidationException;
use App\Repositories\CardRepository;
use App\Validation\Validator;

class CardService
{
    private CardRepository $cards;
    private Validator      $validator;

    public function __construct()
    {
        $this->cards     = new CardRepository();
        $this->validator = new Validator();
    }

    public function list(int $userId): array
    {
        return ['cards' => $this->cards->findByUser($userId)];
    }

    public function add(int $userId, array $data): array
    {
        $this->validator->validate($data, [
            'card_number' => 'required',
            'card_holder' => 'required|string',
            'exp_month'   => 'required|integer|min:1|max:12',
            'exp_year'    => 'required|integer',
            'cvc'         => 'required',
        ]);

        $cardNumber = preg_replace('/\s+/', '', (string)$data['card_number']);
        if (!preg_match('/^\d{16}$/', $cardNumber)) {
            throw new ValidationException(['card_number' => ['Неверный формат номера карты (16 цифр)']]);
        }

        $expYear = (int)$data['exp_year'];
        if ($expYear < 100) $expYear += 2000;

        $now = new \DateTime();
        $exp = \DateTime::createFromFormat('n/Y', $data['exp_month'] . '/' . $expYear);
        if (!$exp || $exp < $now) {
            throw new ValidationException(['exp_month' => ['Карта просрочена']]);
        }

        // Храним только last_4 — без хеша номера карты
        $this->cards->create($userId, [
            'last_4'      => substr($cardNumber, -4),
            'card_holder' => $data['card_holder'],
            'exp_month'   => $data['exp_month'],
            'exp_year'    => $expYear,
        ]);

        return ['success' => true];
    }

    public function setDefault(int $cardId, int $userId): array
    {
        $this->cards->setDefault($cardId, $userId);
        return ['success' => true];
    }

    public function delete(int $cardId, int $userId): array
    {
        $this->cards->delete($cardId, $userId);
        return ['success' => true];
    }
}
