/**
 * Rate Limiting Infrastructure
 *
 * Uses rate-limiter-flexible for abuse prevention on sensitive endpoints
 */

import { RateLimiterMemory } from 'rate-limiter-flexible';

/**
 * Rate limiter configurations for different endpoint types
 */
const limiters = {
  // Chat messages: 1 message per 30 seconds (strict slow mode)
  chat: new RateLimiterMemory({
    points: 1,
    duration: 30,
    blockDuration: 30,
  }),

  // Payment creation: 3 attempts per 60 seconds
  payment: new RateLimiterMemory({
    points: 3,
    duration: 60,
    blockDuration: 60,
  }),

  // Approvals: 10 per 60 seconds
  approval: new RateLimiterMemory({
    points: 10,
    duration: 60,
    blockDuration: 30,
  }),

  // Polling: 20 requests per 60 seconds
  polling: new RateLimiterMemory({
    points: 20,
    duration: 60,
  }),

  // General API: 100 requests per 60 seconds
  general: new RateLimiterMemory({
    points: 100,
    duration: 60,
  }),
};

export type RateLimiterType = keyof typeof limiters;

/**
 * Check rate limit for a given key and limiter type
 *
 * @param key - Unique identifier (e.g., orderToken, IP address, user ID)
 * @param type - Type of rate limiter to use
 * @returns { allowed: boolean, retryAfter?: number } - Whether request is allowed and seconds to wait if blocked
 */
export async function checkRateLimit(
  key: string,
  type: RateLimiterType
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const limiter = limiters[type];

  try {
    await limiter.consume(key);
    return { allowed: true };
  } catch (rateLimiterRes: any) {
    // Rate limit exceeded
    const retryAfter = Math.ceil(rateLimiterRes.msBeforeNext / 1000) || 30;
    return {
      allowed: false,
      retryAfter,
    };
  }
}

/**
 * Get rate limit info without consuming points
 */
export async function getRateLimitInfo(
  key: string,
  type: RateLimiterType
): Promise<{ remainingPoints: number; msBeforeNext: number }> {
  const limiter = limiters[type];
  const res = await limiter.get(key);

  if (!res) {
    return {
      remainingPoints: limiters[type].points,
      msBeforeNext: 0,
    };
  }

  return {
    remainingPoints: res.remainingPoints,
    msBeforeNext: res.msBeforeNext,
  };
}

/**
 * Helper to create rate-limited API response
 */
export function createRateLimitResponse(retryAfter: number) {
  return {
    error: 'Rate limit exceeded. Please slow down.',
    retryAfter,
  };
}
