'use client';

import { useState } from 'react';
import { Settings, TipMode } from '@/lib/types/database';
import { updateSettings } from './actions';

interface SettingsFormProps {
  initialSettings: Settings;
}

export default function SettingsForm({ initialSettings }: SettingsFormProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // State for editable arrays
  const [tipPresetsInput, setTipPresetsInput] = useState(
    settings.tip_presets?.join(', ') || ''
  );
  const [reminderDaysInput, setReminderDaysInput] = useState(
    settings.reminder_days?.join(', ') || '3, 7, 14'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      // Parse tip presets
      const tipPresets = tipPresetsInput
        .split(',')
        .map((v) => parseInt(v.trim()))
        .filter((v) => !isNaN(v));

      // Parse reminder days
      const reminderDays = reminderDaysInput
        .split(',')
        .map((v) => parseInt(v.trim()))
        .filter((v) => !isNaN(v));

      const result = await updateSettings({
        ...settings,
        tip_presets: tipPresets,
        reminder_days: reminderDays,
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof Settings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Success/Error Message */}
      {message && (
        <div
          className={`rounded-lg p-4 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* A) Company Profile */}
      <section className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Company Profile</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="company_name" className="block text-sm font-medium text-gray-700">
              Company Name
            </label>
            <input
              type="text"
              id="company_name"
              value={settings.company_name || ''}
              onChange={(e) => updateField('company_name', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Phone
            </label>
            <input
              type="tel"
              id="phone"
              value={settings.phone || ''}
              onChange={(e) => updateField('phone', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={settings.email || ''}
              onChange={(e) => updateField('email', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="address_line1" className="block text-sm font-medium text-gray-700">
              Address Line 1
            </label>
            <input
              type="text"
              id="address_line1"
              value={settings.address_line1 || ''}
              onChange={(e) => updateField('address_line1', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="address_line2" className="block text-sm font-medium text-gray-700">
              Address Line 2
            </label>
            <input
              type="text"
              id="address_line2"
              value={settings.address_line2 || ''}
              onChange={(e) => updateField('address_line2', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <div>
            <label htmlFor="city" className="block text-sm font-medium text-gray-700">
              City
            </label>
            <input
              type="text"
              id="city"
              value={settings.city || ''}
              onChange={(e) => updateField('city', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <div>
            <label htmlFor="state" className="block text-sm font-medium text-gray-700">
              State
            </label>
            <input
              type="text"
              id="state"
              value={settings.state || ''}
              onChange={(e) => updateField('state', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <div>
            <label htmlFor="zip" className="block text-sm font-medium text-gray-700">
              ZIP Code
            </label>
            <input
              type="text"
              id="zip"
              value={settings.zip || ''}
              onChange={(e) => updateField('zip', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <div>
            <label htmlFor="hours" className="block text-sm font-medium text-gray-700">
              Business Hours
            </label>
            <input
              type="text"
              id="hours"
              value={settings.hours || ''}
              onChange={(e) => updateField('hours', e.target.value)}
              placeholder="e.g., Mon-Fri 9am-5pm"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="website_url" className="block text-sm font-medium text-gray-700">
              Website URL
            </label>
            <input
              type="url"
              id="website_url"
              value={settings.website_url || ''}
              onChange={(e) => updateField('website_url', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>
        </div>
      </section>

      {/* B) Email Defaults */}
      <section className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Email Defaults</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="default_from_email" className="block text-sm font-medium text-gray-700">
              Default From Email
            </label>
            <input
              type="email"
              id="default_from_email"
              value={settings.default_from_email || ''}
              onChange={(e) => updateField('default_from_email', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <div>
            <label htmlFor="admin_notify_email" className="block text-sm font-medium text-gray-700">
              Admin Notification Email
            </label>
            <input
              type="email"
              id="admin_notify_email"
              value={settings.admin_notify_email || ''}
              onChange={(e) => updateField('admin_notify_email', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>
        </div>
      </section>

      {/* C) Tipping Defaults */}
      <section className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Tipping Defaults</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="tip_mode" className="block text-sm font-medium text-gray-700">
              Tip Mode
            </label>
            <select
              id="tip_mode"
              value={settings.tip_mode}
              onChange={(e) => updateField('tip_mode', e.target.value as TipMode)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            >
              <option value="fixed">Fixed (Dollar amounts)</option>
              <option value="percent">Percent</option>
            </select>
          </div>

          <div>
            <label htmlFor="tip_presets" className="block text-sm font-medium text-gray-700">
              Tip Presets
              <span className="text-gray-500 text-xs ml-2">
                {settings.tip_mode === 'fixed'
                  ? '(comma-separated cents, e.g., 100, 200, 300 for $1, $2, $3)'
                  : '(comma-separated percentages, e.g., 10, 15, 20)'}
              </span>
            </label>
            <input
              type="text"
              id="tip_presets"
              value={tipPresetsInput}
              onChange={(e) => setTipPresetsInput(e.target.value)}
              placeholder={settings.tip_mode === 'fixed' ? '100, 200, 300' : '10, 15, 20'}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>
        </div>
      </section>

      {/* D) Reminders & Cancellation */}
      <section className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Reminders & Cancellation</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="reminder_days" className="block text-sm font-medium text-gray-700">
              Reminder Days
              <span className="text-gray-500 text-xs ml-2">
                (comma-separated days after initial email)
              </span>
            </label>
            <input
              type="text"
              id="reminder_days"
              value={reminderDaysInput}
              onChange={(e) => setReminderDaysInput(e.target.value)}
              placeholder="3, 7, 14"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <div>
            <label htmlFor="auto_cancel_days" className="block text-sm font-medium text-gray-700">
              Auto-Cancel Days
              <span className="text-gray-500 text-xs ml-2">
                (days before auto-cancelling pending orders)
              </span>
            </label>
            <input
              type="number"
              id="auto_cancel_days"
              value={settings.auto_cancel_days}
              onChange={(e) => updateField('auto_cancel_days', parseInt(e.target.value))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>
        </div>
      </section>

      {/* E) Notification Toggles */}
      <section className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Notification Toggles</h2>
        <div className="bg-gray-50 rounded-md p-4 text-sm text-gray-600">
          <p>Placeholder for notification toggle settings (stored as JSONB).</p>
          <p className="mt-2">This will be implemented in a future phase.</p>
        </div>
      </section>

      {/* F) Email Templates */}
      <section className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Email Templates</h2>
        <div className="bg-gray-50 rounded-md p-4 text-sm text-gray-600">
          <p>Placeholder for email template settings (stored as JSONB).</p>
          <p className="mt-2">This will be implemented in a future phase.</p>
        </div>
      </section>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}
