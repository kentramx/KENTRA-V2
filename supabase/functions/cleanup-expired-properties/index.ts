import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 100; // Process 100 properties at a time

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticación
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verificar que el usuario autenticado es admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que tiene permisos de admin
    const { data: isAdmin, error: adminCheckError } = await supabaseAdmin.rpc('has_admin_access', {
      _user_id: user.id
    });

    if (adminCheckError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting cleanup of expired properties...');

    let totalPaused = 0;
    let hasMore = true;
    let offset = 0;

    // Process in batches to avoid OOM with 1M+ properties
    while (hasMore) {
      console.log(`Processing batch starting at offset ${offset}...`);

      // Fetch batch of expired properties with 3-day grace period
      // Only pause properties where expires_at < NOW() - 3 days
      const gracePeriodDate = new Date();
      gracePeriodDate.setDate(gracePeriodDate.getDate() - 3);
      
      const { data: expiredProperties, error: fetchError } = await supabaseAdmin
        .from('properties')
        .select('id, agent_id, title, last_renewed_at, created_at')
        .eq('status', 'activa')
        .lt('expires_at', gracePeriodDate.toISOString())
        .order('expires_at', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);

      if (fetchError) {
        console.error('Error fetching expired properties:', fetchError);
        throw fetchError;
      }

      if (!expiredProperties || expiredProperties.length === 0) {
        console.log('No more expired properties found');
        hasMore = false;
        break;
      }

      console.log(`Found ${expiredProperties.length} expired properties in this batch`);

      // Process batch
      const propertyIds = expiredProperties.map(p => p.id);
      
      // Bulk insert logs
      const logsToInsert = expiredProperties.map(property => ({
        property_id: property.id,
        agent_id: property.agent_id,
        property_title: property.title,
        last_renewed_at: property.last_renewed_at,
        property_created_at: property.created_at,
      }));

      const { error: logError } = await supabaseAdmin
        .from('property_expiration_log')
        .insert(logsToInsert);

      if (logError) {
        console.error('Error bulk logging properties:', logError);
      }

      // Bulk update to pause
      const { error: pauseError } = await supabaseAdmin
        .from('properties')
        .update({ 
          status: 'pausada',
        })
        .in('id', propertyIds);

      if (pauseError) {
        console.error('Error bulk pausing properties:', pauseError);
      } else {
        totalPaused += expiredProperties.length;
        console.log(`✓ Paused ${expiredProperties.length} properties in this batch`);
      }

      // If we got less than BATCH_SIZE, we're done
      if (expiredProperties.length < BATCH_SIZE) {
        hasMore = false;
      } else {
        offset += BATCH_SIZE;
      }

      // Small delay between batches to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Cleanup completed. Total paused: ${totalPaused} properties.`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Cleanup completed successfully',
        pausedCount: totalPaused
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error in cleanup-expired-properties:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
