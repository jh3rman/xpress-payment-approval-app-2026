-- ================================================================
-- MIGRATION: 002_phase2_email_fields.sql
-- Description: Add email tracking fields for Phase 2
-- Created: 2025-12-25
-- ================================================================

-- ================================================================
-- ORDERS TABLE UPDATES
-- ================================================================

-- Add email tracking fields to orders table
ALTER TABLE orders
ADD COLUMN last_email_sent_at TIMESTAMPTZ NULL,
ADD COLUMN initial_email_status TEXT DEFAULT 'not_sent',
ADD COLUMN email_issue_reason TEXT NULL;

-- Add index for email status queries
CREATE INDEX orders_initial_email_status_idx ON orders(initial_email_status);

-- Update existing orders to have proper status
UPDATE orders SET initial_email_status = 'not_sent' WHERE initial_email_sent_at IS NULL;
UPDATE orders SET initial_email_status = 'sent' WHERE initial_email_sent_at IS NOT NULL;

COMMENT ON COLUMN orders.last_email_sent_at IS 'Timestamp of the most recent email sent for this order';
COMMENT ON COLUMN orders.initial_email_status IS 'Status of initial email: not_sent, queued, sent, delivered, bounced, failed, dropped';
COMMENT ON COLUMN orders.email_issue_reason IS 'Reason for email failure if email_issue is true';

-- ================================================================
-- EMAIL_ATTEMPTS TABLE UPDATES
-- ================================================================

-- Add index on provider_message_id for webhook lookups
CREATE INDEX email_attempts_provider_message_id_idx ON email_attempts(provider_message_id);

COMMENT ON INDEX email_attempts_provider_message_id_idx IS 'Index for looking up email attempts by Mailgun message ID';

-- ================================================================
-- END OF MIGRATION
-- ================================================================
