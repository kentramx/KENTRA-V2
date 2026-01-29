/**
 * Edge Function: populate-geohash-7-8
 * Populates geohash_7 and geohash_8 columns for existing properties
 * and refreshes materialized views
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: string[] = [];

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Step 1: Run batch updates until complete
    let totalUpdated = 0;
    let batchNum = 0;
    const maxBatches = 500; // ~250k rows max per invocation (500 rows * 500 batches)
    const batchSize = 500; // Small batches to avoid timeout

    results.push('Starting geohash population...');

    while (batchNum < maxBatches) {
      batchNum++;

      const { data, error } = await supabase.rpc('populate_geohash_batch', {
        batch_size: batchSize
      });

      if (error) {
        results.push(`Batch ${batchNum} error: ${error.message}`);
        break;
      }

      const rowsUpdated = data?.[0]?.rows_updated || 0;
      totalUpdated += rowsUpdated;

      // Log every 10 batches to reduce noise
      if (batchNum % 10 === 0 || rowsUpdated < batchSize) {
        results.push(`Batch ${batchNum}: Updated ${rowsUpdated} rows (total: ${totalUpdated})`);
      }

      // If we updated fewer than batch_size, we're done
      if (rowsUpdated < batchSize) {
        results.push(`Completed - no more rows to update`);
        break;
      }

      // Small delay between batches to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    results.push(`Total rows updated: ${totalUpdated}`);

    // Step 2: Refresh materialized views
    results.push('Refreshing materialized views...');

    const views = [
      'mv_geohash_clusters_7',
      'mv_geohash_clusters_7_all'
    ];

    for (const view of views) {
      try {
        const { error } = await supabase.rpc('refresh_mv', { view_name: view });
        if (error) {
          results.push(`  ${view}: Error - ${error.message}`);
        } else {
          results.push(`  ${view}: Refreshed OK`);
        }
      } catch (e: any) {
        results.push(`  ${view}: Exception - ${e.message}`);
      }
    }

    const duration = Date.now() - startTime;
    results.push(`Completed in ${(duration / 1000).toFixed(1)}s`);

    return new Response(
      JSON.stringify({
        success: true,
        total_updated: totalUpdated,
        batches: batchNum,
        results,
        duration_ms: duration
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    results.push(`Fatal error: ${errorMessage}`);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        results,
        duration_ms: Date.now() - startTime
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
