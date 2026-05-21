<?php

/**
 * Обратная совместимость: этот файл больше не содержит бизнес-логику.
 * Весь код переехал в src/. Подключается через bootstrap.php.
 *
 * Оставлен для предотвращения ошибок, если какой-то файл делает require 'config.php'.
 */

if (!defined('MYWAVE_BOOTSTRAP_LOADED')) {
    require_once __DIR__ . '/../bootstrap.php';
    define('MYWAVE_BOOTSTRAP_LOADED', true);
}
