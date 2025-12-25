/**
 * Square API Server-Side Wrapper
 *
 * IMPORTANT: This module is server-side only and must never be imported on the client.
 * It contains sensitive Square credentials.
 */

// Guard against client-side imports
if (typeof window !== 'undefined') {
  throw new Error(
    '❌ lib/square.ts cannot be imported on the client side. ' +
    'This module uses Square API keys and must only run on the server.'
  );
}

import { Client, Environment } from 'square';
import crypto from 'crypto';

const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID;
const SQUARE_ENVIRONMENT = process.env.SQUARE_ENVIRONMENT || 'sandbox';
const SQUARE_WEBHOOK_SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID) {
  console.warn(
    'Missing Square environment variables. ' +
    'Please ensure SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID are set.'
  );
}

/**
 * Create Square client instance
 */
function createSquareClient() {
  if (!SQUARE_ACCESS_TOKEN) {
    throw new Error('Square not configured: SQUARE_ACCESS_TOKEN missing');
  }

  return new Client({
    accessToken: SQUARE_ACCESS_TOKEN,
    environment: SQUARE_ENVIRONMENT === 'production' ? Environment.Production : Environment.Sandbox,
  });
}

const squareClient = createSquareClient();

/**
 * Create a payment using Square Payments API
 */
export async function createPayment({
  sourceId,
  amountCents,
  tipCents = 0,
  idempotencyKey,
  buyerEmail,
  note,
}: {
  sourceId: string;
  amountCents: number;
  tipCents?: number;
  idempotencyKey: string;
  buyerEmail?: string;
  note?: string;
}): Promise<{ success: boolean; paymentId?: string; error?: string }> {
  try {
    if (!SQUARE_LOCATION_ID) {
      throw new Error('SQUARE_LOCATION_ID not configured');
    }

    const totalCents = amountCents + tipCents;

    const response = await squareClient.paymentsApi.createPayment({
      sourceId,
      idempotencyKey,
      locationId: SQUARE_LOCATION_ID,
      amountMoney: {
        amount: BigInt(totalCents),
        currency: 'USD',
      },
      ...(tipCents > 0 && {
        tipMoney: {
          amount: BigInt(tipCents),
          currency: 'USD',
        },
      }),
      autocomplete: true,
      ...(buyerEmail && { buyerEmailAddress: buyerEmail }),
      ...(note && { note }),
    });

    if (response.result.payment) {
      return {
        success: true,
        paymentId: response.result.payment.id,
      };
    }

    return {
      success: false,
      error: 'Payment creation failed: no payment object returned',
    };
  } catch (error: any) {
    console.error('Square createPayment error:', error);

    // Extract error message from Square API error
    let errorMessage = 'Payment failed';
    if (error.errors && error.errors.length > 0) {
      errorMessage = error.errors.map((e: any) => e.detail || e.code).join(', ');
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Verify Square webhook signature
 * https://developer.squareup.com/docs/webhooks/step3validate
 */
export function verifySquareWebhookSignature(
  requestBody: string,
  signatureHeader: string,
  webhookUrl: string
): boolean {
  if (!SQUARE_WEBHOOK_SIGNATURE_KEY) {
    console.error('SQUARE_WEBHOOK_SIGNATURE_KEY not configured');
    return false;
  }

  try {
    // Square webhook signature format: base64(HMAC-SHA256(notification_url + request_body, signature_key))
    const payload = webhookUrl + requestBody;
    const hmac = crypto.createHmac('sha256', SQUARE_WEBHOOK_SIGNATURE_KEY);
    hmac.update(payload, 'utf8');
    const computedSignature = hmac.digest('base64');

    return computedSignature === signatureHeader;
  } catch (error) {
    console.error('Error verifying Square webhook signature:', error);
    return false;
  }
}

/**
 * Get Square application ID for Web Payments SDK
 */
export function getSquareApplicationId(): string {
  // In sandbox, the application ID is the access token
  // In production, you need to get it from the Square Dashboard
  if (SQUARE_ENVIRONMENT === 'production') {
    return process.env.SQUARE_APPLICATION_ID || '';
  }
  return SQUARE_ACCESS_TOKEN || '';
}

/**
 * Get Square environment
 */
export function getSquareEnvironment(): 'sandbox' | 'production' {
  return SQUARE_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
}
