/**
 * Edge Function: property-search-vNext
 *
 * Unified property search endpoint with consistent totals.
 *
 * KEY GUARANTEE: total === COUNT of properties matching filters
 * - mapData and listItems derive from the SAME filtered dataset
 * - No more divergence between cluster counts and list counts
 *
 * Features:
 * - Uses spatial tree for fast clustering (< 50ms for simple filters)
 * - Falls back to dynamic clustering for advanced filters
 * - Single source of truth for totals
 * - Full filter support: listing_type, property_type, price, bedrooms, etc.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkRateLimit, getClientIP, rateLimitedResponse, RateLimitConfig } from '../_shared/rateLimit.ts';

// Rate limit: 60 requests per minute per IP
const searchRateLimit: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60 * 1000,
  keyPrefix: 'property-search-vNext',
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
  max_bedrooms?: number;
  min_bathrooms?: number;
  min_sqft?: number;
  max_sqft?: number;
}

interface RequestBody {
  bounds: Bounds;
  zoom: number;
  filters?: Filters;
  page?: number;
  limit?: number;
  node_id?: string; // For drilling into specific tree node
}

// Input validation
function validateBounds(bounds: Bounds): { valid: boolean; error?: string } {
  if (!bounds) return { valid: false, error: 'bounds is required' };

  const { north, south, east, west } = bounds;

  if (typeof north !== 'number' || typeof south !== 'number' ||
      typeof east !== 'number' || typeof west !== 'number') {
    return { valid: false, error: 'bounds must have numeric north, south, east, west' };
  }

  if (north < -90 || north > 90 || south < -90 || south > 90) {
    return { valid: false, error: 'latitude must be between -90 and 90' };
  }

  if (east < -180 || east > 180 || west < -180 || west > 180) {
    return { valid: false, error: 'longitude must be between -180 and 180' };
  }

  if (north < south) {
    return { valid: false, error: 'north must be >= south' };
  }

  return { valid: true };
}

function validateZoom(zoom: number): { valid: boolean; error?: string } {
  if (typeof zoom !== 'number') {
    return { valid: false, error: 'zoom must be a number' };
  }

  if (zoom < 0 || zoom > 22) {
    return { valid: false, error: 'zoom must be between 0 and 22' };
  }

  return { valid: true };
}

function sanitizeFilters(filters: Filters = {}): Filters {
  const sanitized: Filters = {};

  // listing_type: must be 'venta' or 'renta'
  if (filters.listing_type && ['venta', 'renta'].includes(filters.listing_type)) {
    sanitized.listing_type = filters.listing_type;
  }

  // property_type: alphanumeric string
  if (filters.property_type && typeof filters.property_type === 'string') {
    sanitized.property_type = filters.property_type.toLowerCase().trim();
  }

  // Numeric filters with reasonable bounds
  if (typeof filters.min_price === 'number' && filters.min_price >= 0) {
    sanitized.min_price = Math.min(filters.min_price, 1e12); // Max 1 trillion
  }

  if (typeof filters.max_price === 'number' && filters.max_price >= 0) {
    sanitized.max_price = Math.min(filters.max_price, 1e12);
  }

  if (typeof filters.min_bedrooms === 'number' && filters.min_bedrooms >= 0) {
    sanitized.min_bedrooms = Math.min(Math.floor(filters.min_bedrooms), 100);
  }

  if (typeof filters.max_bedrooms === 'number' && filters.max_bedrooms >= 0) {
    sanitized.max_bedrooms = Math.min(Math.floor(filters.max_bedrooms), 100);
  }

  if (typeof filters.min_bathrooms === 'number' && filters.min_bathrooms >= 0) {
    sanitized.min_bathrooms = Math.min(filters.min_bathrooms, 100);
  }

  if (typeof filters.min_sqft === 'number' && filters.min_sqft >= 0) {
    sanitized.min_sqft = Math.min(filters.min_sqft, 1e9);
  }

  if (typeof filters.max_sqft === 'number' && filters.max_sqft >= 0) {
    sanitized.max_sqft = Math.min(filters.max_sqft, 1e9);
  }

  return sanitized;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  // Rate limiting
  const clientIP = getClientIP(req);
  const rateLimitResult = checkRateLimit(clientIP, searchRateLimit);
  if (!rateLimitResult.allowed) {
    return rateLimitedResponse(rateLimitResult, corsHeaders);
  }

  try {
    const body: RequestBody = await req.json();
    const { bounds, zoom, filters = {}, page = 1, limit = 20, node_id } = body;

    // Validate bounds
    const boundsValidation = validateBounds(bounds);
    if (!boundsValidation.valid) {
      return new Response(
        JSON.stringify({ error: boundsValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate zoom
    const zoomValidation = validateZoom(zoom);
    if (!zoomValidation.valid) {
      return new Response(
        JSON.stringify({ error: zoomValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize filters
    const sanitizedFilters = sanitizeFilters(filters);

    // Sanitize pagination
    const sanitizedPage = Math.max(1, Math.min(page, 1000));
    const sanitizedLimit = Math.max(1, Math.min(limit, 100));

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Call the unified RPC
    const { data, error } = await supabase.rpc('search_map_and_list', {
      p_bounds_north: bounds.north,
      p_bounds_south: bounds.south,
      p_bounds_east: bounds.east,
      p_bounds_west: bounds.west,
      p_zoom: zoom,
      p_listing_type: sanitizedFilters.listing_type || null,
      p_property_type: sanitizedFilters.property_type || null,
      p_min_price: sanitizedFilters.min_price || null,
      p_max_price: sanitizedFilters.max_price || null,
      p_min_bedrooms: sanitizedFilters.min_bedrooms || null,
      p_max_bedrooms: sanitizedFilters.max_bedrooms || null,
      p_min_bathrooms: sanitizedFilters.min_bathrooms || null,
      p_min_sqft: sanitizedFilters.min_sqft || null,
      p_max_sqft: sanitizedFilters.max_sqft || null,
      p_page: sanitizedPage,
      p_limit: sanitizedLimit,
      p_node_id: node_id || null,
    });

    if (error) {
      console.error('[property-search-vNext] RPC error:', error);
      return new Response(
        JSON.stringify({
          error: 'Search failed',
          details: error.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add Edge Function timing to metadata
    const edgeDuration = Date.now() - startTime;
    const response = {
      ...data,
      _meta: {
        ...data._meta,
        edge_duration_ms: edgeDuration,
        total_duration_ms: (data._meta?.duration_ms || 0) + edgeDuration,
      },
    };

    // Log performance for monitoring
    const logLevel = edgeDuration > 500 ? 'SLOW' : 'OK';
    console.log(`[property-search-vNext] ${logLevel} - ${edgeDuration}ms - total:${data.total} mode:${data.mode}`);

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (err) {
    console.error('[property-search-vNext] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
