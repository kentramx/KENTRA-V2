/**
 * Edge Function: get-clusters
 * ENTERPRISE: Sirve clusters pre-computados con fallback a estimated count
 *
 * ESTRATEGIA:
 * 1. Intenta obtener clusters pre-computados de property_clusters
 * 2. Si no hay clusters (backfill pendiente), retorna estimación rápida
 * 3. Nunca hace queries pesadas que puedan timeout
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    listing_type?: string;
    property_type?: string;
    min_price?: number;
    max_price?: number;
    min_bedrooms?: number;
  };
}

interface ClusterResult {
  id: string;
  lat: number;
  lng: number;
  count: number;
  avg_price: number | null;
  is_cluster: boolean;
}

// Generate synthetic clusters for large viewports when pre-computed don't exist
function generateSyntheticClusters(
  bounds: RequestBody["bounds"],
  zoom: number,
  estimatedTotal: number
): Array<{ id: string; lat: number; lng: number; count: number; expansion_zoom: number }> {
  // At country level (zoom < 8), create a grid of clusters
  const gridSize = zoom <= 5 ? 3 : zoom <= 7 ? 4 : 5;
  const latStep = (bounds.north - bounds.south) / gridSize;
  const lngStep = (bounds.east - bounds.west) / gridSize;
  const countPerCluster = Math.ceil(estimatedTotal / (gridSize * gridSize));

  const clusters: Array<{ id: string; lat: number; lng: number; count: number; expansion_zoom: number }> = [];

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const lat = bounds.south + latStep * (i + 0.5);
      const lng = bounds.west + lngStep * (j + 0.5);

      // Only add cluster if it's within Mexico's approximate bounds
      if (lat >= 14 && lat <= 33 && lng >= -118 && lng <= -86) {
        clusters.push({
          id: `synthetic-${i}-${j}`,
          lat,
          lng,
          count: countPerCluster,
          expansion_zoom: Math.min(zoom + 2, 12),
        });
      }
    }
  }

  return clusters;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { bounds, zoom, filters = {} }: RequestBody = await req.json();

    // Validar bounds
    if (!bounds || bounds.north == null || bounds.south == null ||
        bounds.east == null || bounds.west == null) {
      return new Response(
        JSON.stringify({ error: "Invalid bounds", clusters: [], properties: [] }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // STEP 1: Try to get pre-computed clusters
    const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/get_clusters_in_viewport`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        p_bounds_north: bounds.north,
        p_bounds_south: bounds.south,
        p_bounds_east: bounds.east,
        p_bounds_west: bounds.west,
        p_zoom: zoom,
        p_listing_type: filters.listing_type || null,
        p_limit: zoom >= 14 ? 500 : 200,
      }),
    });

    if (!rpcResponse.ok) {
      const errorText = await rpcResponse.text();
      console.error("[get-clusters] RPC error:", errorText);
      throw new Error(`Database error: ${rpcResponse.status}`);
    }

    const results = (await rpcResponse.json()) as ClusterResult[];

    // Separar clusters y propiedades individuales
    let clusters = results
      .filter((r) => r.is_cluster)
      .map((r) => ({
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        count: r.count,
        avg_price: r.avg_price,
        expansion_zoom: Math.min(zoom + 2, 16),
      }));

    const properties = results
      .filter((r) => !r.is_cluster)
      .map((r) => ({
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        price: r.avg_price || 0,
        count: 1,
      }));

    let totalCount = results.reduce((sum, r) => sum + r.count, 0);
    let source: 'pre-computed' | 'properties' | 'synthetic' = zoom >= 14 ? 'properties' : 'pre-computed';

    // STEP 2: If no clusters found at low zoom, get estimated count and create synthetic clusters
    if (clusters.length === 0 && properties.length === 0 && zoom < 14) {
      console.log("[get-clusters] No pre-computed clusters found, fetching estimated count");

      // Get estimated count from materialized view (O(1) query)
      const countResponse = await fetch(`${supabaseUrl}/rest/v1/mv_property_counts_by_status?status=eq.activa&select=count`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      if (countResponse.ok) {
        const countData = await countResponse.json();
        if (countData && countData.length > 0) {
          totalCount = Number(countData[0].count) || 0;
        }
      }

      // Generate synthetic clusters for visualization
      if (totalCount > 0 && zoom < 10) {
        clusters = generateSyntheticClusters(bounds, zoom, totalCount);
        source = 'synthetic';
        console.log(`[get-clusters] Generated ${clusters.length} synthetic clusters for ${totalCount} properties`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[get-clusters] zoom=${zoom} clusters=${clusters.length} props=${properties.length} total=${totalCount} source=${source} ${duration}ms`
    );

    return new Response(
      JSON.stringify({
        clusters,
        properties,
        total: totalCount,
        is_clustered: clusters.length > 0,
        _meta: {
          zoom,
          duration,
          source,
        },
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60, s-maxage=300",
        },
      }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Internal error";
    console.error("[get-clusters] Error:", errorMessage);

    return new Response(
      JSON.stringify({
        error: errorMessage,
        clusters: [],
        properties: [],
        total: 0,
        is_clustered: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
