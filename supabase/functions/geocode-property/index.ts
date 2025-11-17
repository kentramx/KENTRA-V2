import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeRequest {
  propertyId: string;
  address?: string;
  colonia?: string;
  municipality: string;
  state: string;
}

async function geocodeAddress(
  address: string,
  colonia: string | undefined,
  municipality: string,
  state: string
): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error('GOOGLE_MAPS_API_KEY not configured');
    return null;
  }

  // Construir query de geocodificación: "Colonia, Municipio, Estado, Mexico"
  const locationQuery = [
    colonia,
    municipality,
    state,
    'Mexico'
  ].filter(Boolean).join(', ');

  console.log('[GEOCODE] Query:', locationQuery);

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationQuery)}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      console.log('[GEOCODE] Success:', { lat: location.lat, lng: location.lng });
      
      return {
        lat: location.lat,
        lng: location.lng,
      };
    } else {
      console.error('[GEOCODE] Failed:', data.status, data.error_message);
      return null;
    }
  } catch (error) {
    console.error('[GEOCODE] Error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { propertyId, address, colonia, municipality, state } = await req.json() as GeocodeRequest;

    if (!propertyId || !municipality || !state) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'propertyId, municipality, and state are required' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Geocodificar
    const coords = await geocodeAddress(address || '', colonia, municipality, state);

    if (!coords) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Geocoding failed. Unable to find coordinates for this location.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Actualizar property con coordenadas
    const { error: updateError } = await supabase
      .from('properties')
      .update({
        lat: coords.lat,
        lng: coords.lng,
        geom: `POINT(${coords.lng} ${coords.lat})`,
      })
      .eq('id', propertyId);

    if (updateError) {
      console.error('[GEOCODE] Update error:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        lat: coords.lat, 
        lng: coords.lng 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[GEOCODE] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
