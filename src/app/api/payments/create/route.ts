import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { createPayment } from '@/lib/square';
import { v4 as uuidv4 } from 'uuid';
import { checkRateLimit } from '@/lib/rate-limiter';
import { z } from 'zod';

/**
 * Payment creation request schema
 */
const paymentRequestSchema = z.object({
  orderToken: z.string().min(1),
  sourceId: z.string().min(1),
  tipSelection: z
    .object({
      type: z.enum(['none', 'preset', 'custom']),
      index: z.number().optional(),
      amount: z.string().optional(),
    })
    .optional(),
  receipt_email: z.string().email().optional().or(z.literal('')),
  receipt_phone: z.string().optional(),
  customer_first_name: z.string().max(100).optional(),
  customer_last_name: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Input validation
    const validation = paymentRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const {
      orderToken,
      sourceId,
      tipSelection,
      receipt_email,
      receipt_phone,
      customer_first_name,
      customer_last_name,
    } = validation.data;

    // Rate limiting (prevent payment spam/abuse)
    const rateLimitKey = `payment:${orderToken}`;
    const { allowed, retryAfter } = await checkRateLimit(rateLimitKey, 'payment');

    if (!allowed) {
      return NextResponse.json(
        { error: `Too many payment attempts. Please wait ${retryAfter} seconds.` },
        { status: 429 }
      );
    }

    // 1. Fetch order by token
    const { data: order, error: orderError } = await supabaseServer
      .from('orders')
      .select('*')
      .eq('token', orderToken)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 2. Validate order is payable (CRITICAL SERVER-SIDE VALIDATION)
    if (!order.payment_required) {
      return NextResponse.json(
        { error: 'Payment not required for this order' },
        { status: 400 }
      );
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json(
        { error: 'Order already paid' },
        { status: 400 }
      );
    }

    // DOUBLE-PAY PREVENTION: Check if payment is already in progress
    if (order.payment_status === 'pending') {
      return NextResponse.json(
        { error: 'Payment already in progress. Please wait.' },
        { status: 409 }
      );
    }

    if (order.status === 'cancelled' || order.status === 'archived') {
      return NextResponse.json(
        { error: 'Cannot pay cancelled or archived orders' },
        { status: 400 }
      );
    }

    if (order.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot pay completed orders' },
        { status: 400 }
      );
    }

    if (!order.order_amount_cents || order.order_amount_cents <= 0) {
      return NextResponse.json(
        { error: 'Invalid order amount' },
        { status: 400 }
      );
    }

    // 3. Compute tip (SERVER-SIDE, NEVER TRUST CLIENT)
    let tipCents = 0;

    if (order.allow_tip && tipSelection) {
      // Get settings for tip presets
      const { data: settings } = await supabaseServer
        .from('settings')
        .select('tip_mode, tip_presets')
        .single();

      if (tipSelection.type === 'preset' && settings) {
        const presetIndex = tipSelection.index;
        const presets = settings.tip_presets || [];

        if (presetIndex >= 0 && presetIndex < presets.length) {
          const presetValue = presets[presetIndex];

          if (settings.tip_mode === 'fixed') {
            // Fixed tip in cents
            tipCents = presetValue;
          } else {
            // Percent tip
            tipCents = Math.round((order.order_amount_cents * presetValue) / 100);
          }
        }
      } else if (tipSelection.type === 'custom') {
        // Custom tip in cents (validate reasonable max)
        const customTipCents = parseInt(tipSelection.amount, 10);
        const maxTip = order.order_amount_cents * 2; // Cap at 200% of order amount

        if (!isNaN(customTipCents) && customTipCents >= 0 && customTipCents <= maxTip) {
          tipCents = customTipCents;
        }
      }
      // If tip_selection.type === 'none', tipCents stays 0
    }

    // Force tip to 0 if tipping not allowed
    if (!order.allow_tip) {
      tipCents = 0;
    }

    // Ensure tip is not negative
    if (tipCents < 0) {
      tipCents = 0;
    }

    // 4. Generate idempotency key
    const idempotencyKey = uuidv4();

    // 5. Update order status to pending
    await supabaseServer
      .from('orders')
      .update({
        payment_status: 'pending',
        square_idempotency_key: idempotencyKey,
        receipt_email: receipt_email || null,
        receipt_phone: receipt_phone || null,
        customer_first_name: customer_first_name || null,
        customer_last_name: customer_last_name || null,
      })
      .eq('id', order.id);

    // 6. Log payment initiation
    await supabaseServer.from('activity_log').insert({
      order_id: order.id,
      event_type: 'PAYMENT_INITIATED',
      metadata: {
        amount_cents: order.order_amount_cents,
        tip_cents: tipCents,
        total_cents: order.order_amount_cents + tipCents,
      },
    });

    // 7. Create payment with Square
    const paymentResult = await createPayment({
      sourceId,
      amountCents: order.order_amount_cents,
      tipCents,
      idempotencyKey,
      buyerEmail: receipt_email || order.customer_email,
      note: `Order: ${order.order_title}`,
    });

    if (!paymentResult.success) {
      // Payment failed - update status
      await supabaseServer
        .from('orders')
        .update({ payment_status: 'failed' })
        .eq('id', order.id);

      await supabaseServer.from('activity_log').insert({
        order_id: order.id,
        event_type: 'PAYMENT_FAILED',
        metadata: {
          error: paymentResult.error,
        },
      });

      return NextResponse.json(
        { error: paymentResult.error || 'Payment failed' },
        { status: 400 }
      );
    }

    // 8. Payment succeeded - update order
    const now = new Date().toISOString();

    await supabaseServer
      .from('orders')
      .update({
        payment_status: 'paid',
        paid_at: now,
        square_payment_id: paymentResult.paymentId,
        tip_amount_cents: tipCents,
      })
      .eq('id', order.id);

    await supabaseServer.from('activity_log').insert({
      order_id: order.id,
      event_type: 'PAYMENT_SUCCEEDED',
      metadata: {
        payment_id: paymentResult.paymentId,
        amount_cents: order.order_amount_cents,
        tip_cents: tipCents,
        total_cents: order.order_amount_cents + tipCents,
      },
    });

    return NextResponse.json({
      success: true,
      paymentId: paymentResult.paymentId,
      amountCents: order.order_amount_cents,
      tipCents,
      totalCents: order.order_amount_cents + tipCents,
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
