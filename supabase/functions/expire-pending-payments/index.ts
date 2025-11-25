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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔍 Buscando pagos pendientes expirados...');

    // Expirar pending_payments con más de 48 horas
    const expirationThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const { data: expiredPayments, error: paymentsError } = await supabaseClient
      .from('pending_payments')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('created_at', expirationThreshold.toISOString())
      .select();

    if (paymentsError) {
      console.error('Error updating pending_payments:', paymentsError);
    } else {
      console.log(`✅ Expirados ${expiredPayments?.length || 0} pagos pendientes`);
    }

    // Expirar suscripciones incomplete con más de 48 horas
    const { data: expiredSubs, error: subsError } = await supabaseClient
      .from('user_subscriptions')
      .update({ status: 'expired' })
      .eq('status', 'incomplete')
      .lt('created_at', expirationThreshold.toISOString())
      .select();

    if (subsError) {
      console.error('Error updating subscriptions:', subsError);
    } else {
      console.log(`✅ Expiradas ${expiredSubs?.length || 0} suscripciones pendientes`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        expired_payments: expiredPayments?.length || 0,
        expired_subscriptions: expiredSubs?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in expire-pending-payments:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to expire pending payments',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
