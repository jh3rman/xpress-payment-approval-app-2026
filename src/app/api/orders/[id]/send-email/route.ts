import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { sendInitialEmail } from '@/lib/mailgun';
import { getSettings } from '@/app/admin/settings/actions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const { resend } = await request.json().catch(() => ({ resend: false }));

    // Get order
    const { data: order, error: orderError } = await supabaseServer
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Get settings
    const settings = await getSettings();
    if (!settings || !settings.default_from_email || !settings.admin_notify_email) {
      return NextResponse.json(
        { error: 'Email settings not configured' },
        { status: 500 }
      );
    }

    // Check if templates exist
    if (!settings.email_templates || typeof settings.email_templates !== 'object') {
      return NextResponse.json(
        { error: 'Email templates not configured' },
        { status: 500 }
      );
    }

    const templates = settings.email_templates as any;
    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

    // Send email
    const result = await sendInitialEmail({
      orderId: order.id,
      orderToken: order.token,
      orderTitle: order.order_title,
      customerEmail: order.customer_email,
      ccEmails: order.cc_emails || [],
      fromEmail: order.from_email,
      orderAmount: order.order_amount_cents,
      templates,
      settings,
      appBaseUrl,
    });

    if (!result.success) {
      // Log failed attempt
      await supabaseServer.from('email_attempts').insert({
        order_id: order.id,
        email_type: 'initial',
        to_emails: [order.customer_email, ...(order.cc_emails || [])],
        status: 'failed',
        error: { message: result.error },
      });

      // Set email issue
      await supabaseServer
        .from('orders')
        .update({
          email_issue: true,
          email_issue_reason: result.error,
          initial_email_status: 'failed',
        })
        .eq('id', order.id);

      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Log successful attempt
    await supabaseServer.from('email_attempts').insert({
      order_id: order.id,
      email_type: 'initial',
      to_emails: [order.customer_email, ...(order.cc_emails || [])],
      provider_message_id: result.messageId,
      status: 'sent',
    });

    // Update order
    const updates: any = {
      last_email_sent_at: new Date().toISOString(),
      initial_email_status: 'sent',
    };

    if (!resend && !order.initial_email_sent_at) {
      updates.initial_email_sent_at = new Date().toISOString();
    }

    await supabaseServer.from('orders').update(updates).eq('id', order.id);

    // Log activity
    await supabaseServer.from('activity_log').insert({
      order_id: order.id,
      event_type: resend ? 'EMAIL_INITIAL_RESENT' : 'EMAIL_INITIAL_SENT',
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
    console.error('Send email error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
