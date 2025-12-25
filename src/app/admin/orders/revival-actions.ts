'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { sendRevivalEmail } from '@/lib/mailgun';
import { getSettings } from '@/app/admin/settings/actions';
import type { RevivalRequest } from '@/lib/types/database';

/**
 * Get all revival requests for an order
 */
export async function getRevivalRequests(orderId: string): Promise<RevivalRequest[]> {
  const { data, error } = await supabaseServer
    .from('revival_requests')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching revival requests:', error);
    return [];
  }

  return data || [];
}

/**
 * Create a new revival request (customer-facing)
 */
export async function createRevivalRequest(
  orderToken: string,
  requesterMessage?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get order by token
    const { data: order, error: orderError } = await supabaseServer
      .from('orders')
      .select('*')
      .eq('token', orderToken)
      .single();

    if (orderError || !order) {
      return { success: false, error: 'Order not found' };
    }

    // Validate order is cancelled
    if (order.status !== 'cancelled') {
      return { success: false, error: 'Order is not cancelled' };
    }

    // Check if there's already a pending revival request
    const { data: existingRequest } = await supabaseServer
      .from('revival_requests')
      .select('*')
      .eq('order_id', order.id)
      .eq('status', 'pending')
      .single();

    if (existingRequest) {
      return { success: false, error: 'Revival request already pending' };
    }

    // Create revival request
    const { error: insertError } = await supabaseServer
      .from('revival_requests')
      .insert({
        order_id: order.id,
        requester_message: requesterMessage || null,
        status: 'pending',
      });

    if (insertError) {
      console.error('Error creating revival request:', insertError);
      return { success: false, error: 'Failed to create revival request' };
    }

    // Log activity
    await supabaseServer.from('activity_log').insert({
      order_id: order.id,
      event_type: 'REVIVAL_REQUESTED',
      metadata: {
        requester_message: requesterMessage,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('createRevivalRequest error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Approve a revival request (admin-facing)
 * This resets the order timeline back to Day 0
 */
export async function approveRevivalRequest(
  revivalRequestId: string,
  adminNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get revival request
    const { data: revivalRequest, error: requestError } = await supabaseServer
      .from('revival_requests')
      .select('*')
      .eq('id', revivalRequestId)
      .single();

    if (requestError || !revivalRequest) {
      return { success: false, error: 'Revival request not found' };
    }

    if (revivalRequest.status !== 'pending') {
      return { success: false, error: 'Revival request already processed' };
    }

    // Get order
    const { data: order, error: orderError } = await supabaseServer
      .from('orders')
      .select('*')
      .eq('id', revivalRequest.order_id)
      .single();

    if (orderError || !order) {
      return { success: false, error: 'Order not found' };
    }

    const now = new Date().toISOString();

    // Update revival request
    await supabaseServer
      .from('revival_requests')
      .update({
        status: 'approved',
        approved_at: now,
        admin_notes: adminNotes || null,
      })
      .eq('id', revivalRequestId);

    // Reset order timeline - THIS IS THE KEY OPERATION
    // Set revived_at to now, which resets the timeline start
    // Clear cancelled_at, reset status to pending
    // Reset reminder counters
    await supabaseServer
      .from('orders')
      .update({
        status: 'pending',
        revived_at: now,
        cancelled_at: null,
        reminder_send_count: 0,
        next_reminder_at: null,
        last_reminder_sent_at: null,
      })
      .eq('id', order.id);

    // Delete reminder_sends to fully reset the reminder tracking
    await supabaseServer
      .from('reminder_sends')
      .delete()
      .eq('order_id', order.id);

    // Log activity
    await supabaseServer.from('activity_log').insert({
      order_id: order.id,
      event_type: 'ORDER_REVIVED',
      metadata: {
        revival_request_id: revivalRequestId,
        admin_notes: adminNotes,
      },
    });

    // Send revival email to customer
    const settings = await getSettings();
    if (settings && settings.email_templates) {
      const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

      const emailResult = await sendRevivalEmail({
        orderId: order.id,
        orderToken: order.token,
        orderTitle: order.order_title,
        customerEmail: order.customer_email,
        ccEmails: order.cc_emails || [],
        fromEmail: order.from_email,
        templates: settings.email_templates,
        settings,
        appBaseUrl,
      });

      // Log email attempt
      await supabaseServer.from('email_attempts').insert({
        order_id: order.id,
        email_type: 'revival',
        to_emails: [order.customer_email, ...(order.cc_emails || [])],
        provider_message_id: emailResult.messageId || null,
        status: emailResult.success ? 'sent' : 'failed',
        error: emailResult.success ? null : { message: emailResult.error },
      });

      if (emailResult.success) {
        await supabaseServer
          .from('orders')
          .update({ last_email_sent_at: now })
          .eq('id', order.id);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('approveRevivalRequest error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Reject a revival request (admin-facing)
 */
export async function rejectRevivalRequest(
  revivalRequestId: string,
  adminNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get revival request
    const { data: revivalRequest, error: requestError } = await supabaseServer
      .from('revival_requests')
      .select('*')
      .eq('id', revivalRequestId)
      .single();

    if (requestError || !revivalRequest) {
      return { success: false, error: 'Revival request not found' };
    }

    if (revivalRequest.status !== 'pending') {
      return { success: false, error: 'Revival request already processed' };
    }

    const now = new Date().toISOString();

    // Update revival request
    await supabaseServer
      .from('revival_requests')
      .update({
        status: 'rejected',
        rejected_at: now,
        admin_notes: adminNotes || null,
      })
      .eq('id', revivalRequestId);

    // Log activity
    await supabaseServer.from('activity_log').insert({
      order_id: revivalRequest.order_id,
      event_type: 'REVIVAL_REJECTED',
      metadata: {
        revival_request_id: revivalRequestId,
        admin_notes: adminNotes,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('rejectRevivalRequest error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
