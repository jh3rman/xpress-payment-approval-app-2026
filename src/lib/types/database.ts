// Database Types

export type TipMode = 'fixed' | 'percent';

export type EmailTemplates = {
  initial_email_subject: string;
  initial_email_body_html: string;
  reminder_email_subject: string;
  reminder_email_body_html: string;
  cancellation_email_subject: string;
  cancellation_email_body_html: string;
  revival_email_subject: string;
  revival_email_body_html: string;
  msg_to_customer_subject: string;
  msg_to_customer_body_html: string;
  msg_to_admin_subject: string;
  msg_to_admin_body_html: string;
};

export type Settings = {
  id: string;
  // Company Profile
  company_name: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  hours: string | null;
  website_url: string | null;
  // Email Defaults
  default_from_email: string | null;
  admin_notify_email: string | null;
  // Tipping Configuration
  tip_mode: TipMode;
  tip_presets: number[] | null;
  // Reminder & Cancellation Settings
  reminder_days: number[] | null;
  auto_cancel_days: number;
  // Notification Toggles
  notification_toggles: Record<string, unknown>;
  // Email Templates
  email_templates: EmailTemplates;
  // Timestamps
  created_at: string;
  updated_at: string;
};

export type SettingsUpdate = Partial<Omit<Settings, 'id' | 'created_at' | 'updated_at'>>;

// Order Types
export type OrderStatus = 'pending' | 'completed' | 'cancelled' | 'archived';
export type ApprovalStatus = 'pending' | 'approved' | 'changes_requested';
export type SenderRole = 'customer' | 'admin';
export type FileType = 'invoice' | 'artwork';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';

export type Order = {
  id: string;
  token: string;
  customer_email: string;
  cc_emails: string[] | null;
  order_title: string;
  internal_notes: string | null;
  payment_required: boolean;
  order_amount_cents: number | null;
  allow_tip: boolean;
  from_email: string;
  status: OrderStatus;
  chat_open: boolean;
  email_issue: boolean;
  email_issue_reason: string | null;
  initial_email_sent_at: string | null;
  last_email_sent_at: string | null;
  initial_email_status: string;
  // Phase 3: Reminder and cancellation fields
  reminder_schedule_days: number[] | null;
  next_reminder_at: string | null;
  last_reminder_sent_at: string | null;
  reminder_send_count: number;
  cancelled_at: string | null;
  revived_at: string | null;
  cancellation_due_at: string | null;
  // Phase 4: Payment fields
  payment_status: PaymentStatus;
  paid_at: string | null;
  square_payment_id: string | null;
  square_idempotency_key: string | null;
  tip_amount_cents: number;
  receipt_email: string | null;
  receipt_phone: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  // View tracking
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
};

export type OrderFile = {
  id: string;
  order_id: string;
  file_type: FileType;
  filename: string;
  storage_path: string;
  uploaded_at: string;
};

export type Approval = {
  id: string;
  order_id: string;
  invoice_status: ApprovalStatus;
  artwork_status: ApprovalStatus;
  updated_at: string;
};

export type Message = {
  id: string;
  order_id: string;
  sender: SenderRole;
  body: string;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  order_id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

// Phase 3: Revival Request Types
export type RevivalRequestStatus = 'pending' | 'approved' | 'rejected';

export type RevivalRequest = {
  id: string;
  order_id: string;
  requester_message: string | null;
  status: RevivalRequestStatus;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  admin_notes: string | null;
};

// Phase 3: Reminder Send Ledger
export type ReminderSend = {
  id: string;
  order_id: string;
  reminder_number: number;
  scheduled_for: string;
  sent_at: string;
  email_attempt_id: string | null;
  is_final_warning: boolean;
  created_at: string;
};

// Form Types
export type NewOrderFormData = {
  customer_email: string;
  cc_emails: string;
  order_title: string;
  internal_notes: string;
  from_email: string;
  payment_required: boolean;
  order_amount_cents: number | null;
  allow_tip: boolean;
};

// Extended types with relations
export type OrderWithRelations = Order & {
  order_files?: OrderFile[];
  approvals?: Approval;
  messages?: Message[];
};
