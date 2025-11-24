import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Public endpoint - no authentication required
    const googleMapsApiKey = Deno.env.get('VITE_GOOGLE_MAPS_API_KEY') || '';
    const mapboxAccessToken = Deno.env.get('VITE_MAPBOX_ACCESS_TOKEN') || '';

    console.log('[public-config] Tokens disponibles:', {
      hasGoogleMaps: !!googleMapsApiKey,
      hasMapbox: !!mapboxAccessToken,
      mapboxLength: mapboxAccessToken.length,
    });

    if (!googleMapsApiKey) {
      return new Response(
        JSON.stringify({ error: 'GOOGLE_MAPS_API_KEY_NOT_CONFIGURED' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        // Public, safe to expose to clients (estos son tokens públicos)
        googleMapsApiKey,
        mapboxAccessToken,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('public-config error', e);
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
