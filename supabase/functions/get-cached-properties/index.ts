import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { withCache, getRedis } from '../_shared/redis.ts';
import { captureException, withSentry } from '../_shared/sentry.ts';

interface PropertyFilters {
  state?: string;
  municipality?: string;
  type?: string;
  minPrice?: number;
  maxPrice?: number;
  listing_type?: string;
}

Deno.serve(withSentry(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    // Parsear query params
    const url = new URL(req.url);
    const filters: PropertyFilters = {
      state: url.searchParams.get('state') || undefined,
      municipality: url.searchParams.get('municipality') || undefined,
      type: url.searchParams.get('type') || undefined,
      minPrice: url.searchParams.get('minPrice') ? Number(url.searchParams.get('minPrice')) : undefined,
      maxPrice: url.searchParams.get('maxPrice') ? Number(url.searchParams.get('maxPrice')) : undefined,
      listing_type: url.searchParams.get('listing_type') || undefined,
    };

    const page = Number(url.searchParams.get('page') || '1');
    const limit = Number(url.searchParams.get('limit') || '12');

    // Generar cache key basado en filtros
    const cacheKey = `properties:${JSON.stringify({ filters, page, limit })}`;

    console.log('[Cache] Key:', cacheKey);

    // Usar cache con TTL de 5 minutos
    const result = await withCache(
      cacheKey,
      300, // 5 minutos
      async () => {
        // Query a Supabase
        let query = supabase
          .from('properties')
          .select('*', { count: 'exact' })
          .eq('status', 'approved')
          .order('created_at', { ascending: false });

        // Aplicar filtros
        if (filters.state) query = query.eq('state', filters.state);
        if (filters.municipality) query = query.eq('municipality', filters.municipality);
        if (filters.type) query = query.eq('type', filters.type);
        if (filters.listing_type) query = query.eq('listing_type', filters.listing_type);
        if (filters.minPrice) query = query.gte('price', filters.minPrice);
        if (filters.maxPrice) query = query.lte('price', filters.maxPrice);

        // Paginación
        const start = (page - 1) * limit;
        const end = start + limit - 1;
        query = query.range(start, end);

        const { data, error, count } = await query;

        if (error) throw error;

        return {
          data,
          count,
          page,
          limit,
          totalPages: Math.ceil((count || 0) / limit),
        };
      }
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Error]', error);
    await captureException(error as Error, {
      tags: { function: 'get-cached-properties' },
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
