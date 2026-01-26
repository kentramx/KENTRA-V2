import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { batch_size = 10000, action = 'populate' } = await req.json().catch(() => ({}));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    if (action === 'status') {
      // Check current status
      const { data, error } = await supabase.rpc('check_geohash_status');

      if (error) {
        // Fallback: count manually
        const { count: total } = await supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .not('geom', 'is', null);

        const { count: withGeohash } = await supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .not('geom', 'is', null)
          .not('geohash_4', 'is', null);

        return new Response(
          JSON.stringify({
            total: total || 0,
            with_geohash: withGeohash || 0,
            without_geohash: (total || 0) - (withGeohash || 0),
            progress_pct: total ? Math.round(((withGeohash || 0) / total) * 100) : 0,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'create_indexes') {
      // Create indexes for geohash columns
      const indexQueries = [
        `CREATE INDEX IF NOT EXISTS idx_props_geohash_3_active ON properties(geohash_3) WHERE status = 'activa' AND geohash_3 IS NOT NULL`,
        `CREATE INDEX IF NOT EXISTS idx_props_geohash_4_active ON properties(geohash_4) WHERE status = 'activa' AND geohash_4 IS NOT NULL`,
        `CREATE INDEX IF NOT EXISTS idx_props_geohash_5_active ON properties(geohash_5) WHERE status = 'activa' AND geohash_5 IS NOT NULL`,
        `CREATE INDEX IF NOT EXISTS idx_props_geohash_6_active ON properties(geohash_6) WHERE status = 'activa' AND geohash_6 IS NOT NULL`,
      ];

      const results = [];
      for (const query of indexQueries) {
        const { error } = await supabase.rpc('exec_sql', { sql: query });
        results.push({ query: query.substring(0, 50) + '...', success: !error, error: error?.message });
      }

      // Run ANALYZE
      await supabase.rpc('exec_sql', { sql: 'ANALYZE properties' });

      return new Response(
        JSON.stringify({ action: 'create_indexes', results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default action: populate geohashes
    // Use RPC to run the update in batches
    const { data, error } = await supabase.rpc('populate_geohashes_batch', {
      p_batch_size: batch_size
    });

    if (error) {
      // The RPC might not exist, try to create it first
      if (error.message.includes('does not exist') || error.code === 'PGRST202') {
        return new Response(
          JSON.stringify({
            error: 'RPC function not found',
            message: 'Please create the populate_geohashes_batch function first. See setup instructions.',
            setup_sql: `
CREATE OR REPLACE FUNCTION populate_geohashes_batch(p_batch_size integer DEFAULT 10000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated integer;
  v_remaining integer;
BEGIN
  -- Update batch
  WITH to_update AS (
    SELECT id
    FROM properties
    WHERE geom IS NOT NULL
      AND geohash_4 IS NULL
    LIMIT p_batch_size
  )
  UPDATE properties p
  SET
    geohash_3 = ST_GeoHash(p.geom, 3),
    geohash_4 = ST_GeoHash(p.geom, 4),
    geohash_5 = ST_GeoHash(p.geom, 5),
    geohash_6 = ST_GeoHash(p.geom, 6)
  FROM to_update
  WHERE p.id = to_update.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Count remaining
  SELECT COUNT(*) INTO v_remaining
  FROM properties
  WHERE geom IS NOT NULL AND geohash_4 IS NULL;

  RETURN jsonb_build_object(
    'updated', v_updated,
    'remaining', v_remaining,
    'done', v_remaining = 0
  );
END;
$$;
            `
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        ...data,
        duration_ms: duration,
        message: data.done
          ? 'All geohashes populated!'
          : `Updated ${data.updated} properties. ${data.remaining} remaining.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
