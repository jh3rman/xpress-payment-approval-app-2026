-- Phase 3: Reminders + Auto-cancel + Revival
-- Migration 003: Add reminder scheduling, cancellation, and revival fields

-- ============================================================================
-- A) Update orders table with reminder and cancellation fields
-- ============================================================================

ALTER TABLE orders
  ADD COLUMN reminder_schedule_days int[] NULL,
  ADD COLUMN next_reminder_at timestamptz NULL,
  ADD COLUMN last_reminder_sent_at timestamptz NULL,
  ADD COLUMN reminder_send_count int DEFAULT 0 NOT NULL,
  ADD COLUMN cancelled_at timestamptz NULL,
  ADD COLUMN revived_at timestamptz NULL,
  ADD COLUMN cancellation_due_at timestamptz NULL;

-- Add indexes for reminder processing queries
CREATE INDEX idx_orders_next_reminder_at ON orders(next_reminder_at) WHERE next_reminder_at IS NOT NULL;
CREATE INDEX idx_orders_cancellation_due_at ON orders(cancellation_due_at) WHERE cancellation_due_at IS NOT NULL;
CREATE INDEX idx_orders_cancelled_at ON orders(cancelled_at) WHERE cancelled_at IS NOT NULL;

-- Add comments for clarity
COMMENT ON COLUMN orders.reminder_schedule_days IS 'Array of day numbers when reminders should be sent (e.g., [3, 7, 14] means send on days 3, 7, and 14 after initial_email_sent_at)';
COMMENT ON COLUMN orders.next_reminder_at IS 'Timestamp when the next reminder should be sent';
COMMENT ON COLUMN orders.last_reminder_sent_at IS 'Timestamp when the last reminder was actually sent';
COMMENT ON COLUMN orders.reminder_send_count IS 'Number of reminders sent so far (0-indexed)';
COMMENT ON COLUMN orders.cancelled_at IS 'Timestamp when order was auto-cancelled or manually cancelled';
COMMENT ON COLUMN orders.revived_at IS 'Timestamp when order was last revived (resets timeline)';
COMMENT ON COLUMN orders.cancellation_due_at IS 'Timestamp when order will be auto-cancelled if no approval';

-- ============================================================================
-- B) Create revival_requests table
-- ============================================================================

CREATE TYPE revival_request_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE revival_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  requester_message text NULL,
  status revival_request_status DEFAULT 'pending' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  approved_at timestamptz NULL,
  rejected_at timestamptz NULL,
  admin_notes text NULL
);

-- Indexes for revival_requests
CREATE INDEX idx_revival_requests_order_id ON revival_requests(order_id);
CREATE INDEX idx_revival_requests_status ON revival_requests(status);
CREATE INDEX idx_revival_requests_created_at ON revival_requests(created_at DESC);

-- Auto-update updated_at timestamp
CREATE TRIGGER update_revival_requests_updated_at
  BEFORE UPDATE ON revival_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE revival_requests IS 'Stores customer requests to revive cancelled orders';
COMMENT ON COLUMN revival_requests.requester_message IS 'Optional message from customer explaining why they need revival';

-- ============================================================================
-- C) Create reminder_sends table for idempotency tracking (optional but recommended)
-- ============================================================================

CREATE TABLE reminder_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reminder_number int NOT NULL,
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz DEFAULT now() NOT NULL,
  email_attempt_id uuid NULL REFERENCES email_attempts(id),
  is_final_warning boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for reminder_sends
CREATE INDEX idx_reminder_sends_order_id ON reminder_sends(order_id);
CREATE INDEX idx_reminder_sends_sent_at ON reminder_sends(sent_at DESC);

-- Unique constraint: one reminder per order per reminder number per scheduled time
-- This prevents duplicate sends if processor runs multiple times
CREATE UNIQUE INDEX idx_reminder_sends_unique ON reminder_sends(order_id, reminder_number, scheduled_for);

COMMENT ON TABLE reminder_sends IS 'Ledger of all reminder sends for idempotency and audit trail';
COMMENT ON COLUMN reminder_sends.reminder_number IS 'Which reminder in the sequence (0-indexed, matches reminder_send_count)';
COMMENT ON COLUMN reminder_sends.scheduled_for IS 'When this reminder was scheduled to be sent (used for idempotency)';
COMMENT ON COLUMN reminder_sends.is_final_warning IS 'True if this reminder included cancellation warning';
