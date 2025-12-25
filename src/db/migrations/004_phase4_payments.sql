-- Phase 4: Square Payments Integration
-- Migration 004: Add payment tracking fields

-- ============================================================================
-- A) Update orders table with payment fields
-- ============================================================================

ALTER TABLE orders
  ADD COLUMN payment_status text DEFAULT 'unpaid' NOT NULL,
  ADD COLUMN paid_at timestamptz NULL,
  ADD COLUMN square_payment_id text NULL,
  ADD COLUMN square_idempotency_key text NULL,
  ADD COLUMN tip_amount_cents int DEFAULT 0 NOT NULL,
  ADD COLUMN receipt_email text NULL,
  ADD COLUMN receipt_phone text NULL,
  ADD COLUMN customer_first_name text NULL,
  ADD COLUMN customer_last_name text NULL;

-- Add indexes for payment lookups
CREATE INDEX idx_orders_square_payment_id ON orders(square_payment_id) WHERE square_payment_id IS NOT NULL;
CREATE INDEX idx_orders_payment_status ON orders(payment_status);

-- Add check constraint for payment_status
ALTER TABLE orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'refunded'));

-- Add comments for clarity
COMMENT ON COLUMN orders.payment_status IS 'Payment status: unpaid, pending, paid, failed, refunded';
COMMENT ON COLUMN orders.paid_at IS 'Timestamp when payment was successfully completed';
COMMENT ON COLUMN orders.square_payment_id IS 'Square Payment ID from Square API';
COMMENT ON COLUMN orders.square_idempotency_key IS 'UUID used for idempotent payment creation';
COMMENT ON COLUMN orders.tip_amount_cents IS 'Tip amount in cents (0 if no tip)';
COMMENT ON COLUMN orders.receipt_email IS 'Customer email for receipt (may differ from order email)';
COMMENT ON COLUMN orders.receipt_phone IS 'Customer phone for receipt';
COMMENT ON COLUMN orders.customer_first_name IS 'Customer first name for billing';
COMMENT ON COLUMN orders.customer_last_name IS 'Customer last name for billing';
