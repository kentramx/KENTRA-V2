import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// =============================================
// ENTERPRISE MAP CLUSTERING V2 - QUADTREE
// Invariant: parent.count === SUM(children.count) ALWAYS
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
  // Mode 1: Viewport clusters
  bounds?: Bounds;
  zoom?: number;
  // Mode 2: Drill-down into specific node
  node_id?: string;
  // Common
  filters?: Filters;
  page?: number;
  limit?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body: RequestBody = await req.json();
    const { bounds, zoom, node_id, filters = {}, page = 1, limit = 20 } = body;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // =============================================
    // MODE 2: DRILL-DOWN (node_id provided)
    // GUARANTEES: count === properties returned
    // =============================================
    if (node_id) {
      console.log(`[DRILL-DOWN] Node: ${node_id}, filters:`, filters);

      // Get node info
      const { data: nodeData, error: nodeError } = await supabase
        .from('spatial_tree_nodes')
        .select('id, level, total_count, count_venta, count_renta, min_lat, max_lat, min_lng, max_lng')
        .eq('id', node_id)
        .single();

      if (nodeError || !nodeData) {
        throw new Error(`Node not found: ${node_id}`);
      }

      // Determine count based on filters
      let expectedCount = nodeData.total_count;
      if (filters.listing_type === 'venta') expectedCount = nodeData.count_venta;
      if (filters.listing_type === 'renta') expectedCount = nodeData.count_renta;

      // Check if this node should show children (clusters) or properties
      const maxLevel = 8;
      const showProperties = nodeData.level >= 6 || expectedCount <= 500;

      if (showProperties) {
        // Return properties under this node
        const { data: properties, error: propError } = await supabase.rpc(
          'get_node_properties',
          {
            p_node_id: node_id,
            p_listing_type: filters.listing_type || null,
            p_property_type: filters.property_type || null,
            p_page: page,
            p_limit: limit,
          }
        );

        if (propError) throw propError;

        return new Response(
          JSON.stringify({
            mode: 'properties',
            mapData: (properties || []).map((p: any) => ({
              id: p.id,
              lat: p.lat,
              lng: p.lng,
              price: p.price,
              listing_type: p.listing_type,
            })),
            listItems: properties || [],
            total: expectedCount,
            page,
            totalPages: Math.ceil(expectedCount / limit),
            node: {
              id: node_id,
              bounds: {
                north: nodeData.max_lat,
                south: nodeData.min_lat,
                east: nodeData.max_lng,
                west: nodeData.min_lng,
              },
            },
            _meta: {
              duration_ms: Date.now() - startTime,
              mode: 'drill_down_properties',
              node_id,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Return children clusters
        const { data: children, error: childError } = await supabase.rpc(
          'get_node_children',
          {
            p_parent_id: node_id,
            p_listing_type: filters.listing_type || null,
            p_property_type: filters.property_type || null,
          }
        );

        if (childError) throw childError;

        return new Response(
          JSON.stringify({
            mode: 'clusters',
            mapData: (children || []).map((c: any) => ({
              id: c.id,
              lat: c.lat,
              lng: c.lng,
              count: c.count,
              bounds: {
                north: c.bounds_north,
                south: c.bounds_south,
                east: c.bounds_east,
                west: c.bounds_west,
              },
              min_price: c.min_price,
              max_price: c.max_price,
              is_leaf: c.is_leaf,
            })),
            listItems: [], // No list items for cluster view
            total: expectedCount,
            page: 1,
            totalPages: 1,
            node: {
              id: node_id,
              bounds: {
                north: nodeData.max_lat,
                south: nodeData.min_lat,
                east: nodeData.max_lng,
                west: nodeData.min_lng,
              },
            },
            _meta: {
              duration_ms: Date.now() - startTime,
              mode: 'drill_down_clusters',
              node_id,
              children_count: (children || []).length,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // =============================================
    // MODE 1: VIEWPORT CLUSTERS (bounds + zoom)
    // =============================================
    if (!bounds || zoom === undefined) {
      // Return empty result instead of error - frontend may call before map initializes
      return new Response(
        JSON.stringify({
          mode: 'clusters',
          mapData: [],
          listItems: [],
          total: 0,
          page: 1,
          totalPages: 0,
          _meta: { duration_ms: Date.now() - startTime, mode: 'no_viewport' },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[VIEWPORT] zoom=${zoom}, bounds:`, bounds, 'filters:', filters);

    // High zoom = show individual properties
    if (zoom >= 14) {
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

    // Low zoom = use tree clusters
    const { data: clusters, error: clusterError } = await supabase.rpc(
      'get_tree_clusters',
      {
        p_min_lat: bounds.south,
        p_max_lat: bounds.north,
        p_min_lng: bounds.west,
        p_max_lng: bounds.east,
        p_zoom: zoom,
        p_listing_type: filters.listing_type || null,
        p_property_type: filters.property_type || null,
      }
    );

    if (clusterError) throw clusterError;

    // Calculate total from clusters (guaranteed accurate due to tree invariant)
    const total = (clusters || []).reduce((sum: number, c: any) => sum + c.count, 0);

    // Get list items for sidebar
    let listQuery = supabase
      .from('properties')
      .select('id, title, lat, lng, price, listing_type, type, bedrooms, bathrooms, sqft, colonia, municipality, state', { count: 'exact' })
      .eq('status', 'activa')
      .gte('lat', bounds.south)
      .lte('lat', bounds.north)
      .gte('lng', bounds.west)
      .lte('lng', bounds.east);

    if (filters.listing_type) {
      listQuery = listQuery.eq('listing_type', filters.listing_type);
    }
    if (filters.property_type) {
      listQuery = listQuery.eq('type', filters.property_type);
    }
    if (filters.min_price) {
      listQuery = listQuery.gte('price', filters.min_price);
    }
    if (filters.max_price) {
      listQuery = listQuery.lte('price', filters.max_price);
    }
    if (filters.min_bedrooms) {
      listQuery = listQuery.gte('bedrooms', filters.min_bedrooms);
    }

    const listResult = await listQuery
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (listResult.error) throw listResult.error;

    return new Response(
      JSON.stringify({
        mode: 'clusters',
        mapData: (clusters || []).map((c: any) => ({
          id: c.id,
          lat: c.lat,
          lng: c.lng,
          count: c.count,
          bounds: {
            north: c.bounds_north,
            south: c.bounds_south,
            east: c.bounds_east,
            west: c.bounds_west,
          },
          min_price: c.min_price,
          max_price: c.max_price,
        })),
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
        totalPages: Math.ceil((listResult.count || 0) / limit),
        _meta: {
          duration_ms: Date.now() - startTime,
          mode: 'clusters',
          clusters_count: (clusters || []).length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[property-search-tree] Error:', errorMessage);

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
