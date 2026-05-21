DELIMITER $$
CREATE TRIGGER after_booking_update
AFTER UPDATE ON bookings
FOR EACH ROW
BEGIN
    INSERT INTO booking_history (booking_id, changed_by, action, old_values, new_values)
    VALUES (
        NEW.id,
        @current_user_id,
        'updated',
        JSON_OBJECT('status', OLD.status, 'check_in', OLD.check_in, 'check_out', OLD.check_out),
        JSON_OBJECT('status', NEW.status, 'check_in', NEW.check_in, 'check_out', NEW.check_out)
    );
END$$
DELIMITER ;
