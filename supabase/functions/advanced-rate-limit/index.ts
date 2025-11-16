import { corsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/redis.ts';
import { captureMessage, withSentry } from '../_shared/sentry.ts';

interface RateLimitRequest {
  identifier: string; // IP, user_id, o combinación
  endpoint: string;
  limit?: number;
  windowSeconds?: number;
}

// Límites por defecto según endpoint
const DEFAULT_LIMITS: Record<string, { limit: number; window: number }> = {
  'search': { limit: 100, window: 60 }, // 100 requests/minuto
  'create-property': { limit: 10, window: 3600 }, // 10 propiedades/hora
  'contact-agent': { limit: 20, window: 3600 }, // 20 contactos/hora
  'login': { limit: 5, window: 300 }, // 5 intentos/5 minutos
  'signup': { limit: 3, window: 3600 }, // 3 registros/hora
  'default': { limit: 60, window: 60 }, // 60 requests/minuto
};

Deno.serve(withSentry(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { identifier, endpoint, limit, windowSeconds }: RateLimitRequest = await req.json();

    if (!identifier || !endpoint) {
      return new Response(
        JSON.stringify({ error: 'identifier and endpoint are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Obtener límites (custom o default)
    const limits = DEFAULT_LIMITS[endpoint] || DEFAULT_LIMITS['default'];
    const finalLimit = limit || limits.limit;
    const finalWindow = windowSeconds || limits.window;

    // Verificar rate limit
    const result = await checkRateLimit(
      `${endpoint}:${identifier}`,
      finalLimit,
      finalWindow
    );

    // Log si se excede el límite
    if (!result.allowed) {
      await captureMessage(
        `Rate limit exceeded: ${endpoint} for ${identifier}`,
        'warning',
        {
          tags: { endpoint, identifier: identifier.substring(0, 10) },
          extra: { limit: finalLimit, window: finalWindow },
        }
      );
    }

    return new Response(
      JSON.stringify({
        allowed: result.allowed,
        remaining: result.remaining,
        resetAt: result.resetAt,
        limit: finalLimit,
        window: finalWindow,
      }),
      {
        status: result.allowed ? 200 : 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': finalLimit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
        },
      }
    );
  } catch (error) {
    console.error('[Error]', error);

    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}));
