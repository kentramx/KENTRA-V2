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
      
      // Agregar variación aleatoria de ±500 metros para distribuir propiedades de la misma colonia
      // 0.005 grados ≈ 500 metros
      const randomOffsetLat = (Math.random() - 0.5) * 0.01; // ±0.005 grados
      const randomOffsetLng = (Math.random() - 0.5) * 0.01;
      
      return { 
        lat: location.lat + randomOffsetLat, 
        lng: location.lng + randomOffsetLng 
      };
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

    // Obtener propiedades activas sin coordenadas (límite 1000 por ejecución - ~15-20 segundos con lotes paralelos)
    const { data: properties, error: fetchError } = await supabase
      .from('properties')
      .select('id, colonia, municipality, state')
      .is('lat', null)
      .is('lng', null)
      .limit(1000);

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

    console.log(`[BATCH GEOCODE] Processing ${properties.length} properties in parallel batches`);

    let successCount = 0;
    let failCount = 0;

    // Procesar en lotes de 10 propiedades en paralelo
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < properties.length; i += BATCH_SIZE) {
      batches.push(properties.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (property) => {
        try {
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
              return { success: false, id: property.id };
            } else {
              console.log(`[BATCH GEOCODE] ✓ ${property.id}`);
              return { success: true, id: property.id };
            }
          } else {
            console.log(`[BATCH GEOCODE] ✗ ${property.id} - geocoding failed`);
            return { success: false, id: property.id };
          }
        } catch (error) {
          console.error(`[BATCH GEOCODE] Error processing ${property.id}:`, error);
          return { success: false, id: property.id };
        }
      });

      const results = await Promise.all(batchPromises);
      successCount += results.filter(r => r.success).length;
      failCount += results.filter(r => !r.success).length;

      // Pequeño delay entre lotes para no saturar la API
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
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
