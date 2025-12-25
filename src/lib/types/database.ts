// Database Types

export type TipMode = 'fixed' | 'percent';

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
  email_templates: Record<string, unknown>;
  // Timestamps
  created_at: string;
  updated_at: string;
};

export type SettingsUpdate = Partial<Omit<Settings, 'id' | 'created_at' | 'updated_at'>>;
