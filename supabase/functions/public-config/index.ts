import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkRateLimit, getClientIP, rateLimitedResponse, publicRateLimit } from '../_shared/rateLimit.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  const rateResult = checkRateLimit(clientIP, publicRateLimit);
  if (!rateResult.allowed) {
    return rateLimitedResponse(rateResult, headers);
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' },
        },
      }
    );

    // Optional: check user session
    const { data: { user } } = await supabaseClient.auth.getUser();

    const googleMapsApiKey = Deno.env.get('VITE_GOOGLE_MAPS_API_KEY') || '';

    if (!googleMapsApiKey) {
      return new Response(
        JSON.stringify({ error: 'GOOGLE_MAPS_API_KEY_NOT_CONFIGURED' }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        googleMapsApiKey,
        authenticated: !!user,
      }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('public-config error', e);
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
});
