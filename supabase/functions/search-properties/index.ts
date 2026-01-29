import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from '../_shared/cors.ts';

interface SearchRequest {
  query?: string;
  filters?: {
    listing_type?: 'venta' | 'renta';
    property_type?: string;
    min_price?: number;
    max_price?: number;
    min_bedrooms?: number;
    city?: string;
    state?: string;
  };
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  sort?: string;
  page?: number;
  limit?: number;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const body: SearchRequest = await req.json();
    const {
      query = '',
      filters = {},
      bounds,
      sort = 'created_at',
      page = 1,
      limit = 20,
    } = body;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Construir query
    let dbQuery = supabase
      .from('properties')
      .select(`
        id,
        title,
        price,
        listing_type,
        type,
        bedrooms,
        bathrooms,
        sqft,
        lot_size,
        address,
        colonia,
        municipality,
        state,
        lat,
        lng,
        created_at
      `, { count: 'exact' })
      .eq('status', 'activa');

    // Aplicar filtros
    if (filters.listing_type) {
      dbQuery = dbQuery.eq('listing_type', filters.listing_type);
    }
    if (filters.property_type) {
      dbQuery = dbQuery.eq('type', filters.property_type);
    }
    if (filters.min_price) {
      dbQuery = dbQuery.gte('price', filters.min_price);
    }
    if (filters.max_price) {
      dbQuery = dbQuery.lte('price', filters.max_price);
    }
    if (filters.min_bedrooms) {
      dbQuery = dbQuery.gte('bedrooms', filters.min_bedrooms);
    }
    if (filters.city) {
      dbQuery = dbQuery.eq('municipality', filters.city);
    }

    // Filtro por bounds (viewport del mapa)
    if (bounds) {
      dbQuery = dbQuery
        .gte('lat', bounds.south)
        .lte('lat', bounds.north)
        .gte('lng', bounds.west)
        .lte('lng', bounds.east);
    }

    // Búsqueda por texto
    if (query) {
      dbQuery = dbQuery.or(`title.ilike.%${query}%,address.ilike.%${query}%,neighborhood.ilike.%${query}%,city.ilike.%${query}%`);
    }

    // Ordenamiento
    const sortColumn = sort.replace('-', '');
    const sortAsc = !sort.startsWith('-');
    dbQuery = dbQuery.order(sortColumn, { ascending: sortAsc });

    // Paginación
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    dbQuery = dbQuery.range(from, to);

    const { data, error, count } = await dbQuery;

    if (error) {
      throw error;
    }

    // Transform columns for frontend consistency
    const properties = (data || []).map((p: any) => ({
      ...p,
      property_type: p.type,
      neighborhood: p.colonia,
      city: p.municipality,
      construction_m2: p.sqft,
      land_m2: p.lot_size,
    }));

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        properties,
        total: count || 0,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit),
        _meta: {
          request_id: requestId,
          duration_ms: duration,
          timestamp: new Date().toISOString(),
        }
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (err) {
    console.error('Search error:', err);
    return new Response(
      JSON.stringify({
        error: 'Search error',
        properties: [],
        total: 0,
        page: 1,
        pages: 0,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
