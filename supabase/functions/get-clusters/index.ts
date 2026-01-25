/**
 * Edge Function: get-clusters
 * ENTERPRISE: Sirve clusters pre-computados con fallback a estimated count
 *
 * ESTRATEGIA:
 * 1. Intenta obtener clusters pre-computados de property_clusters
 * 2. Si no hay clusters (backfill pendiente), retorna estimación rápida
 * 3. Nunca hace queries pesadas que puedan timeout
 *
 * SECURITY:
 * - Rate limiting: 60 req/min per IP
 * - Timeout protection: 5s max per RPC call
 * - Input validation: bounds, zoom range
 * - CORS: whitelist-based
 */

import { getCorsHeaders } from "../_shared/cors.ts";
import {
  checkRateLimit,
  rateLimitedResponse,
  addRateLimitHeaders,
  getClientIP,
  publicRateLimit
} from "../_shared/rateLimit.ts";

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

// Mexico approximate bounds for validation
const MEXICO_BOUNDS = { north: 33, south: 14, east: -86, west: -118 };

// Fetch with timeout protection
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Validate bounds and zoom
function validateInput(bounds: RequestBody["bounds"], zoom: number): string | null {
  // Check bounds exist
  if (!bounds || bounds.north == null || bounds.south == null ||
      bounds.east == null || bounds.west == null) {
    return "Invalid bounds: all coordinates required";
  }

  // Check bounds are numbers
  if (!Number.isFinite(bounds.north) || !Number.isFinite(bounds.south) ||
      !Number.isFinite(bounds.east) || !Number.isFinite(bounds.west)) {
    return "Invalid bounds: must be finite numbers";
  }

  // Check bounds orientation
  if (bounds.north <= bounds.south) {
    return "Invalid bounds: north must be greater than south";
  }
  if (bounds.east <= bounds.west) {
    return "Invalid bounds: east must be greater than west";
  }

  // Check zoom range
  if (!Number.isFinite(zoom) || zoom < 0 || zoom > 20) {
    return "Invalid zoom: must be 0-20";
  }

  // Warn if outside Mexico (but don't reject)
  if (bounds.north > MEXICO_BOUNDS.north + 5 || bounds.south < MEXICO_BOUNDS.south - 5 ||
      bounds.east > MEXICO_BOUNDS.east + 5 || bounds.west < MEXICO_BOUNDS.west - 5) {
    console.warn("[get-clusters] Bounds outside expected Mexico range");
  }

  return null;
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
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  const rateLimitResult = checkRateLimit(clientIP, {
    ...publicRateLimit,
    keyPrefix: "get-clusters"
  });

  if (!rateLimitResult.allowed) {
    return rateLimitedResponse(rateLimitResult, corsHeaders);
  }

  const startTime = Date.now();

  try {
    const { bounds, zoom, filters = {} }: RequestBody = await req.json();

    // Input validation
    const validationError = validateInput(bounds, zoom);
    if (validationError) {
      return new Response(
        JSON.stringify({ error: validationError, clusters: [], properties: [], total: 0 }),
        {
          status: 400,
          headers: addRateLimitHeaders(
            { ...corsHeaders, "Content-Type": "application/json" },
            rateLimitResult,
            publicRateLimit
          )
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // STEP 1: Try to get pre-computed clusters (with timeout)
    const rpcResponse = await fetchWithTimeout(
      `${supabaseUrl}/rest/v1/rpc/get_clusters_in_viewport`,
      {
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
      },
      5000 // 5 second timeout
    );

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

      // Get estimated count from materialized view (O(1) query) with timeout
      try {
        const countResponse = await fetchWithTimeout(
          `${supabaseUrl}/rest/v1/mv_property_counts_by_status?status=eq.activa&select=count`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          },
          3000 // 3 second timeout for count
        );

        if (countResponse.ok) {
          const countData = await countResponse.json();
          if (countData && countData.length > 0) {
            totalCount = Number(countData[0].count) || 0;
          }
        }
      } catch (countError) {
        console.warn("[get-clusters] Count fetch failed, using 0:", countError);
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
        headers: addRateLimitHeaders(
          {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=60, s-maxage=300",
          },
          rateLimitResult,
          publicRateLimit
        ),
      }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Internal error";
    const isTimeout = errorMessage.includes('aborted') || errorMessage.includes('timeout');

    console.error("[get-clusters] Error:", errorMessage);

    return new Response(
      JSON.stringify({
        error: isTimeout ? "Request timeout - try zooming in" : "Server error",
        clusters: [],
        properties: [],
        total: 0,
        is_clustered: false,
      }),
      {
        status: isTimeout ? 504 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
