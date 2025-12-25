'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { Message, SenderRole } from '@/lib/types/database';
import { revalidatePath } from 'next/cache';
import { sendMessageToAdmin, sendMessageToCustomer } from '@/lib/mailgun';
import { getSettings } from '@/app/admin/settings/actions';

/**
 * Post a new message
 */
export async function postMessage(
  orderId: string,
  body: string,
  sender: SenderRole
): Promise<{ success: boolean; message?: Message; error?: string }> {
  try {
    // Basic validation
    if (!body || body.trim().length === 0) {
      return { success: false, error: 'Message cannot be empty' };
    }

    if (body.length > 5000) {
      return { success: false, error: 'Message too long (max 5000 characters)' };
    }

    // Check if chat is open (only for customer messages)
    if (sender === 'customer') {
      const { data: order } = await supabaseServer
        .from('orders')
        .select('chat_open, status')
        .eq('id', orderId)
        .single();

      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      if (!order.chat_open) {
        return { success: false, error: 'Chat is closed' };
      }

      // Don't allow messages on cancelled orders from customer
      if (order.status === 'cancelled') {
        return { success: false, error: 'Cannot send messages on cancelled orders' };
      }
    }

    // Create message
    const { data: message, error } = await supabaseServer
      .from('messages')
      .insert({
        order_id: orderId,
        sender,
        body: body.trim(),
      })
      .select()
      .single();

    if (error || !message) {
      console.error('Post message error:', error);
      return { success: false, error: error?.message || 'Failed to post message' };
    }

    // Log activity
    await supabaseServer.from('activity_log').insert({
      order_id: orderId,
      event_type: sender === 'admin' ? 'admin_message' : 'customer_message',
      metadata: { message_id: message.id },
    });

    // Send email notification (async, don't wait for it)
    sendEmailNotification(orderId, message.body, sender).catch((error) => {
      console.error('Failed to send message notification:', error);
    });

    revalidatePath(`/admin/orders/${orderId}`);
    return { success: true, message };
  } catch (error) {
    console.error('Post message exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get messages for an order
 */
export async function getMessages(orderId: string): Promise<Message[]> {
  try {
    const { data, error } = await supabaseServer
      .from('messages')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Get messages error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Get messages exception:', error);
    return [];
  }
}

/**
 * Get messages created after a certain timestamp (for polling)
 */
export async function getNewMessages(
  orderId: string,
  after: string
): Promise<Message[]> {
  try {
    const { data, error } = await supabaseServer
      .from('messages')
      .select('*')
      .eq('order_id', orderId)
      .gt('created_at', after)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Get new messages error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Get new messages exception:', error);
    return [];
  }
}

/**
 * Toggle chat open/closed
 */
export async function toggleChat(
  orderId: string,
  chatOpen: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseServer
      .from('orders')
      .update({ chat_open: chatOpen })
      .eq('id', orderId);

    if (error) {
      console.error('Toggle chat error:', error);
      return { success: false, error: error.message };
    }

    // Log activity
    await supabaseServer.from('activity_log').insert({
      order_id: orderId,
      event_type: chatOpen ? 'chat_opened' : 'chat_closed',
      metadata: {},
    });

    revalidatePath(`/admin/orders/${orderId}`);
    return { success: true };
  } catch (error) {
    console.error('Toggle chat exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send email notification for a new message (async helper)
 */
async function sendEmailNotification(
  orderId: string,
  messageBody: string,
  sender: SenderRole
): Promise<void> {
  try {
    // Get order details
    const { data: order } = await supabaseServer
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (!order) {
      console.error('Order not found for email notification');
      return;
    }

    // Get settings
    const settings = await getSettings();
    if (!settings || !settings.email_templates) {
      console.error('Settings or templates not configured');
      return;
    }

    const templates = settings.email_templates as any;
    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

    let result;

    if (sender === 'customer') {
      // Notify admin
      if (!settings.admin_notify_email) {
        console.error('Admin notify email not configured');
        return;
      }

      result = await sendMessageToAdmin({
        orderId: order.id,
        orderToken: order.token,
        orderTitle: order.order_title,
        messageBody,
        adminEmail: settings.admin_notify_email,
        fromEmail: order.from_email,
        templates,
        settings,
        appBaseUrl,
      });
    } else {
      // Notify customer
      result = await sendMessageToCustomer({
        orderId: order.id,
        orderToken: order.token,
        orderTitle: order.order_title,
        messageBody,
        customerEmail: order.customer_email,
        ccEmails: order.cc_emails || [],
        fromEmail: order.from_email,
        templates,
        settings,
        appBaseUrl,
      });
    }

    // Log email attempt
    await supabaseServer.from('email_attempts').insert({
      order_id: order.id,
      email_type: sender === 'customer' ? 'msg_to_admin' : 'msg_to_customer',
      to_emails: sender === 'customer' ? [settings.admin_notify_email!] : [order.customer_email],
      provider_message_id: result.messageId,
      status: result.success ? 'sent' : 'failed',
      error: result.success ? null : { message: result.error },
    });

    if (!result.success) {
      console.error('Failed to send message notification email:', result.error);
    }
  } catch (error) {
    console.error('Error in sendEmailNotification:', error);
  }
}
