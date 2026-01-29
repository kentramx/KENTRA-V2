import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from '../_shared/cors.ts';

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
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

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
      // Return clusters
      const precision = getGeohashPrecision(zoom);
      const geohashColumn = `geohash_${precision}` as const;

      // Detect if we have advanced filters that MVs don't support
      const hasAdvancedFilters = !!(
        filters.min_price ||
        filters.max_price ||
        filters.min_bedrooms ||
        filters.max_bedrooms ||
        filters.min_bathrooms ||
        filters.property_type
      );

      // DEBUG: Log filter detection
      console.log(JSON.stringify({
        level: 'debug',
        request_id: requestId,
        message: 'CLUSTER PATH DECISION',
        hasAdvancedFilters,
        filters_received: filters,
        active_filters: Object.entries(filters)
          .filter(([_, v]) => v !== undefined && v !== null)
          .map(([k, v]) => `${k}=${v}`),
        path: hasAdvancedFilters ? 'DYNAMIC_CLUSTERING' : 'MATERIALIZED_VIEWS',
        zoom,
        precision,
        geohashColumn,
      }));

      if (hasAdvancedFilters) {
        // DYNAMIC CLUSTERING: Use when filters are active
        // MVs only support listing_type, so we query properties directly
        console.log(JSON.stringify({
          level: 'info',
          request_id: requestId,
          message: 'Using dynamic clustering (advanced filters active)',
          filters: Object.keys(filters).filter(k => filters[k as keyof typeof filters] !== undefined),
        }));

        let dynamicQuery = supabase
          .from('properties')
          .select(`id, lat, lng, price, geohash_${precision}`, { count: 'exact' })
          .gte('lat', bounds.south)
          .lte('lat', bounds.north)
          .gte('lng', bounds.west)
          .lte('lng', bounds.east)
          .eq('status', 'activa');

        // Apply ALL filters in PostgreSQL
        if (filters.listing_type) {
          dynamicQuery = dynamicQuery.eq('listing_type', filters.listing_type);
        }
        if (filters.property_type) {
          dynamicQuery = dynamicQuery.eq('type', filters.property_type);
        }
        if (filters.min_price) {
          dynamicQuery = dynamicQuery.gte('price', filters.min_price);
        }
        if (filters.max_price) {
          dynamicQuery = dynamicQuery.lte('price', filters.max_price);
        }
        if (filters.min_bedrooms) {
          dynamicQuery = dynamicQuery.gte('bedrooms', filters.min_bedrooms);
        }
        if (filters.max_bedrooms) {
          dynamicQuery = dynamicQuery.lte('bedrooms', filters.max_bedrooms);
        }

        const { data: properties, error: propError, count } = await dynamicQuery.limit(5000);

        if (propError) throw propError;

        // Group by geohash column (in JavaScript - fast for <5000 items)
        const grid = new Map<string, {
          geohash: string;
          count: number;
          lat: number;
          lng: number;
          prices: number[];
        }>();

        for (const p of (properties || [])) {
          const key = (p as Record<string, unknown>)[geohashColumn] as string || 'unknown';

          if (!grid.has(key)) {
            grid.set(key, { geohash: key, count: 0, lat: 0, lng: 0, prices: [] });
          }
          const cell = grid.get(key)!;
          cell.count++;
          cell.lat += (p as Record<string, unknown>).lat as number;
          cell.lng += (p as Record<string, unknown>).lng as number;
          cell.prices.push((p as Record<string, unknown>).price as number);
        }

        const clusterData = Array.from(grid.values()).map(cell => ({
          geohash: cell.geohash,
          count: cell.count,
          lat: cell.lat / cell.count,
          lng: cell.lng / cell.count,
          min_price: Math.min(...cell.prices),
          max_price: Math.max(...cell.prices),
        }));

        // DEBUG: Log dynamic clustering results
        console.log(JSON.stringify({
          level: 'debug',
          request_id: requestId,
          message: 'DYNAMIC_CLUSTERING_RESULT',
          properties_fetched: properties?.length || 0,
          clusters_created: clusterData.length,
          total_count: count,
          sample_clusters: clusterData.slice(0, 3).map(c => ({ geohash: c.geohash, count: c.count })),
        }));

        result = {
          mode: 'clusters',
          data: clusterData.slice(0, 500),
          total: count || 0,
          _debug_path: 'DYNAMIC_CLUSTERING',
        } as any;

      } else {
        // MATERIALIZED VIEWS: Use when no advanced filters (fast path)
        const rpcName = precision <= 3 ? 'get_clusters_gh3' :
                        precision <= 4 ? 'get_clusters_gh4' : 'get_clusters_gh5';

        // Get COUNT (for consistency with lista)
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

        // Execute count and clusters in parallel
        const [countResult, clusterResult] = await Promise.all([
          countQuery,
          // @ts-expect-error - RPC functions not in generated types
          supabase.rpc(rpcName, {
            p_north: bounds.north,
            p_south: bounds.south,
            p_east: bounds.east,
            p_west: bounds.west,
            p_listing_type: filters.listing_type || null,
            p_property_type: null,
            p_min_price: null,
            p_max_price: null,
            p_min_bedrooms: null,
          }),
        ]);

        const realCount = countResult.count || 0;
        const { data: clusters, error } = clusterResult;

        if (error) {
          throw error;
        }

        // DEBUG: Log MV results
        console.log(JSON.stringify({
          level: 'debug',
          request_id: requestId,
          message: 'MV_CLUSTERING_RESULT',
          clusters_from_mv: clusters?.length || 0,
          real_count: realCount,
          sum_of_cluster_counts: (clusters || []).reduce((sum: number, c: any) => sum + Number(c.count), 0),
          sample_clusters: (clusters || []).slice(0, 3).map((c: any) => ({ geohash: c.geohash, count: c.count })),
        }));

        result = {
          mode: 'clusters',
          data: clusters || [],
          total: realCount,
          _debug_path: 'MATERIALIZED_VIEWS',
        } as any;
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

    // Determine which path was used for debugging
    const clusteringPath = shouldShowProperties(zoom) ? 'PROPERTIES_MODE' :
      (result as any)._debug_path || 'UNKNOWN';

    return new Response(
      JSON.stringify({
        ...result,
        _meta: {
          request_id: requestId,
          duration_ms: duration,
          db_query_ms: dbDuration,
          timestamp: new Date().toISOString(),
          // DEBUG INFO
          clustering_path: clusteringPath,
          filters_received: filters,
          has_advanced_filters: !!(
            filters.min_price ||
            filters.max_price ||
            filters.min_bedrooms ||
            filters.max_bedrooms ||
            filters.min_bathrooms ||
            filters.property_type
          ),
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
