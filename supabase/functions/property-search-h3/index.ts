/**
 * Edge Function: property-search-h3
 *
 * Enterprise-grade property search using H3 hexagonal indexing.
 * Designed to scale to 5M+ properties with sub-100ms response times.
 *
 * Features:
 * - H3-based hierarchical clustering (res 4-9)
 * - Pre-computed materialized views for instant aggregations
 * - Automatic resolution selection based on zoom level
 * - Support for listing_type and other filters
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from '../_shared/cors.ts';

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
  // For drilling into a specific H3 cell
  h3_filter?: string;
}

/**
 * Maps zoom level to H3 resolution
 * Lower zoom = lower resolution = larger hexagons
 */
function getH3Resolution(zoom: number): number {
  if (zoom <= 6) return 4;   // ~1,770 km² (country/large region)
  if (zoom <= 8) return 5;   // ~253 km² (region)
  if (zoom <= 10) return 6;  // ~36 km² (city)
  if (zoom <= 12) return 7;  // ~5 km² (district)
  if (zoom <= 14) return 8;  // ~0.7 km² (neighborhood)
  return 9;                  // ~0.1 km² (block)
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

  try {
    const body: RequestBody = await req.json();
    const { bounds, zoom, filters = {}, page = 1, limit = 20, h3_filter } = body;

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

    const h3Resolution = getH3Resolution(zoom);

    // =============================================
    // H3 FILTER MODE (drilling into a specific hexagon)
    // =============================================
    if (h3_filter) {
      console.log(`[property-search-h3] Drilling into H3 cell: ${h3_filter}`);

      // Determine which H3 column to query based on filter length
      // H3 index strings have predictable lengths per resolution
      const resFromFilter = h3_filter.length <= 10 ? 6 :
                           h3_filter.length <= 11 ? 7 :
                           h3_filter.length <= 12 ? 8 : 9;
      const h3Col = `h3_res${resFromFilter}`;

      let query = supabase
        .from('properties')
        .select('id, title, slug, lat, lng, price, listing_type, type, bedrooms, bathrooms, sqft, colonia, municipality, state', { count: 'exact' })
        .eq('status', 'activa')
        .eq(h3Col, h3_filter);

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
            slug: p.slug,
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
            mode: 'h3_filter',
            h3_cell: h3_filter,
            resolution: resFromFilter,
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
        .select('id, title, slug, lat, lng, price, listing_type, type, bedrooms, bathrooms, sqft, colonia, municipality, state', { count: 'exact' })
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
            slug: p.slug,
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
    // CLUSTERS MODE (zoom < 14) - Use H3 Materialized Views
    // =============================================

    // Determine which materialized view to use
    const mvTable = filters.listing_type
      ? `mv_h3_clusters_res${h3Resolution}`
      : `mv_h3_clusters_res${h3Resolution}_all`;

    // Check if the "all" variant exists, otherwise use filtered variant
    const useAllVariant = !filters.listing_type && (h3Resolution === 6 || h3Resolution === 7);

    console.log(`[property-search-h3] Using MV: ${mvTable}, resolution: ${h3Resolution}`);

    // Query clusters from materialized view
    let clusterQuery = supabase
      .from(useAllVariant ? `mv_h3_clusters_res${h3Resolution}_all` : `mv_h3_clusters_res${h3Resolution}`)
      .select('h3_index, count, avg_price, min_price, max_price, lat, lng')
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
      .select('id, title, slug, lat, lng, price, listing_type, type, bedrooms, bathrooms, sqft, colonia, municipality, state', { count: 'exact' })
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
      // Fallback: if MV doesn't exist, return empty clusters
      // This allows graceful degradation before migrations are run
    }
    if (listResult.error) throw listResult.error;

    // Process clusters
    const clusters = (clusterResult.data || []).map((c: any) => ({
      id: c.h3_index,
      h3_index: c.h3_index,
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
          slug: p.slug,
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
          h3_resolution: h3Resolution,
          clusters_count: clusters.length,
          total_from_clusters: totalFromClusters,
          total_from_list: listTotal,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[property-search-h3] Error:', errorMessage);

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
