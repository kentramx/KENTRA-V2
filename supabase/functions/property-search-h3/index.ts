/**
 * @deprecated Use property-search-vNext instead.
 *
 * This endpoint has inconsistent totals between clusters and list.
 * Clusters come from MVs without advanced filters, list has all filters.
 *
 * Migration: property-search-vNext guarantees consistent totals.
 *
 * Edge Function: property-search-h3 (LEGACY)
 *
 * Enterprise-grade property search using geohash-based clustering.
 * (Originally designed for H3, but Supabase doesn't support H3 extension)
 *
 * Designed to scale to 5M+ properties with sub-100ms response times.
 *
 * Features:
 * - Geohash-based hierarchical clustering (precision 7)
 * - Pre-computed materialized views for instant aggregations
 * - Support for listing_type and other filters
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkRateLimit, getClientIP, rateLimitedResponse, RateLimitConfig } from '../_shared/rateLimit.ts';

// Rate limit for public search: 60 requests per minute per IP
const searchRateLimit: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60 * 1000,
  keyPrefix: 'property-search-h3',
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
  // For drilling into a specific geohash cell
  geohash_filter?: string;
}

/**
 * At zoom >= 14, show individual properties instead of clusters
 */
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
    const { bounds, zoom, filters = {}, page = 1, limit = 20, geohash_filter } = body;

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
    // GEOHASH FILTER MODE (drilling into a specific geohash cell)
    // =============================================
    if (geohash_filter) {
      console.log(`[property-search-h3] Drilling into geohash: ${geohash_filter}`);

      // Use geohash_7 column for filtering (all our clusters use precision 7)
      let query = supabase
        .from('properties')
        .select('id, title, code, lat, lng, price, listing_type, type, bedrooms, bathrooms, sqft, colonia, municipality, state', { count: 'exact' })
        .eq('status', 'activa')
        .eq('geohash_7', geohash_filter);

      // Apply filters
      if (filters.listing_type) query = query.eq('listing_type', filters.listing_type);
      if (filters.property_type) query = query.eq('type', filters.property_type);
      if (filters.min_price) query = query.gte('price', filters.min_price);
      if (filters.max_price) query = query.lte('price', filters.max_price);
      if (filters.min_bedrooms) query = query.gte('bedrooms', filters.min_bedrooms);

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
            slug: p.code,
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
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =============================================
    // PROPERTIES MODE (zoom >= 14)
    // =============================================
    if (shouldShowProperties(zoom)) {
      // Query for map (limit 500 for performance)
      let mapQuery = supabase
        .from('properties')
        .select('id, lat, lng, price, listing_type')
        .eq('status', 'activa')
        .gte('lat', bounds.south)
        .lte('lat', bounds.north)
        .gte('lng', bounds.west)
        .lte('lng', bounds.east);

      // Query for list (paginated with count)
      let listQuery = supabase
        .from('properties')
        .select('id, title, code, lat, lng, price, listing_type, type, bedrooms, bathrooms, sqft, colonia, municipality, state', { count: 'exact' })
        .eq('status', 'activa')
        .gte('lat', bounds.south)
        .lte('lat', bounds.north)
        .gte('lng', bounds.west)
        .lte('lng', bounds.east);

      // Apply filters to both queries
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

      // Execute both queries in parallel
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
            slug: p.code,
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
            properties_on_map: mapResult.data?.length || 0,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =============================================
    // CLUSTERS MODE (zoom < 14) - Use Geohash Materialized Views
    // =============================================

    // We use geohash precision 7 for all zoom levels (simplification)
    // Determine which materialized view to use based on listing_type filter
    const useAllVariant = !filters.listing_type;
    const mvTable = useAllVariant ? 'mv_geohash_clusters_7_all' : 'mv_geohash_clusters_7';

    console.log(`[property-search-h3] Using MV: ${mvTable}, zoom: ${zoom}`);

    // Query clusters from materialized view
    let clusterQuery = supabase
      .from(mvTable)
      .select('geohash, count, avg_price, min_price, max_price, lat, lng' + (useAllVariant ? '' : ', listing_type'))
      .gte('lat', bounds.south)
      .lte('lat', bounds.north)
      .gte('lng', bounds.west)
      .lte('lng', bounds.east);

    // Apply listing_type filter if not using "all" variant
    if (filters.listing_type && !useAllVariant) {
      clusterQuery = clusterQuery.eq('listing_type', filters.listing_type);
    }

    // Query for list (separate query for pagination)
    let listQuery = supabase
      .from('properties')
      .select('id, title, code, lat, lng, price, listing_type, type, bedrooms, bathrooms, sqft, colonia, municipality, state', { count: 'exact' })
      .eq('status', 'activa')
      .gte('lat', bounds.south)
      .lte('lat', bounds.north)
      .gte('lng', bounds.west)
      .lte('lng', bounds.east);

    // Apply all filters to list query
    if (filters.listing_type) listQuery = listQuery.eq('listing_type', filters.listing_type);
    if (filters.property_type) listQuery = listQuery.eq('type', filters.property_type);
    if (filters.min_price) listQuery = listQuery.gte('price', filters.min_price);
    if (filters.max_price) listQuery = listQuery.lte('price', filters.max_price);
    if (filters.min_bedrooms) listQuery = listQuery.gte('bedrooms', filters.min_bedrooms);

    // Execute both queries in parallel
    const [clusterResult, listResult] = await Promise.all([
      clusterQuery.limit(2000), // Limit clusters for performance
      listQuery.order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1),
    ]);

    if (clusterResult.error) {
      console.error('[property-search-h3] Cluster query error:', clusterResult.error);
      // Fallback: if MV doesn't exist or has no data, return empty clusters
      // This allows graceful degradation before data is populated
    }
    if (listResult.error) throw listResult.error;

    // Process clusters - use geohash as the ID
    const clusters = (clusterResult.data || []).map((c: any) => ({
      id: c.geohash,
      geohash: c.geohash,
      count: Number(c.count),
      avg_price: Number(c.avg_price),
      min_price: Number(c.min_price),
      max_price: Number(c.max_price),
      lat: Number(c.lat),
      lng: Number(c.lng),
    }));

    // Calculate total from clusters for consistency
    const totalFromClusters = clusters.reduce((sum: number, c: any) => sum + c.count, 0);
    const listTotal = listResult.count || 0;

    return new Response(
      JSON.stringify({
        mode: 'clusters',
        mapData: clusters,
        listItems: (listResult.data || []).map((p: any) => ({
          id: p.id,
          title: p.title,
          slug: p.code,
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
        // Use cluster total for display, list total for pagination
        total: totalFromClusters || listTotal,
        page,
        totalPages: Math.ceil(listTotal / limit),
        _meta: {
          duration_ms: Date.now() - startTime,
          mode: 'clusters',
          geohash_precision: 7,
          clusters_count: clusters.length,
          total_from_clusters: totalFromClusters,
          total_from_list: listTotal,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    let errorMessage = 'Unknown error';
    if (err instanceof Error) {
      errorMessage = err.message;
    } else if (typeof err === 'object' && err !== null) {
      // Handle Supabase error objects
      const supaErr = err as { message?: string; details?: string; hint?: string; code?: string };
      errorMessage = supaErr.message || supaErr.details || JSON.stringify(err);
    } else {
      errorMessage = String(err);
    }
    console.error('[property-search-h3] Error:', errorMessage, JSON.stringify(err));

    return new Response(
      JSON.stringify({
        error: errorMessage,
        errorDetails: JSON.stringify(err),
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
