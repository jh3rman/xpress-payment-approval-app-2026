-- ================================================================
-- MIGRATION: 001_initial_schema.sql
-- Description: Initial database schema for Client Approval + Payment Portal
-- Created: 2025-12-25
-- ================================================================

-- ================================================================
-- ENUMS
-- ================================================================

CREATE TYPE order_status AS ENUM (
  'pending',
  'completed',
  'cancelled',
  'archived'
);

CREATE TYPE approval_status AS ENUM (
  'pending',
  'approved',
  'changes_requested'
);

CREATE TYPE sender_role AS ENUM (
  'customer',
  'admin'
);

CREATE TYPE email_type AS ENUM (
  'initial',
  'reminder',
  'cancellation',
  'revival',
  'msg_to_customer',
  'msg_to_admin'
);

CREATE TYPE email_status AS ENUM (
  'queued',
  'sent',
  'delivered',
  'bounced',
  'failed',
  'dropped'
);

CREATE TYPE file_type AS ENUM (
  'invoice',
  'artwork'
);

CREATE TYPE tip_mode AS ENUM (
  'fixed',
  'percent'
);

-- ================================================================
-- TABLES
-- ================================================================

-- ----------------------------------------------------------------
-- Table: settings
-- Description: Global application settings (single-row table)
-- ----------------------------------------------------------------

CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Company Profile
  company_name TEXT,
  phone TEXT,
  email TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  hours TEXT,
  website_url TEXT,

  -- Email Defaults
  default_from_email TEXT,
  admin_notify_email TEXT,

  -- Tipping Configuration
  tip_mode tip_mode DEFAULT 'fixed',
  tip_presets INT[], -- fixed = cents, percent = whole integers (e.g., 15)

  -- Reminder & Cancellation Settings
  reminder_days INT[] DEFAULT '{3,7,14}',
  auto_cancel_days INT DEFAULT 20,

  -- Notification Toggles (JSON storage for flexibility)
  notification_toggles JSONB DEFAULT '{}'::JSONB,

  -- Email Templates (JSON storage for flexibility)
  email_templates JSONB DEFAULT '{}'::JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one settings row exists
CREATE UNIQUE INDEX settings_singleton_idx ON settings ((id IS NOT NULL));

COMMENT ON TABLE settings IS 'Global application settings (singleton table)';
COMMENT ON COLUMN settings.tip_presets IS 'Array of tip preset values: cents if fixed mode, whole integers if percent mode';
COMMENT ON COLUMN settings.reminder_days IS 'Array of days after which to send reminder emails';
COMMENT ON COLUMN settings.auto_cancel_days IS 'Number of days before auto-cancelling pending orders';

-- ----------------------------------------------------------------
-- Table: orders
-- Description: Customer orders with approval workflow
-- ----------------------------------------------------------------

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,

  -- Customer Information
  customer_email TEXT NOT NULL,
  cc_emails TEXT[],

  -- Order Details
  order_title TEXT NOT NULL,
  internal_notes TEXT,

  -- Payment Configuration
  payment_required BOOLEAN DEFAULT FALSE,
  order_amount_cents INT,
  allow_tip BOOLEAN DEFAULT FALSE,

  -- Email Configuration
  from_email TEXT NOT NULL,

  -- Order Status
  status order_status DEFAULT 'pending',

  -- Chat & Communication
  chat_open BOOLEAN DEFAULT TRUE,
  email_issue BOOLEAN DEFAULT FALSE,

  -- Email & Tracking
  initial_email_sent_at TIMESTAMPTZ,
  first_viewed_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ,
  view_count INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX orders_token_idx ON orders(token);
CREATE INDEX orders_status_idx ON orders(status);
CREATE INDEX orders_initial_email_sent_at_idx ON orders(initial_email_sent_at);
CREATE INDEX orders_email_issue_idx ON orders(email_issue);

COMMENT ON TABLE orders IS 'Customer orders with approval and payment workflow';
COMMENT ON COLUMN orders.token IS 'Unique token for customer access to order page';
COMMENT ON COLUMN orders.order_amount_cents IS 'Order amount in cents (USD)';
COMMENT ON COLUMN orders.email_issue IS 'Flag indicating email delivery problems';

-- ----------------------------------------------------------------
-- Table: order_files
-- Description: Files attached to orders (invoices, artwork)
-- ----------------------------------------------------------------

CREATE TABLE order_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  file_type file_type NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX order_files_order_id_idx ON order_files(order_id);

COMMENT ON TABLE order_files IS 'Files attached to orders (stored in Supabase Storage)';
COMMENT ON COLUMN order_files.storage_path IS 'Path in Supabase Storage bucket';

-- ----------------------------------------------------------------
-- Table: approvals
-- Description: Approval status for order files
-- ----------------------------------------------------------------

CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  invoice_status approval_status DEFAULT 'pending',
  artwork_status approval_status DEFAULT 'pending',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX approvals_order_id_idx ON approvals(order_id);

COMMENT ON TABLE approvals IS 'Approval status tracking for order files';

-- ----------------------------------------------------------------
-- Table: messages
-- Description: Chat messages between customer and admin
-- ----------------------------------------------------------------

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender sender_role NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX messages_order_id_created_at_idx ON messages(order_id, created_at DESC);

COMMENT ON TABLE messages IS 'Chat messages between customer and admin';

-- ----------------------------------------------------------------
-- Table: email_attempts
-- Description: Email delivery tracking and logging
-- ----------------------------------------------------------------

CREATE TABLE email_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  email_type email_type NOT NULL,
  to_emails TEXT[] NOT NULL,
  provider_message_id TEXT,
  status email_status DEFAULT 'queued',
  error JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX email_attempts_order_id_created_at_idx ON email_attempts(order_id, created_at DESC);
CREATE INDEX email_attempts_status_idx ON email_attempts(status);

COMMENT ON TABLE email_attempts IS 'Email delivery tracking and logging';
COMMENT ON COLUMN email_attempts.provider_message_id IS 'Message ID from email service provider';

-- ----------------------------------------------------------------
-- Table: activity_log
-- Description: Audit log for all order-related activities
-- ----------------------------------------------------------------

CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX activity_log_order_id_created_at_idx ON activity_log(order_id, created_at DESC);
CREATE INDEX activity_log_event_type_idx ON activity_log(event_type);

COMMENT ON TABLE activity_log IS 'Audit log for order-related activities';

-- ================================================================
-- FUNCTIONS & TRIGGERS
-- ================================================================

-- ----------------------------------------------------------------
-- Function: update_updated_at_column
-- Description: Automatically updates the updated_at timestamp
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------
-- Triggers: Apply updated_at auto-update to relevant tables
-- ----------------------------------------------------------------

CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER approvals_updated_at
  BEFORE UPDATE ON approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER email_attempts_updated_at
  BEFORE UPDATE ON email_attempts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- INITIAL DATA
-- ================================================================

-- Insert default settings row (will be created by app if not exists)
-- Commented out to allow the app to handle initialization
-- INSERT INTO settings (id) VALUES (gen_random_uuid());

-- ================================================================
-- END OF MIGRATION
-- ================================================================
