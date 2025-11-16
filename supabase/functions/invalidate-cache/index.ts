import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getRedis } from '../_shared/redis.ts';
import { captureException, withSentry } from '../_shared/sentry.ts';

interface InvalidateRequest {
  type: 'property' | 'stats' | 'all';
  propertyId?: string;
}

Deno.serve(withSentry(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticación
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verificar usuario
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { type, propertyId }: InvalidateRequest = await req.json();
    const redis = getRedis();

    let deletedKeys = 0;

    switch (type) {
      case 'property':
        if (propertyId) {
          // Invalidar cache específico de propiedad
          deletedKeys += await redis.del(`property:${propertyId}`);
          console.log(`[Cache] Invalidated property:${propertyId}`);
        }
        // También invalidar listados que podrían incluir esta propiedad
        deletedKeys += await invalidatePropertyListings(redis);
        break;

      case 'stats':
        // Invalidar estadísticas globales
        deletedKeys += await redis.del('stats:global');
        console.log('[Cache] Invalidated global stats');
        break;

      case 'all':
        // Invalidar todo (usar con precaución)
        deletedKeys += await invalidatePropertyListings(redis);
        deletedKeys += await redis.del('stats:global');
        console.log('[Cache] Invalidated all caches');
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid invalidation type' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
    }

    return new Response(
      JSON.stringify({
        success: true,
        deletedKeys,
        message: `Invalidated ${deletedKeys} cache keys`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Error]', error);
    await captureException(error as Error, {
      tags: { function: 'invalidate-cache' },
    });

    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}));

/**
 * Invalidar listados de propiedades
 * Nota: En producción real, usarías un patrón scan + delete
 * pero Upstash REST no lo soporta directamente
 */
async function invalidatePropertyListings(redis: any): Promise<number> {
  // Lista de variantes comunes de cache keys
  const commonFilters = [
    'properties:{"filters":{},"page":1,"limit":12}',
    'properties:{"filters":{"listing_type":"sale"},"page":1,"limit":12}',
    'properties:{"filters":{"listing_type":"rent"},"page":1,"limit":12}',
    // Agregar más si es necesario
  ];

  let count = 0;
  for (const key of commonFilters) {
    count += await redis.del(key);
  }

  return count;
}
