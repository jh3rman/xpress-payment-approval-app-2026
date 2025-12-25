'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { Message, SenderRole } from '@/lib/types/database';
import { revalidatePath } from 'next/cache';

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
