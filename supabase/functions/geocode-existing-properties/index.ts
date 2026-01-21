import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, getClientIP, rateLimitedResponse, apiRateLimit } from "../_shared/rateLimit.ts";

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface GeocodingParams {
  limit?: number;
  batchSize?: number;
  backoffMs?: number;
  maxRetriesPerKey?: number;
  state?: string;
  municipality?: string;
  dryRun?: boolean;
}

interface GeocodingResult {
  success: boolean;
  geocoded: number;
  failed: number;
  cacheHits: number;
  fallbackGeocoded: number;
  retries: number;
  total: number;
  executionMs: number;
  error?: string;
}

function normalizeKey(parts: (string | null)[]): string {
  return parts
    .filter(Boolean)
    .map(p => p!.toLowerCase().trim())
    .join(', ');
}

async function getCachedCoords(
  supabase: ReturnType<typeof createClient>,
  normalizedKey: string
): Promise<{ lat: number; lng: number } | null> {
  const { data, error } = await supabase
    .from('geocoding_cache')
    .select('lat, lng')
    .eq('normalized_key', normalizedKey)
    .single();

  if (error || !data) return null;

  // Actualizar hits y last_used_at
  await supabase
    .from('geocoding_cache')
    .update({
      hits: data.hits ? data.hits + 1 : 1,
      last_used_at: new Date().toISOString(),
    })
    .eq('normalized_key', normalizedKey);

  return { lat: data.lat, lng: data.lng };
}

async function saveToCache(
  supabase: ReturnType<typeof createClient>,
  normalizedKey: string,
  lat: number,
  lng: number
): Promise<void> {
  try {
    await supabase
      .from('geocoding_cache')
      .insert({
        normalized_key: normalizedKey,
        lat,
        lng,
        components: {},
        hits: 1,
      });
  } catch (error) {
    console.error('[CACHE] Error saving to cache:', error);
  }
}

async function geocodeAddress(
  colonia: string | null,
  municipality: string,
  state: string,
  maxRetries: number = 2,
  backoffMs: number = 300
): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error('GOOGLE_MAPS_API_KEY not configured');
    return null;
  }

  // Intento 1: Con colonia si está disponible
  const attempts = [
    [colonia, municipality, state, 'Mexico'].filter(Boolean),
    [municipality, state, 'Mexico'], // Fallback sin colonia
  ];

  for (let attemptIndex = 0; attemptIndex < attempts.length; attemptIndex++) {
    const locationQuery = attempts[attemptIndex].join(', ');
    
    for (let retry = 0; retry <= maxRetries; retry++) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationQuery)}&key=${GOOGLE_MAPS_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const location = data.results[0].geometry.location;
          
          // Agregar variación aleatoria de ±500 metros
          const randomOffsetLat = (Math.random() - 0.5) * 0.01;
          const randomOffsetLng = (Math.random() - 0.5) * 0.01;
          
          return { 
            lat: location.lat + randomOffsetLat, 
            lng: location.lng + randomOffsetLng 
          };
        }

        // Rate limit o error temporal
        if (data.status === 'OVER_QUERY_LIMIT' || response.status === 429) {
          const waitTime = backoffMs * Math.pow(2, retry);
          console.warn(`[GEOCODE] Rate limit hit, waiting ${waitTime}ms before retry ${retry + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // Si es otro error, pasar al siguiente intento (fallback)
        if (data.status !== 'OK') {
          console.warn(`[GEOCODE] Attempt ${attemptIndex + 1} failed with status: ${data.status} for "${locationQuery}"`);
          break;
        }
      } catch (error) {
        console.error('[GEOCODE] Error:', error);
        if (retry === maxRetries) return null;
        await new Promise(resolve => setTimeout(resolve, backoffMs * Math.pow(2, retry)));
      }
    }
  }

  return null;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting for API operations
  const clientIP = getClientIP(req);
  const rateResult = checkRateLimit(clientIP, apiRateLimit);
  if (!rateResult.allowed) {
    return rateLimitedResponse(rateResult, corsHeaders);
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse parámetros del body
    let params: GeocodingParams = {};
    try {
      params = await req.json();
    } catch {
      // Si no hay body, usar defaults
    }

    const limit = params.limit || 1000;
    const batchSize = params.batchSize || 10;
    const backoffMs = params.backoffMs || 300;
    const maxRetriesPerKey = params.maxRetriesPerKey || 2;
    const dryRun = params.dryRun || false;

    console.log(`[BATCH GEOCODE] Starting with params:`, { limit, batchSize, backoffMs, maxRetriesPerKey, dryRun });

    // Query builder
    let query = supabase
      .from('properties')
      .select('id, colonia, municipality, state')
      .is('lat', null)
      .is('lng', null)
      .limit(limit);

    // Aplicar filtros opcionales
    if (params.state) {
      query = query.eq('state', params.state);
    }
    if (params.municipality) {
      query = query.eq('municipality', params.municipality);
    }

    const { data: properties, error: fetchError } = await query;

    if (fetchError) {
      console.error('[BATCH GEOCODE] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!properties || properties.length === 0) {
      console.log('[BATCH GEOCODE] No properties to geocode');
      return new Response(
        JSON.stringify({ 
          success: true, 
          geocoded: 0, 
          failed: 0,
          cacheHits: 0,
          fallbackGeocoded: 0,
          retries: 0,
          total: 0,
          executionMs: Date.now() - startTime,
          message: 'No properties need geocoding' 
        } as GeocodingResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (dryRun) {
      // Modo estimación: solo contar cache hits potenciales
      let potentialCacheHits = 0;
      const uniqueKeys = new Set<string>();

      for (const property of properties) {
        const normalizedKey = normalizeKey([property.colonia, property.municipality, property.state, 'Mexico']);
        
        if (uniqueKeys.has(normalizedKey)) {
          potentialCacheHits++;
          continue;
        }
        
        uniqueKeys.add(normalizedKey);
        const cached = await getCachedCoords(supabase, normalizedKey);
        if (cached) potentialCacheHits++;
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          total: properties.length,
          potentialCacheHits,
          potentialApiCalls: properties.length - potentialCacheHits,
          uniqueLocations: uniqueKeys.size,
          executionMs: Date.now() - startTime,
          dryRun: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BATCH GEOCODE] Processing ${properties.length} properties in parallel batches of ${batchSize}`);

    let successCount = 0;
    let failCount = 0;
    let cacheHits = 0;
    let fallbackGeocoded = 0;
    let totalRetries = 0;

    // Deduplicar en memoria por batch
    const locationMap = new Map<string, { lat: number; lng: number }>();
    const propertyByLocation = new Map<string, Array<{ id: string; colonia: string | null; municipality: string; state: string }>>();

    for (const property of properties) {
      const normalizedKey = normalizeKey([property.colonia, property.municipality, property.state, 'Mexico']);
      
      if (!propertyByLocation.has(normalizedKey)) {
        propertyByLocation.set(normalizedKey, []);
      }
      propertyByLocation.get(normalizedKey)!.push(property);
    }

    console.log(`[BATCH GEOCODE] Deduplicated to ${propertyByLocation.size} unique locations from ${properties.length} properties`);

    // Procesar ubicaciones únicas en lotes
    const uniqueLocations = Array.from(propertyByLocation.entries());
    const batches = [];
    for (let i = 0; i < uniqueLocations.length; i += batchSize) {
      batches.push(uniqueLocations.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async ([normalizedKey, props]) => {
        try {
          // Intentar desde caché primero
          const cached = await getCachedCoords(supabase, normalizedKey);
          if (cached) {
            locationMap.set(normalizedKey, cached);
            cacheHits++;
            console.log(`[CACHE HIT] ${normalizedKey}`);
            return { success: true, fromCache: true };
          }

          // Geocodificar con Google
          const firstProp = props[0];
          const coords = await geocodeAddress(
            firstProp.colonia,
            firstProp.municipality,
            firstProp.state,
            maxRetriesPerKey,
            backoffMs
          );

          if (coords) {
            locationMap.set(normalizedKey, coords);
            
            // Guardar en caché
            await saveToCache(supabase, normalizedKey, coords.lat, coords.lng);
            
            // Determinar si fue fallback (sin colonia)
            if (!firstProp.colonia) {
              fallbackGeocoded++;
            }
            
            console.log(`[GEOCODED] ${normalizedKey}`);
            return { success: true, fromCache: false };
          } else {
            console.log(`[FAILED] ${normalizedKey}`);
            return { success: false };
          }
        } catch (error) {
          console.error(`[ERROR] Processing ${normalizedKey}:`, error);
          totalRetries++;
          return { success: false };
        }
      });

      await Promise.all(batchPromises);

      // Pequeño delay entre lotes
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    // Aplicar coordenadas a todas las propiedades
    for (const property of properties) {
      const normalizedKey = normalizeKey([property.colonia, property.municipality, property.state, 'Mexico']);
      const coords = locationMap.get(normalizedKey);

      if (coords) {
        const { error: updateError } = await supabase
          .from('properties')
          .update({
            lat: coords.lat,
            lng: coords.lng,
            geom: `POINT(${coords.lng} ${coords.lat})`,
          })
          .eq('id', property.id);

        if (updateError) {
          console.error(`[UPDATE ERROR] ${property.id}:`, updateError);
          failCount++;
        } else {
          successCount++;
        }
      } else {
        failCount++;
      }
    }

    const result: GeocodingResult = {
      success: true, 
      geocoded: successCount,
      failed: failCount,
      cacheHits,
      fallbackGeocoded,
      retries: totalRetries,
      total: properties.length,
      executionMs: Date.now() - startTime
    };

    console.log(`[BATCH GEOCODE] Completed:`, result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[BATCH GEOCODE] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: String(error),
        executionMs: Date.now() - startTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
