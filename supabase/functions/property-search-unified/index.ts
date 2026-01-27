import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface Filters {
  listing_type?: 'venta' | 'renta';
  property_type?: string;
  min_price?: number;
  max_price?: number;
  min_bedrooms?: number;
}

interface RequestBody {
  bounds: Bounds;
  zoom: number;
  filters?: Filters;
  page?: number;
  limit?: number;
}

interface Cluster {
  id: string;
  lat: number;
  lng: number;
  count: number;
  min_price: number;
  max_price: number;
  bounds: Bounds;
}

interface MapProperty {
  id: string;
  lat: number;
  lng: number;
  price: number;
  listing_type: string;
}

interface ListProperty extends MapProperty {
  title: string;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  construction_m2?: number;
  neighborhood?: string;
  city?: string;
  state?: string;
  image_url?: string;
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
    const { bounds, zoom, filters = {}, page = 1, limit = 20 } = body;

    if (!bounds || zoom === undefined) {
      return new Response(
        JSON.stringify({ error: 'bounds and zoom required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const dbStart = Date.now();

    // ============================================
    // BUILD FILTERED QUERY (without select - each query specifies its own)
    // ============================================
    const applyFilters = (query: any) => {
      query = query
        .eq('status', 'activa')
        .gte('lat', bounds.south)
        .lte('lat', bounds.north)
        .gte('lng', bounds.west)
        .lte('lng', bounds.east);

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

      return query;
    };

    // ============================================
    // EXECUTE PARALLEL QUERIES
    // ============================================
    const mode = shouldShowProperties(zoom) ? 'properties' : 'clusters';
    const precision = getGeohashPrecision(zoom);
    const geohashCol = `geohash_${precision}`;

    // Query 1: COUNT (total)
    const countPromise = applyFilters(
      supabase.from('properties').select('id', { count: 'exact', head: true })
    );

    // Query 2: LIST DATA (paginated)
    const listPromise = applyFilters(
      supabase.from('properties').select(`
        id,
        title,
        lat,
        lng,
        price,
        listing_type,
        type,
        bedrooms,
        bathrooms,
        sqft,
        colonia,
        municipality,
        state
      `)
    )
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    // Query 3: MAP DATA (clusters or properties)
    let mapPromise: Promise<any>;

    if (mode === 'properties') {
      // Individual properties for high zoom
      mapPromise = applyFilters(
        supabase.from('properties').select('id, lat, lng, price, listing_type')
      ).limit(500);
    } else {
      // Dynamic clustering with real bounds
      mapPromise = applyFilters(
        supabase.from('properties').select(`id, lat, lng, price, ${geohashCol}`)
      ).limit(5000);
    }

    // Execute all queries in parallel
    const [countResult, listResult, mapResult] = await Promise.all([
      countPromise,
      listPromise,
      mapPromise,
    ]);

    if (countResult.error) throw countResult.error;
    if (listResult.error) throw listResult.error;
    if (mapResult.error) throw mapResult.error;

    const total = countResult.count || 0;
    const totalPages = Math.ceil(total / limit);

    // ============================================
    // PROCESS MAP DATA
    // ============================================
    let mapData: Cluster[] | MapProperty[];

    if (mode === 'properties') {
      // Transform properties for map
      mapData = (mapResult.data || []).map((p: any) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        price: p.price,
        listing_type: p.listing_type,
      }));
    } else {
      // Group into clusters with real bounds
      const clusterMap = new Map<string, {
        id: string;
        count: number;
        latSum: number;
        lngSum: number;
        prices: number[];
        lats: number[];
        lngs: number[];
      }>();

      for (const p of (mapResult.data || [])) {
        const key = p[geohashCol] || 'unknown';

        if (!clusterMap.has(key)) {
          clusterMap.set(key, {
            id: key,
            count: 0,
            latSum: 0,
            lngSum: 0,
            prices: [],
            lats: [],
            lngs: [],
          });
        }

        const cluster = clusterMap.get(key)!;
        cluster.count++;
        cluster.latSum += p.lat;
        cluster.lngSum += p.lng;
        cluster.prices.push(p.price);
        cluster.lats.push(p.lat);
        cluster.lngs.push(p.lng);
      }

      // Convert to array with real bounds
      mapData = Array.from(clusterMap.values())
        .map((c) => ({
          id: c.id,
          lat: c.latSum / c.count,
          lng: c.lngSum / c.count,
          count: c.count,
          min_price: Math.min(...c.prices),
          max_price: Math.max(...c.prices),
          bounds: {
            north: Math.max(...c.lats),
            south: Math.min(...c.lats),
            east: Math.max(...c.lngs),
            west: Math.min(...c.lngs),
          },
          // DEBUG: Include property count used for bounds
          _debug_lats_count: c.lats.length,
          _debug_lngs_count: c.lngs.length,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 500);

      // DEBUG: Log cluster bounds calculation
      console.log(JSON.stringify({
        level: 'debug',
        request_id: requestId,
        message: 'CLUSTER_BOUNDS_CALCULATION',
        total_properties_fetched: mapResult.data?.length || 0,
        clusters_created: mapData.length,
        sample_clusters: mapData.slice(0, 3).map((c: any) => ({
          id: c.id,
          count: c.count,
          bounds: c.bounds,
          lats_used: c._debug_lats_count,
        })),
      }));
    }

    // ============================================
    // PROCESS LIST DATA
    // ============================================
    const listItems: ListProperty[] = (listResult.data || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      lat: p.lat,
      lng: p.lng,
      price: p.price,
      listing_type: p.listing_type,
      property_type: p.type,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      construction_m2: p.sqft,
      neighborhood: p.colonia,
      city: p.municipality,
      state: p.state,
    }));

    const dbDuration = Date.now() - dbStart;
    const duration = Date.now() - startTime;

    // ============================================
    // RESPONSE
    // ============================================
    return new Response(
      JSON.stringify({
        mode,
        mapData,
        listItems,
        total,
        page,
        totalPages,
        _meta: {
          request_id: requestId,
          duration_ms: duration,
          db_query_ms: dbDuration,
          clustering_method: mode === 'clusters' ? 'dynamic' : 'none',
          geohash_precision: mode === 'clusters' ? precision : null,
          timestamp: new Date().toISOString(),
        },
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
        mapData: [],
        listItems: [],
        total: 0,
        page: 1,
        totalPages: 0,
        _meta: {
          request_id: requestId,
          duration_ms: duration,
          error: errorMessage,
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
