import { NextResponse } from 'next/server';
import { getSquareApplicationId, getSquareEnvironment } from '@/lib/square';

/**
 * Public endpoint to get Square Web Payments SDK configuration
 * This endpoint is safe to call from the client
 */
export async function GET() {
  try {
    const applicationId = getSquareApplicationId();
    const environment = getSquareEnvironment();

    if (!applicationId) {
      return NextResponse.json(
        { error: 'Square not configured' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      applicationId,
      environment,
      locationId: process.env.SQUARE_LOCATION_ID || '',
    });
  } catch (error) {
    console.error('Square config error:', error);
    return NextResponse.json(
      { error: 'Failed to get Square configuration' },
      { status: 500 }
    );
  }
}
