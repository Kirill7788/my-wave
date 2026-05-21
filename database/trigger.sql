-- Триггер: автоматически записывает изменения бронирований в историю

DELIMITER $$

DROP TRIGGER IF EXISTS after_booking_update$$

CREATE TRIGGER after_booking_update
AFTER UPDATE ON bookings
FOR EACH ROW
BEGIN
    INSERT INTO booking_history
        (booking_id, changed_by, action, old_values, new_values)
    VALUES (
        NEW.id,
        @current_user_id,
        'updated',
        JSON_OBJECT(
            'status',    OLD.status,
            'check_in',  OLD.check_in,
            'check_out', OLD.check_out
        ),
        JSON_OBJECT(
            'status',    NEW.status,
            'check_in',  NEW.check_in,
            'check_out', NEW.check_out
        )
    );
END$$

DELIMITER ;

-- Автоматическая очистка просроченных и использованных токенов сброса пароля
-- Требует включения event scheduler: SET GLOBAL event_scheduler = ON;
DROP EVENT IF EXISTS cleanup_expired_resets;

CREATE EVENT IF NOT EXISTS cleanup_expired_resets
    ON SCHEDULE EVERY 1 HOUR
    DO
        DELETE FROM password_resets
        WHERE expires_at < NOW() OR used = 1;
