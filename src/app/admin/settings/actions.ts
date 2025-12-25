'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { Settings, SettingsUpdate } from '@/lib/types/database';
import { revalidatePath } from 'next/cache';
import { DEFAULT_EMAIL_TEMPLATES } from '@/lib/email-templates';

/**
 * Get the settings row (creates default if doesn't exist)
 */
export async function getSettings(): Promise<Settings | null> {
  try {
    const { data, error } = await supabaseServer
      .from('settings')
      .select('*')
      .single();

    if (error) {
      // If no settings exist, create default
      if (error.code === 'PGRST116') {
        return await createDefaultSettings();
      }
      console.error('Error fetching settings:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getSettings:', error);
    return null;
  }
}

/**
 * Create default settings row
 */
async function createDefaultSettings(): Promise<Settings | null> {
  try {
    const { data, error} = await supabaseServer
      .from('settings')
      .insert({
        tip_mode: 'fixed',
        tip_presets: [100, 200, 300], // $1, $2, $3 in cents
        reminder_days: [3, 7, 14],
        auto_cancel_days: 20,
        notification_toggles: {},
        email_templates: DEFAULT_EMAIL_TEMPLATES,
        default_from_email: 'orders@example.com',
        admin_notify_email: 'admin@example.com',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating default settings:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in createDefaultSettings:', error);
    return null;
  }
}

/**
 * Update settings
 */
export async function updateSettings(updates: SettingsUpdate): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Get current settings to find the ID
    const currentSettings = await getSettings();

    if (!currentSettings) {
      return { success: false, error: 'Settings not found' };
    }

    const { error } = await supabaseServer
      .from('settings')
      .update(updates)
      .eq('id', currentSettings.id);

    if (error) {
      console.error('Error updating settings:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/settings');
    return { success: true };
  } catch (error) {
    console.error('Error in updateSettings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
