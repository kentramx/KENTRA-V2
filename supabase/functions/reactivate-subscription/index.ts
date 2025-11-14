import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
// @deno-types="https://esm.sh/stripe@11.16.0/types/index.d.ts"
import Stripe from 'https://esm.sh/stripe@11.16.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Reactivation endpoint called - feature disabled');

    return new Response(
      JSON.stringify({
        success: false,
        error: 'La reactivación no está disponible. Por favor contrata un nuevo plan.',
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in reactivate-subscription:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'La reactivación no está disponible. Por favor contrata un nuevo plan.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
