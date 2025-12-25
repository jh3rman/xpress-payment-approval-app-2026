import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { sendReminderEmail } from '@/lib/mailgun';
import { getSettings } from '@/app/admin/settings/actions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    // Get order
    const { data: order, error: orderError } = await supabaseServer
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Validate order can receive reminders
    if (!order.initial_email_sent_at) {
      return NextResponse.json(
        { error: 'Initial email not sent yet' },
        { status: 400 }
      );
    }

    if (order.status === 'cancelled' || order.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot send reminder for cancelled or completed orders' },
        { status: 400 }
      );
    }

    // Get settings
    const settings = await getSettings();
    if (!settings || !settings.email_templates) {
      return NextResponse.json(
        { error: 'Email settings not configured' },
        { status: 500 }
      );
    }

    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

    // Send reminder email (not marked as final warning for manual sends)
    const result = await sendReminderEmail({
      orderId: order.id,
      orderToken: order.token,
      orderTitle: order.order_title,
      customerEmail: order.customer_email,
      ccEmails: order.cc_emails || [],
      fromEmail: order.from_email,
      templates: settings.email_templates,
      settings,
      appBaseUrl,
      isFinalWarning: false,
    });

    if (!result.success) {
      // Log failed attempt
      await supabaseServer.from('email_attempts').insert({
        order_id: order.id,
        email_type: 'reminder',
        to_emails: [order.customer_email, ...(order.cc_emails || [])],
        status: 'failed',
        error: { message: result.error },
      });

      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Log successful attempt
    await supabaseServer.from('email_attempts').insert({
      order_id: order.id,
      email_type: 'reminder',
      to_emails: [order.customer_email, ...(order.cc_emails || [])],
      provider_message_id: result.messageId,
      status: 'sent',
    });

    // Update order
    await supabaseServer
      .from('orders')
      .update({
        last_email_sent_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    // Log activity
    await supabaseServer.from('activity_log').insert({
      order_id: order.id,
      event_type: 'EMAIL_REMINDER_MANUAL',
      metadata: {
        message_id: result.messageId,
        to: order.customer_email,
        cc: order.cc_emails,
      },
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('Send reminder error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
