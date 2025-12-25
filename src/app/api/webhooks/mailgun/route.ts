import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { verifyWebhookSignature, sendAdminAlert } from '@/lib/mailgun';
import { getSettings } from '@/app/admin/settings/actions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verify signature
    const signature = body.signature;
    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 401 });
    }

    const isValid = verifyWebhookSignature(
      signature.timestamp,
      signature.token,
      signature.signature
    );

    if (!isValid) {
      console.error('Invalid Mailgun webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse event data
    const eventData = body['event-data'];
    if (!eventData) {
      return NextResponse.json({ error: 'No event data' }, { status: 400 });
    }

    const event = eventData.event; // delivered, failed, bounced, etc.
    const messageId = eventData.message?.headers?.['message-id'];
    const recipient = eventData.recipient;

    if (!messageId) {
      console.warn('Mailgun webhook missing message ID');
      return NextResponse.json({ error: 'Missing message ID' }, { status: 400 });
    }

    console.log(`Mailgun webhook: ${event} for message ${messageId}`);

    // Map Mailgun event to our email status
    let status = 'sent';
    let isFailure = false;

    switch (event) {
      case 'delivered':
        status = 'delivered';
        break;
      case 'failed':
      case 'permanent_fail':
        status = 'failed';
        isFailure = true;
        break;
      case 'rejected':
      case 'bounced':
        status = 'bounced';
        isFailure = true;
        break;
      case 'complained':
        status = 'dropped';
        isFailure = true;
        break;
      case 'unsubscribed':
        status = 'dropped';
        isFailure = true;
        break;
      case 'temporary_fail':
        // Don't update status for temporary failures
        return NextResponse.json({ success: true, skipped: true });
      default:
        // accepted, stored, etc. - don't update
        return NextResponse.json({ success: true, skipped: true });
    }

    // Find email attempt by provider_message_id
    const { data: emailAttempt } = await supabaseServer
      .from('email_attempts')
      .select('*')
      .eq('provider_message_id', messageId)
      .single();

    if (!emailAttempt) {
      console.warn(`Email attempt not found for message ID: ${messageId}`);
      return NextResponse.json({ success: true, warning: 'Attempt not found' });
    }

    // Update email attempt status
    const errorData = isFailure
      ? {
          event,
          recipient,
          severity: eventData.severity,
          reason: eventData.reason || eventData['delivery-status']?.message,
          code: eventData['delivery-status']?.code,
        }
      : null;

    await supabaseServer
      .from('email_attempts')
      .update({
        status,
        error: errorData,
      })
      .eq('id', emailAttempt.id);

    // If failure, update order and send admin alert
    if (isFailure) {
      const failureReason = eventData.reason || eventData['delivery-status']?.message || event;

      await supabaseServer
        .from('orders')
        .update({
          email_issue: true,
          email_issue_reason: failureReason,
          initial_email_status: status,
        })
        .eq('id', emailAttempt.order_id);

      // Log activity
      await supabaseServer.from('activity_log').insert({
        order_id: emailAttempt.order_id,
        event_type: 'EMAIL_ISSUE_DETECTED',
        metadata: {
          status,
          reason: failureReason,
          recipient,
          message_id: messageId,
        },
      });

      // Send admin alert
      const { data: order } = await supabaseServer
        .from('orders')
        .select('*')
        .eq('id', emailAttempt.order_id)
        .single();

      if (order) {
        const settings = await getSettings();
        if (settings?.admin_notify_email) {
          const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

          await sendAdminAlert({
            orderId: order.id,
            orderTitle: order.order_title,
            customerEmail: order.customer_email,
            failureReason,
            failureStatus: status,
            adminEmail: settings.admin_notify_email,
            fromEmail: settings.default_from_email || order.from_email,
            appBaseUrl,
          });
        }
      }
    } else {
      // Success - update order status
      await supabaseServer
        .from('orders')
        .update({
          initial_email_status: status,
        })
        .eq('id', emailAttempt.order_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mailgun webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
