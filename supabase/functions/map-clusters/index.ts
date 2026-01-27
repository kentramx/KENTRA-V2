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

// Determine geohash precision based on zoom level
function getGeohashPrecision(zoom: number): number {
  if (zoom <= 6) return 3;
  if (zoom <= 9) return 4;
  if (zoom <= 12) return 5;
  if (zoom <= 14) return 6;
  return 7;
}

// Should we show individual properties instead of clusters?
function shouldShowProperties(zoom: number): boolean {
  return zoom >= 14;
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

    // Build filter conditions
    const conditions: string[] = [
      "status = 'activa'",
      `lat >= ${bounds.south}`,
      `lat <= ${bounds.north}`,
      `lng >= ${bounds.west}`,
      `lng <= ${bounds.east}`,
    ];

    if (filters.listing_type) {
      conditions.push(`listing_type = '${filters.listing_type}'`);
    }
    if (filters.property_type) {
      conditions.push(`type::text = '${filters.property_type}'`);
    }
    if (filters.min_price) {
      conditions.push(`price >= ${filters.min_price}`);
    }
    if (filters.max_price) {
      conditions.push(`price <= ${filters.max_price}`);
    }
    if (filters.min_bedrooms) {
      conditions.push(`bedrooms >= ${filters.min_bedrooms}`);
    }

    const whereClause = conditions.join(' AND ');

    let result: { mode: string; data: unknown[]; total: number };

    if (shouldShowProperties(zoom)) {
      // Return individual properties with ALL filters in PostgreSQL
      let query = supabase
        .from('properties')
        .select(`
          id,
          title,
          price,
          listing_type,
          type,
          bedrooms,
          bathrooms,
          sqft,
          lot_size,
          address,
          colonia,
          municipality,
          state,
          lat,
          lng
        `, { count: 'exact' })
        .gte('lat', bounds.south)
        .lte('lat', bounds.north)
        .gte('lng', bounds.west)
        .lte('lng', bounds.east)
        .eq('status', 'activa');

      // Apply ALL filters in PostgreSQL (not JavaScript)
      if (filters.listing_type) {
        query = query.eq('listing_type', filters.listing_type);
      }
      if (filters.property_type) {
        query = query.eq('type', filters.property_type);
      }
      if (filters.min_price) {
        query = query.gte('price', filters.min_price);
      }
      if (filters.max_price) {
        query = query.lte('price', filters.max_price);
      }
      if (filters.min_bedrooms) {
        query = query.gte('bedrooms', filters.min_bedrooms);
      }
      if (filters.max_bathrooms) {
        query = query.lte('bathrooms', filters.max_bathrooms);
      }

      const { data: properties, error, count } = await query.limit(500);

      if (error) throw error;

      // Transform for frontend (no filtering needed - PostgreSQL did it all)
      const transformed = (properties || []).map((p: Record<string, unknown>) => ({
        ...p,
        property_type: p.type,
        neighborhood: p.colonia,
        city: p.municipality,
        construction_m2: p.sqft,
        land_m2: p.lot_size,
      }));

      result = {
        mode: 'properties',
        data: transformed,
        total: count || 0,
      };
    } else {
      // Return clusters using pre-computed geohash columns
      const precision = getGeohashPrecision(zoom);

      // Select the appropriate RPC function based on precision
      const rpcName = precision <= 3 ? 'get_clusters_gh3' :
                      precision <= 4 ? 'get_clusters_gh4' : 'get_clusters_gh5';

      // CRITICAL FIX: Get REAL COUNT with all filters applied (same as search-properties)
      // This ensures mapa and lista show the same number
      let countQuery = supabase
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .gte('lat', bounds.south)
        .lte('lat', bounds.north)
        .gte('lng', bounds.west)
        .lte('lng', bounds.east)
        .eq('status', 'activa');

      if (filters.listing_type) {
        countQuery = countQuery.eq('listing_type', filters.listing_type);
      }
      if (filters.property_type) {
        countQuery = countQuery.eq('type', filters.property_type);
      }
      if (filters.min_price) {
        countQuery = countQuery.gte('price', filters.min_price);
      }
      if (filters.max_price) {
        countQuery = countQuery.lte('price', filters.max_price);
      }
      if (filters.min_bedrooms) {
        countQuery = countQuery.gte('bedrooms', filters.min_bedrooms);
      }

      // Execute count query and cluster query in parallel
      const [countResult, clusterResult] = await Promise.all([
        countQuery,
        // @ts-expect-error - RPC functions not in generated types
        supabase.rpc(rpcName, {
          p_north: bounds.north,
          p_south: bounds.south,
          p_east: bounds.east,
          p_west: bounds.west,
          p_listing_type: filters.listing_type || null,
          p_property_type: filters.property_type || null,
          p_min_price: filters.min_price || null,
          p_max_price: filters.max_price || null,
          p_min_bedrooms: filters.min_bedrooms || null,
        }),
      ]);

      const realCount = countResult.count || 0;
      const { data: clusters, error } = clusterResult;

      if (error) {
        // Fallback: fetch properties and cluster client-side
        console.log('Fallback to client-side clustering:', error.message);

        let fallbackQuery = supabase
          .from('properties')
          .select('id, lat, lng, price, geohash_4', { count: 'exact' })
          .gte('lat', bounds.south)
          .lte('lat', bounds.north)
          .gte('lng', bounds.west)
          .lte('lng', bounds.east)
          .eq('status', 'activa');

        // Apply filters in fallback too
        if (filters.listing_type) {
          fallbackQuery = fallbackQuery.eq('listing_type', filters.listing_type);
        }
        if (filters.property_type) {
          fallbackQuery = fallbackQuery.eq('type', filters.property_type);
        }
        if (filters.min_price) {
          fallbackQuery = fallbackQuery.gte('price', filters.min_price);
        }
        if (filters.max_price) {
          fallbackQuery = fallbackQuery.lte('price', filters.max_price);
        }
        if (filters.min_bedrooms) {
          fallbackQuery = fallbackQuery.gte('bedrooms', filters.min_bedrooms);
        }

        const { data: properties, error: propError, count } = await fallbackQuery.limit(2000);

        if (propError) throw propError;

        // Group by geohash_4 column
        const grid = new Map<string, { count: number; lat: number; lng: number; prices: number[] }>();

        for (const p of (properties || [])) {
          const key = (p as Record<string, unknown>).geohash_4 as string || 'unknown';

          if (!grid.has(key)) {
            grid.set(key, { count: 0, lat: 0, lng: 0, prices: [] });
          }
          const cell = grid.get(key)!;
          cell.count++;
          cell.lat += p.lat;
          cell.lng += p.lng;
          cell.prices.push(p.price);
        }

        const clusterData = Array.from(grid.values()).map(cell => ({
          count: cell.count,
          lat: cell.lat / cell.count,
          lng: cell.lng / cell.count,
          min_price: Math.min(...cell.prices),
          max_price: Math.max(...cell.prices),
        }));

        result = {
          mode: 'clusters',
          data: clusterData.slice(0, 500),
          total: count || 0,
        };
      } else {
        result = {
          mode: 'clusters',
          data: clusters || [],
          total: realCount,  // Use REAL COUNT, not SUM of clusters
        };
      }
    }

    const dbDuration = Date.now() - dbStart;
    const duration = Date.now() - startTime;

    console.log(JSON.stringify({
      level: 'info',
      request_id: requestId,
      message: 'Request completed',
      duration_ms: duration,
      db_query_ms: dbDuration,
      mode: result.mode,
      items: result.data.length,
      total: result.total,
    }));

    return new Response(
      JSON.stringify({
        ...result,
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

  } catch (err: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    console.error(JSON.stringify({
      level: 'error',
      request_id: requestId,
      message: 'Request failed',
      error: errorMessage,
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
          error: errorMessage,
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
