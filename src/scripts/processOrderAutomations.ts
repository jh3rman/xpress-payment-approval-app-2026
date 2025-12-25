/**
 * Process Order Automations
 *
 * This script handles:
 * 1. Sending reminder emails based on reminder schedule
 * 2. Auto-cancelling orders after N days
 * 3. Updating order timelines and statuses
 *
 * IMPORTANT: This script is idempotent and deterministic.
 * It can be safely run multiple times without duplicating actions.
 *
 * Run via cron: node --loader ts-node/esm src/scripts/processOrderAutomations.ts
 */

import { supabaseServer } from '@/lib/supabase/server';
import { sendReminderEmail, sendCancellationEmail } from '@/lib/mailgun';
import { getSettings } from '@/app/admin/settings/actions';
import type { Order } from '@/lib/types/database';

const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

interface ProcessingResult {
  processedOrders: number;
  remindersSent: number;
  ordersCancelled: number;
  errors: Array<{ orderId: string; error: string }>;
}

/**
 * Calculate the timeline start date for an order
 * This is the most recent of: initial_email_sent_at or revived_at
 */
function getTimelineStart(order: Order): Date {
  const initialSent = order.initial_email_sent_at ? new Date(order.initial_email_sent_at) : null;
  const revivedAt = order.revived_at ? new Date(order.revived_at) : null;

  if (revivedAt && initialSent) {
    return revivedAt > initialSent ? revivedAt : initialSent;
  }

  return initialSent || new Date();
}

/**
 * Calculate days elapsed since timeline start
 */
function getDaysElapsed(timelineStart: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - timelineStart.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determine if a reminder should be sent
 * Returns the reminder index (0-based) if due, otherwise null
 */
function getReminderDue(
  order: Order,
  daysElapsed: number,
  reminderScheduleDays: number[]
): number | null {
  if (!reminderScheduleDays || reminderScheduleDays.length === 0) {
    return null;
  }

  const reminderCount = order.reminder_send_count || 0;

  // Already sent all scheduled reminders
  if (reminderCount >= reminderScheduleDays.length) {
    return null;
  }

  // Check if we're at or past the next reminder day
  const nextReminderDay = reminderScheduleDays[reminderCount];
  if (daysElapsed >= nextReminderDay) {
    return reminderCount;
  }

  return null;
}

/**
 * Check if reminder was already sent (idempotency check)
 */
async function wasReminderAlreadySent(
  orderId: string,
  reminderNumber: number,
  scheduledFor: Date
): Promise<boolean> {
  const { data } = await supabaseServer
    .from('reminder_sends')
    .select('id')
    .eq('order_id', orderId)
    .eq('reminder_number', reminderNumber)
    .eq('scheduled_for', scheduledFor.toISOString())
    .single();

  return !!data;
}

/**
 * Send a reminder email for an order
 */
async function sendReminder(
  order: Order,
  reminderNumber: number,
  scheduledFor: Date,
  isFinalWarning: boolean,
  settings: any,
  autoCancelDays: number
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Idempotency check
    const alreadySent = await wasReminderAlreadySent(order.id, reminderNumber, scheduledFor);
    if (alreadySent) {
      console.log(`Reminder ${reminderNumber} for order ${order.id} already sent, skipping`);
      return { success: true };
    }

    // Send the reminder email
    const result = await sendReminderEmail({
      orderId: order.id,
      orderToken: order.token,
      orderTitle: order.order_title,
      customerEmail: order.customer_email,
      ccEmails: order.cc_emails || [],
      fromEmail: order.from_email,
      templates: settings.email_templates,
      settings,
      appBaseUrl: APP_BASE_URL,
      isFinalWarning,
      daysUntilCancellation: isFinalWarning ? autoCancelDays - (reminderNumber + 1) : undefined,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Log to email_attempts
    const { data: emailAttempt } = await supabaseServer
      .from('email_attempts')
      .insert({
        order_id: order.id,
        email_type: 'reminder',
        to_emails: [order.customer_email, ...(order.cc_emails || [])],
        provider_message_id: result.messageId,
        status: 'sent',
      })
      .select()
      .single();

    // Log to reminder_sends for idempotency
    await supabaseServer.from('reminder_sends').insert({
      order_id: order.id,
      reminder_number: reminderNumber,
      scheduled_for: scheduledFor.toISOString(),
      email_attempt_id: emailAttempt?.id || null,
      is_final_warning: isFinalWarning,
    });

    // Update order
    await supabaseServer
      .from('orders')
      .update({
        reminder_send_count: reminderNumber + 1,
        last_reminder_sent_at: new Date().toISOString(),
        last_email_sent_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    // Log activity
    await supabaseServer.from('activity_log').insert({
      order_id: order.id,
      event_type: isFinalWarning ? 'EMAIL_REMINDER_FINAL' : 'EMAIL_REMINDER_SENT',
      metadata: {
        reminder_number: reminderNumber,
        message_id: result.messageId,
        is_final_warning: isFinalWarning,
      },
    });

    return { success: true, messageId: result.messageId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Auto-cancel an order
 */
async function autoCancelOrder(
  order: Order,
  settings: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // Send cancellation email
    const result = await sendCancellationEmail({
      orderId: order.id,
      orderToken: order.token,
      orderTitle: order.order_title,
      customerEmail: order.customer_email,
      ccEmails: order.cc_emails || [],
      fromEmail: order.from_email,
      templates: settings.email_templates,
      settings,
      appBaseUrl: APP_BASE_URL,
    });

    // Log email attempt (even if failed)
    await supabaseServer.from('email_attempts').insert({
      order_id: order.id,
      email_type: 'cancellation',
      to_emails: [order.customer_email, ...(order.cc_emails || [])],
      provider_message_id: result.messageId || null,
      status: result.success ? 'sent' : 'failed',
      error: result.success ? null : { message: result.error },
    });

    // Update order to cancelled status
    const now = new Date().toISOString();
    await supabaseServer
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_at: now,
        last_email_sent_at: result.success ? now : order.last_email_sent_at,
      })
      .eq('id', order.id);

    // Log activity
    await supabaseServer.from('activity_log').insert({
      order_id: order.id,
      event_type: 'ORDER_AUTO_CANCELLED',
      metadata: {
        message_id: result.messageId,
        email_sent: result.success,
      },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process a single order for reminders and auto-cancellation
 */
async function processOrder(
  order: Order,
  settings: any,
  reminderScheduleDays: number[],
  autoCancelDays: number
): Promise<{ reminderSent: boolean; cancelled: boolean; error?: string }> {
  try {
    const timelineStart = getTimelineStart(order);
    const daysElapsed = getDaysElapsed(timelineStart);

    // Check if order should be auto-cancelled
    if (daysElapsed >= autoCancelDays && order.status !== 'cancelled') {
      console.log(`Auto-cancelling order ${order.id} (${daysElapsed} days elapsed)`);
      const cancelResult = await autoCancelOrder(order, settings);
      if (!cancelResult.success) {
        return { reminderSent: false, cancelled: false, error: cancelResult.error };
      }
      return { reminderSent: false, cancelled: true };
    }

    // Update cancellation_due_at for tracking
    if (!order.cancellation_due_at || order.cancelled_at) {
      const cancellationDue = new Date(timelineStart);
      cancellationDue.setDate(cancellationDue.getDate() + autoCancelDays);

      await supabaseServer
        .from('orders')
        .update({
          cancellation_due_at: cancellationDue.toISOString(),
          reminder_schedule_days: reminderScheduleDays,
        })
        .eq('id', order.id);
    }

    // Check if a reminder is due
    const reminderDue = getReminderDue(order, daysElapsed, reminderScheduleDays);
    if (reminderDue !== null) {
      const isFinalWarning = reminderDue === reminderScheduleDays.length - 1;
      console.log(
        `Sending reminder ${reminderDue} for order ${order.id} (day ${daysElapsed}, final=${isFinalWarning})`
      );

      const reminderResult = await sendReminder(
        order,
        reminderDue,
        timelineStart,
        isFinalWarning,
        settings,
        autoCancelDays
      );

      if (!reminderResult.success) {
        return { reminderSent: false, cancelled: false, error: reminderResult.error };
      }

      // Calculate next reminder date
      if (reminderDue + 1 < reminderScheduleDays.length) {
        const nextReminderDay = reminderScheduleDays[reminderDue + 1];
        const nextReminderDate = new Date(timelineStart);
        nextReminderDate.setDate(nextReminderDate.getDate() + nextReminderDay);

        await supabaseServer
          .from('orders')
          .update({ next_reminder_at: nextReminderDate.toISOString() })
          .eq('id', order.id);
      } else {
        // No more reminders scheduled
        await supabaseServer
          .from('orders')
          .update({ next_reminder_at: null })
          .eq('id', order.id);
      }

      return { reminderSent: true, cancelled: false };
    }

    // Calculate and update next_reminder_at if not set
    if (!order.next_reminder_at && reminderScheduleDays.length > 0) {
      const currentCount = order.reminder_send_count || 0;
      if (currentCount < reminderScheduleDays.length) {
        const nextReminderDay = reminderScheduleDays[currentCount];
        const nextReminderDate = new Date(timelineStart);
        nextReminderDate.setDate(nextReminderDate.getDate() + nextReminderDay);

        await supabaseServer
          .from('orders')
          .update({ next_reminder_at: nextReminderDate.toISOString() })
          .eq('id', order.id);
      }
    }

    return { reminderSent: false, cancelled: false };
  } catch (error) {
    return {
      reminderSent: false,
      cancelled: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Main processing function
 */
export async function processOrderAutomations(): Promise<ProcessingResult> {
  console.log('Starting order automations processing...');

  const result: ProcessingResult = {
    processedOrders: 0,
    remindersSent: 0,
    ordersCancelled: 0,
    errors: [],
  };

  try {
    // Get settings
    const settings = await getSettings();
    if (!settings) {
      throw new Error('Settings not found');
    }

    // Get reminder schedule from settings (default: days 3, 7, 14)
    const reminderScheduleDays = settings.reminder_days || [3, 7, 14];
    const autoCancelDays = settings.auto_cancel_days || 20;

    console.log(`Reminder schedule: ${reminderScheduleDays.join(', ')} days`);
    console.log(`Auto-cancel after: ${autoCancelDays} days`);

    // Fetch all orders that:
    // 1. Have initial_email_sent_at set (timeline started)
    // 2. Status is pending or in_progress
    // 3. Not already cancelled
    const { data: orders, error: fetchError } = await supabaseServer
      .from('orders')
      .select('*')
      .not('initial_email_sent_at', 'is', null)
      .in('status', ['pending', 'in_progress'])
      .is('cancelled_at', null)
      .order('initial_email_sent_at', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch orders: ${fetchError.message}`);
    }

    console.log(`Found ${orders?.length || 0} orders to process`);

    // Process each order
    for (const order of orders || []) {
      result.processedOrders++;

      const processResult = await processOrder(
        order,
        settings,
        reminderScheduleDays,
        autoCancelDays
      );

      if (processResult.error) {
        result.errors.push({
          orderId: order.id,
          error: processResult.error,
        });
      }

      if (processResult.reminderSent) {
        result.remindersSent++;
      }

      if (processResult.cancelled) {
        result.ordersCancelled++;
      }
    }

    console.log('Processing complete:', result);
    return result;
  } catch (error) {
    console.error('Fatal error in processOrderAutomations:', error);
    result.errors.push({
      orderId: 'SYSTEM',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return result;
  }
}

// If running directly (not imported)
if (require.main === module) {
  processOrderAutomations()
    .then((result) => {
      console.log('\n=== Processing Summary ===');
      console.log(`Orders processed: ${result.processedOrders}`);
      console.log(`Reminders sent: ${result.remindersSent}`);
      console.log(`Orders cancelled: ${result.ordersCancelled}`);
      console.log(`Errors: ${result.errors.length}`);

      if (result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach((err) => {
          console.log(`  - Order ${err.orderId}: ${err.error}`);
        });
        process.exit(1);
      }

      process.exit(0);
    })
    .catch((error) => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}
