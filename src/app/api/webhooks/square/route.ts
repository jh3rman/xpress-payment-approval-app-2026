import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { verifySquareWebhookSignature } from '@/lib/square';

export async function POST(request: NextRequest) {
  try {
    // Get raw body and signature
    const body = await request.text();
    const signatureHeader = request.headers.get('x-square-hmacsha256-signature');

    if (!signatureHeader) {
      console.error('Missing Square webhook signature header');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    // Verify webhook signature
    const webhookUrl = `${process.env.APP_BASE_URL}/api/webhooks/square`;
    const isValid = verifySquareWebhookSignature(body, signatureHeader, webhookUrl);

    if (!isValid) {
      console.error('Invalid Square webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse the webhook payload
    const payload = JSON.parse(body);
    const { type, data, created_at } = payload;

    // REPLAY PREVENTION: Reject webhooks older than 5 minutes
    if (created_at) {
      const webhookTime = new Date(created_at).getTime();
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (now - webhookTime > fiveMinutes) {
        console.warn('Rejected old webhook (possible replay attack):', created_at);
        return NextResponse.json(
          { error: 'Webhook too old' },
          { status: 400 }
        );
      }
    }

    console.log('Square webhook received:', type);

    // Handle payment events
    if (type === 'payment.created' || type === 'payment.updated') {
      const payment = data?.object?.payment;

      if (!payment || !payment.id) {
        console.log('No payment object in webhook');
        return NextResponse.json({ received: true });
      }

      const paymentId = payment.id;
      const status = payment.status; // COMPLETED, PENDING, FAILED, etc.

      console.log(`Processing payment ${paymentId} with status ${status}`);

      // Find order by square_payment_id
      const { data: order, error: orderError } = await supabaseServer
        .from('orders')
        .select('*')
        .eq('square_payment_id', paymentId)
        .single();

      if (orderError || !order) {
        console.log(`No order found for payment ${paymentId}`);
        return NextResponse.json({ received: true });
      }

      // Idempotent update - only update if not already marked as paid
      // HARDENING: Never regress payment status (paid -> unpaid)
      if (status === 'COMPLETED' && order.payment_status !== 'paid') {
        console.log(`Marking order ${order.id} as paid via webhook`);

        await supabaseServer
          .from('orders')
          .update({
            payment_status: 'paid',
            paid_at: payment.created_at || new Date().toISOString(),
          })
          .eq('id', order.id)
          .neq('payment_status', 'paid'); // Extra safety: don't overwrite if already paid

        // Log webhook confirmation
        await supabaseServer.from('activity_log').insert({
          order_id: order.id,
          event_type: 'PAYMENT_WEBHOOK_CONFIRMED',
          metadata: {
            payment_id: paymentId,
            webhook_type: type,
            payment_status: status,
          },
        });
      } else if (status === 'FAILED' && order.payment_status !== 'failed' && order.payment_status !== 'paid') {
        // HARDENING: Don't mark as failed if already paid
        await supabaseServer
          .from('orders')
          .update({ payment_status: 'failed' })
          .eq('id', order.id)
          .neq('payment_status', 'paid'); // Extra safety: don't regress paid status

        await supabaseServer.from('activity_log').insert({
          order_id: order.id,
          event_type: 'PAYMENT_FAILED',
          metadata: {
            payment_id: paymentId,
            webhook_type: type,
            payment_status: status,
          },
        });
      } else if (order.payment_status === 'paid' && status !== 'COMPLETED') {
        // Log warning if webhook tries to change a paid order
        console.warn(
          `Webhook attempted to change paid order ${order.id} to status ${status}. Ignoring.`
        );
        await supabaseServer.from('activity_log').insert({
          order_id: order.id,
          event_type: 'PAYMENT_WEBHOOK_REJECTED',
          metadata: {
            payment_id: paymentId,
            webhook_type: type,
            payment_status: status,
            reason: 'Cannot regress paid status',
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Square webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
