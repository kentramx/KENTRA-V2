import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkRateLimit, getClientIP, rateLimitedResponse, RateLimitConfig } from '../_shared/rateLimit.ts';

// Rate limit for public search: 60 requests per minute per IP
const searchRateLimit: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60 * 1000,
  keyPrefix: 'property-search',
};

// =============================================
// ENTERPRISE MAP CLUSTERING - REWRITTEN FROM SCRATCH
// Garantía: total === SUM(cluster.count)
// =============================================

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
  // NEW: When drilling into a cluster, pass geohash for exact count
  geohash_filter?: string;
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
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  // SECURITY: Rate limiting to prevent scraping
  const clientIP = getClientIP(req);
  const rateLimitResult = checkRateLimit(clientIP, searchRateLimit);
  if (!rateLimitResult.allowed) {
    return rateLimitedResponse(rateLimitResult, corsHeaders);
  }

  try {
    const body: RequestBody = await req.json();
    let { bounds, zoom, filters = {}, page = 1, limit = 20, geohash_filter } = body;

    // SECURITY: Input validation to prevent DoS
    page = Math.max(1, Math.min(page, 1000)); // Max 1000 pages
    limit = Math.max(1, Math.min(limit, 100)); // Max 100 items per page

    if (!bounds || zoom === undefined) {
      return new Response(
        JSON.stringify({ error: 'bounds and zoom required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Validate bounds are reasonable coordinates
    if (bounds.north < -90 || bounds.north > 90 ||
        bounds.south < -90 || bounds.south > 90 ||
        bounds.east < -180 || bounds.east > 180 ||
        bounds.west < -180 || bounds.west > 180) {
      return new Response(
        JSON.stringify({ error: 'Invalid coordinates' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Validate zoom is reasonable
    if (zoom < 0 || zoom > 22) {
      return new Response(
        JSON.stringify({ error: 'Invalid zoom level' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // =============================================
    // GEOHASH FILTER MODE (drilling into a cluster)
    // When user clicks cluster, pass geohash for EXACT count
    // =============================================
    if (geohash_filter) {
      const precision = geohash_filter.length;
      const geohashCol = `geohash_${precision}`;

      console.log(`[GEOHASH FILTER] Drilling into ${geohash_filter} (precision ${precision})`);

      // Query properties by geohash - GUARANTEED to match cluster count
      let query = supabase
        .from('properties')
        .select('id, title, lat, lng, price, listing_type, type, bedrooms, bathrooms, sqft, colonia, municipality, state', { count: 'exact' })
        .eq('status', 'activa')
        .eq(geohashCol, geohash_filter);

      // Apply filters
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

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;

      const total = count || 0;

      return new Response(
        JSON.stringify({
          mode: 'properties',
          mapData: (data || []).map((p: any) => ({
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            price: p.price,
            listing_type: p.listing_type,
          })),
          listItems: (data || []).map((p: any) => ({
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
            mode: 'geohash_filter',
            geohash: geohash_filter,
            precision,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Group by geohash - track bounds for each cluster
    const clusterMap = new Map<string, {
      count: number;
      latSum: number;
      lngSum: number;
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
      prices: number[];
    }>();

    for (const p of (clusterResult.data || [])) {
      const key = p[geohashCol] || 'unknown';
      if (!clusterMap.has(key)) {
        clusterMap.set(key, {
          count: 0,
          latSum: 0,
          lngSum: 0,
          minLat: Infinity,
          maxLat: -Infinity,
          minLng: Infinity,
          maxLng: -Infinity,
          prices: [],
        });
      }
      const cluster = clusterMap.get(key)!;
      cluster.count++;
      cluster.latSum += p.lat;
      cluster.lngSum += p.lng;
      // Track actual bounds of properties in this cluster
      cluster.minLat = Math.min(cluster.minLat, p.lat);
      cluster.maxLat = Math.max(cluster.maxLat, p.lat);
      cluster.minLng = Math.min(cluster.minLng, p.lng);
      cluster.maxLng = Math.max(cluster.maxLng, p.lng);
      cluster.prices.push(p.price);
    }

    // Convert to array with bounds
    const clusters = Array.from(clusterMap.entries())
      .map(([id, c]) => ({
        id,
        count: c.count,
        lat: c.latSum / c.count,
        lng: c.lngSum / c.count,
        // Actual bounds of all properties in this cluster
        bounds: {
          north: c.maxLat,
          south: c.minLat,
          east: c.maxLng,
          west: c.minLng,
        },
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
