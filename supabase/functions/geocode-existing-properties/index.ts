import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function geocodeAddress(
  colonia: string | null,
  municipality: string,
  state: string
): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error('GOOGLE_MAPS_API_KEY not configured');
    return null;
  }

  const locationQuery = [
    colonia,
    municipality,
    state,
    'Mexico'
  ].filter(Boolean).join(', ');

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationQuery)}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }
    return null;
  } catch (error) {
    console.error('[GEOCODE] Error:', error);
    return null;
  }
}

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Obtener propiedades activas sin coordenadas (límite 50 por ejecución para evitar timeout)
    const { data: properties, error: fetchError } = await supabase
      .from('properties')
      .select('id, colonia, municipality, state')
      .eq('status', 'activa')
      .is('lat', null)
      .is('lng', null)
      .limit(50);

    if (fetchError) {
      console.error('[BATCH GEOCODE] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!properties || properties.length === 0) {
      console.log('[BATCH GEOCODE] No properties to geocode');
      return new Response(
        JSON.stringify({ success: true, geocoded: 0, message: 'No properties need geocoding' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BATCH GEOCODE] Processing ${properties.length} properties`);

    let successCount = 0;
    let failCount = 0;

    // Procesar cada propiedad con delay para respetar límites de API
    for (const property of properties) {
      const coords = await geocodeAddress(
        property.colonia,
        property.municipality,
        property.state
      );

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
          console.error(`[BATCH GEOCODE] Update error for ${property.id}:`, updateError);
          failCount++;
        } else {
          successCount++;
          console.log(`[BATCH GEOCODE] ✓ ${property.id}`);
        }
      } else {
        failCount++;
        console.log(`[BATCH GEOCODE] ✗ ${property.id} - geocoding failed`);
      }

      // Delay de 100ms entre requests para respetar rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        geocoded: successCount,
        failed: failCount,
        total: properties.length
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[BATCH GEOCODE] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
