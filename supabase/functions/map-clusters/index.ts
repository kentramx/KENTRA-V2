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
      // Return individual properties (limit 500)
      const { data: properties, error, count } = await supabase
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
        .eq('status', 'activa')
        .limit(500);

      if (error) throw error;

      // Apply additional filters manually since we can't chain them all
      let filtered = properties || [];
      if (filters.listing_type) {
        filtered = filtered.filter((p: Record<string, unknown>) => p.listing_type === filters.listing_type);
      }
      if (filters.property_type) {
        filtered = filtered.filter((p: Record<string, unknown>) => p.type === filters.property_type);
      }
      if (filters.min_price) {
        filtered = filtered.filter((p: Record<string, unknown>) => (p.price as number) >= filters.min_price!);
      }
      if (filters.max_price) {
        filtered = filtered.filter((p: Record<string, unknown>) => (p.price as number) <= filters.max_price!);
      }
      if (filters.min_bedrooms) {
        filtered = filtered.filter((p: Record<string, unknown>) => (p.bedrooms as number) >= filters.min_bedrooms!);
      }

      // Transform for frontend
      const transformed = filtered.map((p: Record<string, unknown>) => ({
        ...p,
        property_type: p.type,
        neighborhood: p.colonia,
        city: p.municipality,
        construction_m2: p.sqft,
        land_m2: p.lot_size,
      }));

      result = {
        mode: 'properties',
        data: transformed.slice(0, 500),
        total: count || filtered.length,
      };
    } else {
      // Return clusters using ST_GeoHash
      const precision = getGeohashPrecision(zoom);

      // Use raw SQL for clustering with ST_GeoHash
      const clusterQuery = `
        SELECT
          ST_GeoHash(geom, ${precision}) as geohash,
          COUNT(*) as count,
          AVG(lat) as lat,
          AVG(lng) as lng,
          MIN(price) as min_price,
          MAX(price) as max_price
        FROM properties
        WHERE ${whereClause}
          AND geom IS NOT NULL
        GROUP BY ST_GeoHash(geom, ${precision})
        ORDER BY count DESC
        LIMIT 500
      `;

      const { data: clusters, error } = await supabase.rpc('exec_raw_sql', {
        query: clusterQuery
      });

      if (error) {
        // Fallback: if exec_raw_sql doesn't exist, use simple aggregation
        console.log('Fallback to simple query');

        const { data: properties, error: propError, count } = await supabase
          .from('properties')
          .select('id, lat, lng, price', { count: 'exact' })
          .gte('lat', bounds.south)
          .lte('lat', bounds.north)
          .gte('lng', bounds.west)
          .lte('lng', bounds.east)
          .eq('status', 'activa')
          .limit(1000);

        if (propError) throw propError;

        // Simple client-side clustering by grid
        const gridSize = 0.1 / Math.pow(2, zoom - 10); // Adaptive grid
        const grid = new Map<string, { count: number; lat: number; lng: number; prices: number[] }>();

        for (const p of (properties || [])) {
          const gridX = Math.floor(p.lng / gridSize);
          const gridY = Math.floor(p.lat / gridSize);
          const key = `${gridX},${gridY}`;

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
          total: count || (properties?.length || 0),
        };
      } else {
        result = {
          mode: 'clusters',
          data: clusters || [],
          total: (clusters || []).reduce((sum: number, c: Record<string, unknown>) => sum + Number(c.count), 0),
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
