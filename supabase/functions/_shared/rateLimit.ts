/**
 * Rate Limiting Module for Edge Functions
 *
 * Provides in-memory rate limiting for Edge Functions.
 * For distributed rate limiting across instances, use the database-based
 * check_rate_limit() function instead.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Configuration for rate limiting
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Key prefix to namespace rate limits */
  keyPrefix?: string;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Get client IP from request headers
 */
export function getClientIP(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Check if a request should be rate limited
 *
 * @param key - Unique identifier for rate limiting (e.g., IP address, user ID)
 * @param config - Rate limiting configuration
 * @returns RateLimitResult with allowed status and metadata
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const fullKey = config.keyPrefix ? `${config.keyPrefix}:${key}` : key;

  const entry = rateLimitStore.get(fullKey);

  // If no entry or window has passed, create new entry
  if (!entry || now > entry.resetTime) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(fullKey, newEntry);

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: newEntry.resetTime,
    };
  }

  // Entry exists and is within window
  entry.count++;

  if (entry.count > config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Create a rate-limited response
 */
export function rateLimitedResponse(
  result: RateLimitResult,
  headers: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: "Demasiadas solicitudes. Intenta de nuevo más tarde.",
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfter || 60),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.resetTime / 1000)),
      },
    }
  );
}

/**
 * Add rate limit headers to a response
 */
export function addRateLimitHeaders(
  headers: Record<string, string>,
  result: RateLimitResult,
  config: RateLimitConfig
): Record<string, string> {
  return {
    ...headers,
    "X-RateLimit-Limit": String(config.maxRequests),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetTime / 1000)),
  };
}

/**
 * Clean up expired entries from the rate limit store
 * Call this periodically to prevent memory leaks
 */
export function cleanupExpiredEntries(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

// Pre-configured rate limiters for common use cases

/**
 * Strict rate limiter for authentication endpoints
 * 5 requests per minute
 */
export const authRateLimit: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: "auth",
};

/**
 * Standard rate limiter for API endpoints
 * 30 requests per minute
 */
export const apiRateLimit: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: "api",
};

/**
 * Lenient rate limiter for public endpoints
 * 60 requests per minute
 */
export const publicRateLimit: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: "public",
};

/**
 * AI rate limiter for expensive AI operations
 * 10 requests per minute
 */
export const aiRateLimit: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: "ai",
};

/**
 * Payment rate limiter for checkout operations
 * 5 requests per minute
 */
export const paymentRateLimit: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: "payment",
};
