/**
 * Edge Function: reconcile-stripe-subscriptions
 *
 * CRITICAL P0: Daily reconciliation between Stripe and DB
 *
 * Compares all active subscriptions in DB vs Stripe and:
 * 1. Detects status mismatches
 * 2. Detects period date mismatches
 * 3. Detects missing stripe_customer_id
 * 4. Detects orphaned subscriptions (in DB but not in Stripe)
 * 5. Alerts admin on discrepancies
 *
 * Run daily at off-peak hours (e.g., 5 AM)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
import Stripe from 'https://esm.sh/stripe@11.16.0?target=deno';
import { getCorsHeaders } from '../_shared/cors.ts';

interface Discrepancy {
  type: 'status_mismatch' | 'date_mismatch' | 'missing_customer_id' | 'orphaned' | 'price_mismatch';
  user_id: string;
  subscription_id: string;
  db_value: string;
  stripe_value: string;
  severity: 'critical' | 'warning' | 'info';
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const discrepancies: Discrepancy[] = [];
  let processedCount = 0;
  let errorCount = 0;

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Get all active/past_due/trialing subscriptions from DB
    const { data: dbSubscriptions, error: dbError } = await supabaseClient
      .from('user_subscriptions')
      .select('*, subscription_plans(*)')
      .in('status', ['active', 'past_due', 'trialing', 'suspended']);

    if (dbError) throw dbError;

    console.log(`[Reconciliation] Checking ${dbSubscriptions?.length || 0} subscriptions`);

    for (const dbSub of dbSubscriptions || []) {
      processedCount++;

      try {
        // Skip if no Stripe subscription (trial users)
        if (!dbSub.stripe_subscription_id) {
          if (dbSub.status !== 'trialing') {
            discrepancies.push({
              type: 'missing_customer_id',
              user_id: dbSub.user_id,
              subscription_id: dbSub.id,
              db_value: `status: ${dbSub.status}, no stripe_subscription_id`,
              stripe_value: 'N/A',
              severity: 'warning',
            });
          }
          continue;
        }

        // Fetch subscription from Stripe
        let stripeSub: Stripe.Subscription;
        try {
          stripeSub = await stripe.subscriptions.retrieve(dbSub.stripe_subscription_id);
        } catch (stripeError: unknown) {
          const err = stripeError as { code?: string };
          if (err.code === 'resource_missing') {
            discrepancies.push({
              type: 'orphaned',
              user_id: dbSub.user_id,
              subscription_id: dbSub.id,
              db_value: `DB has subscription ${dbSub.stripe_subscription_id}`,
              stripe_value: 'Subscription does not exist in Stripe',
              severity: 'critical',
            });
            continue;
          }
          throw stripeError;
        }

        // 1. Check status mismatch
        const stripeStatus = stripeSub.status;
        const expectedDbStatus = mapStripeStatus(stripeStatus);

        if (dbSub.status !== expectedDbStatus && dbSub.status !== 'suspended') {
          discrepancies.push({
            type: 'status_mismatch',
            user_id: dbSub.user_id,
            subscription_id: dbSub.id,
            db_value: dbSub.status,
            stripe_value: stripeStatus,
            severity: 'critical',
          });
        }

        // 2. Check period end date mismatch (more than 1 day difference)
        const dbPeriodEnd = new Date(dbSub.current_period_end).getTime();
        const stripePeriodEnd = stripeSub.current_period_end * 1000;
        const dateDiffHours = Math.abs(dbPeriodEnd - stripePeriodEnd) / (1000 * 60 * 60);

        if (dateDiffHours > 24) {
          discrepancies.push({
            type: 'date_mismatch',
            user_id: dbSub.user_id,
            subscription_id: dbSub.id,
            db_value: new Date(dbPeriodEnd).toISOString(),
            stripe_value: new Date(stripePeriodEnd).toISOString(),
            severity: 'warning',
          });
        }

        // 3. Check missing stripe_customer_id
        if (!dbSub.stripe_customer_id && stripeSub.customer) {
          discrepancies.push({
            type: 'missing_customer_id',
            user_id: dbSub.user_id,
            subscription_id: dbSub.id,
            db_value: 'NULL',
            stripe_value: stripeSub.customer as string,
            severity: 'warning',
          });

          // Auto-fix: Update the missing customer_id
          await supabaseClient
            .from('user_subscriptions')
            .update({ stripe_customer_id: stripeSub.customer })
            .eq('id', dbSub.id);

          console.log(`[Reconciliation] Auto-fixed missing stripe_customer_id for ${dbSub.user_id}`);
        }

        // 4. Check price_id mismatch
        const stripePrice = stripeSub.items.data[0]?.price?.id;
        const expectedPriceId = dbSub.billing_cycle === 'yearly'
          ? dbSub.subscription_plans?.stripe_price_id_yearly
          : dbSub.subscription_plans?.stripe_price_id_monthly;

        if (stripePrice && expectedPriceId && stripePrice !== expectedPriceId) {
          discrepancies.push({
            type: 'price_mismatch',
            user_id: dbSub.user_id,
            subscription_id: dbSub.id,
            db_value: `plan: ${dbSub.subscription_plans?.name}, price: ${expectedPriceId}`,
            stripe_value: `stripe price: ${stripePrice}`,
            severity: 'critical',
          });
        }

      } catch (subError) {
        errorCount++;
        console.error(`[Reconciliation] Error processing subscription ${dbSub.id}:`, subError);
      }
    }

    // Log and store results
    const summary = {
      processed: processedCount,
      discrepancies: discrepancies.length,
      errors: errorCount,
      critical: discrepancies.filter(d => d.severity === 'critical').length,
      warnings: discrepancies.filter(d => d.severity === 'warning').length,
      duration_ms: Date.now() - startTime,
    };

    console.log('[Reconciliation] Summary:', summary);

    // Store reconciliation results
    await supabaseClient
      .from('admin_audit_log')
      .insert({
        action: 'subscription_reconciliation',
        details: {
          summary,
          discrepancies: discrepancies.slice(0, 50), // Limit to 50 for storage
          run_at: new Date().toISOString(),
        },
      });

    // Alert admin if critical discrepancies found
    if (summary.critical > 0) {
      console.error('🚨 CRITICAL: Found subscription discrepancies that need attention!');

      // Send alert notification
      await supabaseClient.functions.invoke('send-admin-alerts', {
        body: {
          type: 'subscription_reconciliation',
          severity: 'critical',
          message: `Found ${summary.critical} critical subscription discrepancies`,
          details: {
            summary,
            criticalIssues: discrepancies.filter(d => d.severity === 'critical'),
          },
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        discrepancies,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Reconciliation] Fatal error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function mapStripeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'unpaid':
      return 'suspended';
    case 'incomplete':
    case 'incomplete_expired':
      return 'incomplete';
    default:
      return stripeStatus;
  }
}
