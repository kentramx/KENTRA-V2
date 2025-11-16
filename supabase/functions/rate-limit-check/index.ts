/**
 * Rate Limiter Helper para Edge Functions
 * Uso: importar en otras edge functions
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const limits = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const rateLimitConfigs = {
  search: { maxRequests: 100, windowMs: 60 * 1000 }, // 100/min
  createProperty: { maxRequests: 10, windowMs: 60 * 1000 }, // 10/min
  sendMessage: { maxRequests: 30, windowMs: 60 * 1000 }, // 30/min
  auth: { maxRequests: 5, windowMs: 60 * 1000 }, // 5/min
  phoneVerification: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3/hora
  checkout: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10/hora
  general: { maxRequests: 60, windowMs: 60 * 1000 }, // 60/min
};

export const checkRateLimit = (
  key: string, 
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } => {
  const now = Date.now();
  const entry = limits.get(key);

  if (!entry || now > entry.resetTime) {
    const resetTime = now + config.windowMs;
    limits.set(key, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime,
    };
  }

  if (entry.count < config.maxRequests) {
    entry.count++;
    limits.set(key, entry);
    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  return {
    allowed: false,
    remaining: 0,
    resetTime: entry.resetTime,
  };
};

export const getClientIdentifier = (req: Request): string => {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  
  return cfConnectingIp || realIp || forwarded?.split(',')[0] || 'unknown';
};

export const createRateLimitResponse = (
  resetTime: number,
  maxRequests: number
): Response => {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
  
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Please try again in ${retryAfter} seconds.`,
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetTime.toString(),
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
};

// Cleanup cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of limits.entries()) {
    if (now > entry.resetTime) {
      limits.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Export como edge function para testing
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({ 
      status: 'Rate limiter utility ready',
      configs: rateLimitConfigs 
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    }
  );
});
