/**
 * Edge Function: property-search
 * Búsqueda paginada de propiedades para la lista
 *
 * Usa RPC search_properties con PostGIS para paginación real
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

interface RequestBody {
  filters?: {
    listing_type?: string;
    property_type?: string;
    min_price?: number;
    max_price?: number;
    min_bedrooms?: number;
    state?: string;
    municipality?: string;
  };
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  sort?: "newest" | "oldest" | "price_asc" | "price_desc";
  page?: number;
  limit?: number;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const {
      filters = {},
      bounds,
      sort = "newest",
      page = 1,
      limit = 20,
    }: RequestBody = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const offset = (page - 1) * limit;

    // Usar RPC de PostGIS con paginación
    const { data, error } = await supabase.rpc("search_properties", {
      p_status: "activa",
      p_listing_type: filters.listing_type || null,
      p_property_type: filters.property_type || null,
      p_min_price: filters.min_price || null,
      p_max_price: filters.max_price || null,
      p_min_bedrooms: filters.min_bedrooms || null,
      p_state: filters.state || null,
      p_municipality: filters.municipality || null,
      p_bounds_north: bounds?.north || null,
      p_bounds_south: bounds?.south || null,
      p_bounds_east: bounds?.east || null,
      p_bounds_west: bounds?.west || null,
      p_sort: sort,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error("[property-search] RPC error:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    const result = data?.[0] || { properties: [], total_count: 0 };
    const properties = result.properties || [];
    const total = result.total_count || 0;
    const totalPages = Math.ceil(total / limit);

    const duration = Date.now() - startTime;
    console.log(`[property-search] ${properties.length} properties, page ${page}/${totalPages}, ${duration}ms`);

    return new Response(
      JSON.stringify({
        properties,
        total,
        page,
        totalPages,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          // Cache for 60 seconds to reduce database load
          "Cache-Control": "public, max-age=60, s-maxage=60",
          // Add Vary header for proper CDN caching
          "Vary": "Accept, Accept-Encoding",
        },
      }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Internal error";
    console.error("[property-search] Error:", errorMessage);

    return new Response(
      JSON.stringify({
        error: errorMessage,
        properties: [],
        total: 0,
        page: 1,
        totalPages: 0,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
