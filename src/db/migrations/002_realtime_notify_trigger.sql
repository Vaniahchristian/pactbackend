-- Postgres NOTIFY trigger for real-time events
-- This replaces Supabase's built-in postgres_changes realtime.
-- The pact-backend listens on the `pact_events` channel via LISTEN.

CREATE OR REPLACE FUNCTION pact_notify_event()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  recipient_id TEXT;
BEGIN
  -- For notifications table, target specific recipient
  IF TG_TABLE_NAME = 'notifications' THEN
    recipient_id := NEW.recipient_id;
    payload := jsonb_build_object(
      'event', 'notification:new',
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW),
      'recipient_id', recipient_id
    );
  ELSIF TG_TABLE_NAME = 'chat_messages' THEN
    payload := jsonb_build_object(
      'event', 'chat:message',
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW),
      'room', 'chat:' || NEW.chat_id
    );
  ELSIF TG_TABLE_NAME = 'down_payment_requests' THEN
    payload := jsonb_build_object(
      'event', 'downpayment:update',
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW),
      'hub_id', NEW.hub_id
    );
  ELSE
    payload := jsonb_build_object(
      'event', TG_TABLE_NAME || ':' || lower(TG_OP),
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW)
    );
  END IF;

  PERFORM pg_notify('pact_events', payload::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to key tables
DROP TRIGGER IF EXISTS notify_notifications ON notifications;
CREATE TRIGGER notify_notifications
  AFTER INSERT OR UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION pact_notify_event();

DROP TRIGGER IF EXISTS notify_chat_messages ON chat_messages;
CREATE TRIGGER notify_chat_messages
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION pact_notify_event();

DROP TRIGGER IF EXISTS notify_down_payment_requests ON down_payment_requests;
CREATE TRIGGER notify_down_payment_requests
  AFTER INSERT OR UPDATE ON down_payment_requests
  FOR EACH ROW EXECUTE FUNCTION pact_notify_event();
