<?php

declare(strict_types=1);

namespace App\Validation;

use App\Exceptions\ValidationException;

class Validator
{
    public function validate(array $data, array $rules): void
    {
        $errors = [];

        foreach ($rules as $field => $ruleString) {
            $value = $data[$field] ?? null;

            foreach (explode('|', $ruleString) as $rule) {
                $error = $this->applyRule($field, $value, $rule, $data);
                if ($error !== null) {
                    $errors[$field][] = $error;
                    break;
                }
            }
        }

        if (!empty($errors)) {
            throw new ValidationException($errors);
        }
    }

    private function applyRule(string $field, mixed $value, string $rule, array $data): ?string
    {
        if (str_contains($rule, ':')) {
            [$ruleName, $param] = explode(':', $rule, 2);
        } else {
            $ruleName = $rule;
            $param    = null;
        }

        return match ($ruleName) {
            'required'   => (empty($value) && $value !== '0' && $value !== 0)
                                ? "Поле {$field} обязательно"
                                : null,
            'email'      => (!filter_var($value, FILTER_VALIDATE_EMAIL))
                                ? 'Неверный формат email'
                                : null,
            'date'       => (!$this->isValidDate((string)$value))
                                ? 'Неверный формат даты (YYYY-MM-DD)'
                                : null,
            'after'      => ($param === 'today')
                                ? ($value <= date('Y-m-d') ? 'Дата должна быть в будущем' : null)
                                : ($value <= ($data[$param] ?? '') ? "Дата должна быть позже {$param}" : null),
            'integer'    => (!is_numeric($value) || (int)$value != $value)
                                ? "Поле {$field} должно быть целым числом"
                                : null,
            'min'        => ($value < (int)$param)
                                ? "Минимальное значение {$field}: {$param}"
                                : null,
            'max'        => ($value > (int)$param)
                                ? "Максимальное значение {$field}: {$param}"
                                : null,
            'min_length' => (strlen((string)$value) < (int)$param)
                                ? "Минимальная длина {$field}: {$param} символов"
                                : null,
            'string'     => (!is_string($value) && !is_numeric($value))
                                ? "Поле {$field} должно быть строкой"
                                : null,
            default      => null,
        };
    }

    private function isValidDate(string $value): bool
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) return false;
        $d = \DateTime::createFromFormat('Y-m-d', $value);
        return $d && $d->format('Y-m-d') === $value;
    }
}
