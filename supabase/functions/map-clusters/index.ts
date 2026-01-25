import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

interface RequestBody {
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  zoom: number;
  filters?: {
    listing_type?: 'venta' | 'renta';
    property_type?: string;
    min_price?: number;
    max_price?: number;
    min_bedrooms?: number;
    max_bedrooms?: number;
    min_bathrooms?: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const body: RequestBody = await req.json();
    const { bounds, zoom, filters = {} } = body;

    if (!bounds || zoom === undefined) {
      return new Response(
        JSON.stringify({ error: 'bounds and zoom required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(JSON.stringify({
      level: 'info',
      request_id: requestId,
      message: 'Request received',
      zoom,
      has_filters: Object.keys(filters).length > 0,
    }));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const dbStart = Date.now();
    const { data, error } = await supabase.rpc('get_map_clusters', {
      p_north: bounds.north,
      p_south: bounds.south,
      p_east: bounds.east,
      p_west: bounds.west,
      p_zoom: zoom,
      p_listing_type: filters.listing_type || null,
      p_property_type: filters.property_type || null,
      p_min_price: filters.min_price || null,
      p_max_price: filters.max_price || null,
      p_min_bedrooms: filters.min_bedrooms || null,
      p_max_bedrooms: filters.max_bedrooms || null,
      p_min_bathrooms: filters.min_bathrooms || null,
    });
    const dbDuration = Date.now() - dbStart;

    if (error) {
      console.error(JSON.stringify({
        level: 'error',
        request_id: requestId,
        message: 'RPC error',
        error: error.message,
      }));
      throw error;
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      level: 'info',
      request_id: requestId,
      message: 'Request completed',
      duration_ms: duration,
      db_query_ms: dbDuration,
      mode: data?.mode,
      items: data?.data?.length || 0,
      total: data?.total || 0,
    }));

    return new Response(
      JSON.stringify({
        ...data,
        _meta: {
          request_id: requestId,
          duration_ms: duration,
          db_query_ms: dbDuration,
          timestamp: new Date().toISOString(),
        }
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30',
        },
      }
    );

  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(JSON.stringify({
      level: 'error',
      request_id: requestId,
      message: 'Request failed',
      error: err.message,
      duration_ms: duration,
    }));

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        mode: 'clusters',
        data: [],
        total: 0,
        _meta: {
          request_id: requestId,
          duration_ms: duration,
          error: err.message,
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
