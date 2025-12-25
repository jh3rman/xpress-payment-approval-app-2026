'use server';

import { supabaseServer } from '@/lib/supabase/server';
import {
  Order,
  OrderWithRelations,
  OrderStatus,
  ApprovalStatus,
} from '@/lib/types/database';
import { generateOrderToken } from '@/lib/storage';
import { revalidatePath } from 'next/cache';

/**
 * Create a new order with files
 */
export async function createOrder(formData: {
  customer_email: string;
  cc_emails: string[];
  order_title: string;
  internal_notes: string;
  from_email: string;
  payment_required: boolean;
  order_amount_cents: number | null;
  allow_tip: boolean;
  files: Array<{
    filename: string;
    storage_path: string;
    file_type: 'invoice' | 'artwork';
  }>;
}): Promise<{ success: boolean; order?: Order; error?: string }> {
  try {
    // Generate secure token
    const token = generateOrderToken();

    // Create order
    const { data: order, error: orderError } = await supabaseServer
      .from('orders')
      .insert({
        token,
        customer_email: formData.customer_email,
        cc_emails: formData.cc_emails.length > 0 ? formData.cc_emails : null,
        order_title: formData.order_title,
        internal_notes: formData.internal_notes || null,
        from_email: formData.from_email,
        payment_required: formData.payment_required,
        order_amount_cents: formData.order_amount_cents,
        allow_tip: formData.allow_tip,
        status: 'pending',
        chat_open: true,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Order creation error:', orderError);
      return { success: false, error: orderError?.message || 'Failed to create order' };
    }

    // Create approval record
    const { error: approvalError } = await supabaseServer.from('approvals').insert({
      order_id: order.id,
      invoice_status: 'pending',
      artwork_status: 'pending',
    });

    if (approvalError) {
      console.error('Approval creation error:', approvalError);
      // Continue anyway - approval can be created later if needed
    }

    // Create order_files records
    if (formData.files.length > 0) {
      const { error: filesError } = await supabaseServer.from('order_files').insert(
        formData.files.map((file) => ({
          order_id: order.id,
          filename: file.filename,
          storage_path: file.storage_path,
          file_type: file.file_type,
        }))
      );

      if (filesError) {
        console.error('Files creation error:', filesError);
        return { success: false, error: 'Failed to attach files to order' };
      }
    }

    // Log activity
    await supabaseServer.from('activity_log').insert({
      order_id: order.id,
      event_type: 'order_created',
      metadata: {
        customer_email: formData.customer_email,
        order_title: formData.order_title,
        file_count: formData.files.length,
      },
    });

    revalidatePath('/admin/orders');
    return { success: true, order };
  } catch (error) {
    console.error('Create order exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all orders with optional filtering
 */
export async function getOrders(filter?: {
  status?: OrderStatus | 'not_sent' | 'email_issues';
}): Promise<OrderWithRelations[]> {
  try {
    let query = supabaseServer
      .from('orders')
      .select(
        `
        *,
        order_files (*),
        approvals (*),
        messages (id, created_at, sender)
      `
      )
      .order('created_at', { ascending: false });

    if (filter?.status) {
      if (filter.status === 'not_sent') {
        query = query.is('initial_email_sent_at', null);
      } else if (filter.status === 'email_issues') {
        query = query.eq('email_issue', true);
      } else {
        query = query.eq('status', filter.status);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Get orders error:', error);
      return [];
    }

    return (data || []) as OrderWithRelations[];
  } catch (error) {
    console.error('Get orders exception:', error);
    return [];
  }
}

/**
 * Get a single order by ID with all relations
 */
export async function getOrderById(id: string): Promise<OrderWithRelations | null> {
  try {
    const { data, error } = await supabaseServer
      .from('orders')
      .select(
        `
        *,
        order_files (*),
        approvals (*),
        messages (*)
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      console.error('Get order error:', error);
      return null;
    }

    return data as OrderWithRelations;
  } catch (error) {
    console.error('Get order exception:', error);
    return null;
  }
}

/**
 * Get order by token (for customer page)
 */
export async function getOrderByToken(token: string): Promise<OrderWithRelations | null> {
  try {
    const { data, error } = await supabaseServer
      .from('orders')
      .select(
        `
        *,
        order_files (*),
        approvals (*),
        messages (*)
      `
      )
      .eq('token', token)
      .single();

    if (error) {
      console.error('Get order by token error:', error);
      return null;
    }

    return data as OrderWithRelations;
  } catch (error) {
    console.error('Get order by token exception:', error);
    return null;
  }
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseServer
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (error) {
      console.error('Update order status error:', error);
      return { success: false, error: error.message };
    }

    // Log activity
    await supabaseServer.from('activity_log').insert({
      order_id: orderId,
      event_type: 'status_changed',
      metadata: { new_status: status },
    });

    revalidatePath('/admin/orders');
    revalidatePath(`/admin/orders/${orderId}`);
    return { success: true };
  } catch (error) {
    console.error('Update order status exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update approval status
 */
export async function updateApprovalStatus(
  orderId: string,
  type: 'invoice' | 'artwork',
  status: ApprovalStatus,
  sender: 'customer' | 'admin' = 'admin'
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateField = type === 'invoice' ? 'invoice_status' : 'artwork_status';

    const { error } = await supabaseServer
      .from('approvals')
      .update({ [updateField]: status })
      .eq('order_id', orderId);

    if (error) {
      console.error('Update approval status error:', error);
      return { success: false, error: error.message };
    }

    // Log activity
    await supabaseServer.from('activity_log').insert({
      order_id: orderId,
      event_type: `${type}_${status}`,
      metadata: { sender, type, status },
    });

    revalidatePath(`/admin/orders/${orderId}`);
    return { success: true };
  } catch (error) {
    console.error('Update approval status exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Track order view (customer page)
 */
export async function trackOrderView(token: string): Promise<void> {
  try {
    const { data: order } = await supabaseServer
      .from('orders')
      .select('id, first_viewed_at, view_count')
      .eq('token', token)
      .single();

    if (!order) return;

    const updates: any = {
      last_viewed_at: new Date().toISOString(),
      view_count: (order.view_count || 0) + 1,
    };

    if (!order.first_viewed_at) {
      updates.first_viewed_at = new Date().toISOString();
    }

    await supabaseServer.from('orders').update(updates).eq('token', token);

    // Log first view
    if (!order.first_viewed_at) {
      await supabaseServer.from('activity_log').insert({
        order_id: order.id,
        event_type: 'first_view',
        metadata: {},
      });
    }
  } catch (error) {
    console.error('Track order view exception:', error);
  }
}
