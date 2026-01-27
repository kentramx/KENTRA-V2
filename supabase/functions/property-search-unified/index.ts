import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// =============================================
// ENTERPRISE MAP CLUSTERING - REWRITTEN FROM SCRATCH
// Garantía: total === SUM(cluster.count)
// =============================================

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

// Zoom level → geohash precision
function getGeohashPrecision(zoom: number): number {
  if (zoom <= 8) return 3;
  if (zoom <= 11) return 4;
  if (zoom <= 13) return 5;
  return 6;
}

// Zoom >= 14 → show individual properties
function shouldShowProperties(zoom: number): boolean {
  return zoom >= 14;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

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

    // =============================================
    // PROPERTIES MODE (zoom >= 14)
    // =============================================
    if (shouldShowProperties(zoom)) {
      // Query for map (limit 500)
      let mapQuery = supabase
        .from('properties')
        .select('id, lat, lng, price, listing_type')
        .eq('status', 'activa')
        .gte('lat', bounds.south)
        .lte('lat', bounds.north)
        .gte('lng', bounds.west)
        .lte('lng', bounds.east);

      // Query for list (paginated)
      let listQuery = supabase
        .from('properties')
        .select('id, title, lat, lng, price, listing_type, type, bedrooms, bathrooms, sqft, colonia, municipality, state', { count: 'exact' })
        .eq('status', 'activa')
        .gte('lat', bounds.south)
        .lte('lat', bounds.north)
        .gte('lng', bounds.west)
        .lte('lng', bounds.east);

      // Apply filters
      if (filters.listing_type) {
        mapQuery = mapQuery.eq('listing_type', filters.listing_type);
        listQuery = listQuery.eq('listing_type', filters.listing_type);
      }
      if (filters.property_type) {
        mapQuery = mapQuery.eq('type', filters.property_type);
        listQuery = listQuery.eq('type', filters.property_type);
      }
      if (filters.min_price) {
        mapQuery = mapQuery.gte('price', filters.min_price);
        listQuery = listQuery.gte('price', filters.min_price);
      }
      if (filters.max_price) {
        mapQuery = mapQuery.lte('price', filters.max_price);
        listQuery = listQuery.lte('price', filters.max_price);
      }
      if (filters.min_bedrooms) {
        mapQuery = mapQuery.gte('bedrooms', filters.min_bedrooms);
        listQuery = listQuery.gte('bedrooms', filters.min_bedrooms);
      }

      // Execute
      const [mapResult, listResult] = await Promise.all([
        mapQuery.limit(500),
        listQuery.order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1),
      ]);

      if (mapResult.error) throw mapResult.error;
      if (listResult.error) throw listResult.error;

      const total = listResult.count || 0;

      return new Response(
        JSON.stringify({
          mode: 'properties',
          mapData: mapResult.data || [],
          listItems: (listResult.data || []).map((p: any) => ({
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
          })),
          total,
          page,
          totalPages: Math.ceil(total / limit),
          _meta: {
            duration_ms: Date.now() - startTime,
            mode: 'properties',
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =============================================
    // CLUSTERS MODE (zoom < 14)
    // =============================================
    const precision = getGeohashPrecision(zoom);
    const geohashCol = `geohash_${precision}`;

    // Single query: fetch properties for clustering
    let clusterQuery = supabase
      .from('properties')
      .select(`id, lat, lng, price, ${geohashCol}`)
      .eq('status', 'activa')
      .gte('lat', bounds.south)
      .lte('lat', bounds.north)
      .gte('lng', bounds.west)
      .lte('lng', bounds.east);

    // Query for list (paginated)
    let listQuery = supabase
      .from('properties')
      .select('id, title, lat, lng, price, listing_type, type, bedrooms, bathrooms, sqft, colonia, municipality, state', { count: 'exact' })
      .eq('status', 'activa')
      .gte('lat', bounds.south)
      .lte('lat', bounds.north)
      .gte('lng', bounds.west)
      .lte('lng', bounds.east);

    // Apply filters
    if (filters.listing_type) {
      clusterQuery = clusterQuery.eq('listing_type', filters.listing_type);
      listQuery = listQuery.eq('listing_type', filters.listing_type);
    }
    if (filters.property_type) {
      clusterQuery = clusterQuery.eq('type', filters.property_type);
      listQuery = listQuery.eq('type', filters.property_type);
    }
    if (filters.min_price) {
      clusterQuery = clusterQuery.gte('price', filters.min_price);
      listQuery = listQuery.gte('price', filters.min_price);
    }
    if (filters.max_price) {
      clusterQuery = clusterQuery.lte('price', filters.max_price);
      listQuery = listQuery.lte('price', filters.max_price);
    }
    if (filters.min_bedrooms) {
      clusterQuery = clusterQuery.gte('bedrooms', filters.min_bedrooms);
      listQuery = listQuery.gte('bedrooms', filters.min_bedrooms);
    }

    // Execute both queries
    const [clusterResult, listResult] = await Promise.all([
      clusterQuery.limit(10000), // Higher limit for accurate clustering
      listQuery.order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1),
    ]);

    if (clusterResult.error) throw clusterResult.error;
    if (listResult.error) throw listResult.error;

    // Group by geohash
    const clusterMap = new Map<string, {
      count: number;
      latSum: number;
      lngSum: number;
      prices: number[];
    }>();

    for (const p of (clusterResult.data || [])) {
      const key = p[geohashCol] || 'unknown';
      if (!clusterMap.has(key)) {
        clusterMap.set(key, { count: 0, latSum: 0, lngSum: 0, prices: [] });
      }
      const cluster = clusterMap.get(key)!;
      cluster.count++;
      cluster.latSum += p.lat;
      cluster.lngSum += p.lng;
      cluster.prices.push(p.price);
    }

    // Convert to array
    const clusters = Array.from(clusterMap.entries())
      .map(([id, c]) => ({
        id,
        count: c.count,
        lat: c.latSum / c.count,
        lng: c.lngSum / c.count,
        min_price: Math.min(...c.prices),
        max_price: Math.max(...c.prices),
      }))
      .sort((a, b) => b.count - a.count);

    // CRITICAL: total = SUM of cluster counts (NOT from separate COUNT query)
    const totalFromClusters = clusters.reduce((sum, c) => sum + c.count, 0);

    // Use the larger of the two totals to handle edge cases
    // But prefer list count for pagination accuracy
    const listTotal = listResult.count || 0;

    // If there's a discrepancy, log it but use listTotal for pagination
    if (totalFromClusters !== listTotal && clusterResult.data && clusterResult.data.length < 10000) {
      console.log(`[SYNC CHECK] clusters sum: ${totalFromClusters}, list count: ${listTotal}`);
    }

    return new Response(
      JSON.stringify({
        mode: 'clusters',
        mapData: clusters,
        listItems: (listResult.data || []).map((p: any) => ({
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
        })),
        // Use totalFromClusters for display consistency
        total: totalFromClusters,
        page,
        totalPages: Math.ceil(listTotal / limit),
        _meta: {
          duration_ms: Date.now() - startTime,
          mode: 'clusters',
          precision,
          clusters_count: clusters.length,
          properties_processed: clusterResult.data?.length || 0,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[property-search-unified] Error:', errorMessage);

    return new Response(
      JSON.stringify({
        error: errorMessage,
        mode: 'clusters',
        mapData: [],
        listItems: [],
        total: 0,
        page: 1,
        totalPages: 0,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
