import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';
// @deno-types="https://esm.sh/stripe@11.16.0/types/index.d.ts"
import Stripe from 'https://esm.sh/stripe@11.16.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    // Verify user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { newPlanId, billingCycle, previewOnly, bypassCooldown } = await req.json();

    // Validate input
    if (!newPlanId || typeof newPlanId !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid plan ID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!billingCycle || !['monthly', 'yearly'].includes(billingCycle)) {
      return new Response(JSON.stringify({ error: 'Invalid billing cycle' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin (can bypass cooldown)
    const { data: userRole, error: roleError } = await supabaseClient
      .rpc('get_user_role', { _user_id: user.id });

    const isAdmin = userRole === 'admin';

    console.log('Changing subscription plan:', {
      userId: user.id,
      newPlanId,
      billingCycle,
      previewOnly: previewOnly || false,
      isAdmin,
      bypassCooldown: bypassCooldown || false,
    });

    // Check cooldown period (30 days) - only for actual changes, not previews
    // Admins can bypass cooldown restriction
    if (!previewOnly && !isAdmin && !bypassCooldown) {
      const { data: recentChanges, error: changesError } = await supabaseClient
        .from('subscription_changes')
        .select('changed_at')
        .eq('user_id', user.id)
        .order('changed_at', { ascending: false })
        .limit(1);

      if (changesError) {
        console.error('Error checking recent changes:', changesError);
      }

      if (recentChanges && recentChanges.length > 0) {
        const lastChangeDate = new Date(recentChanges[0].changed_at);
        const daysSinceLastChange = Math.floor(
          (Date.now() - lastChangeDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const cooldownDays = 30;

        if (daysSinceLastChange < cooldownDays) {
          const daysRemaining = cooldownDays - daysSinceLastChange;
          const nextChangeDate = new Date(lastChangeDate);
          nextChangeDate.setDate(nextChangeDate.getDate() + cooldownDays);

          console.log('Cooldown period active:', {
            daysSinceLastChange,
            daysRemaining,
            nextChangeDate,
          });

          // Return 200 with success: false for business rule errors
          return new Response(
            JSON.stringify({
              success: false,
              error: 'COOLDOWN_ACTIVE',
              message: `Debes esperar ${daysRemaining} día${daysRemaining > 1 ? 's' : ''} antes de cambiar de plan nuevamente`,
              daysRemaining,
              nextChangeDate: nextChangeDate.toISOString(),
              lastChangeDate: lastChangeDate.toISOString(),
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }
    } else if (isAdmin && !previewOnly) {
      console.log('Admin bypassing cooldown restriction');
    }

    // Get current subscription
    const { data: currentSub, error: subError } = await supabaseClient
      .from('user_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (subError || !currentSub) {
      console.error('Subscription error:', subError);
      return new Response(JSON.stringify({ error: 'No active subscription found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get new plan details
    const { data: newPlan, error: planError } = await supabaseClient
      .from('subscription_plans')
      .select('*')
      .eq('id', newPlanId)
      .single();

    if (planError || !newPlan) {
      console.error('Plan error:', planError);
      return new Response(JSON.stringify({ error: 'Plan not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate downgrade limits - check if user will exceed property limits
    const currentPlan = currentSub.subscription_plans;
    const currentPrice = currentSub.billing_cycle === 'yearly'
      ? Number(currentPlan.price_yearly)
      : Number(currentPlan.price_monthly);
    
    const newPrice = billingCycle === 'yearly'
      ? Number(newPlan.price_yearly)
      : Number(newPlan.price_monthly);

    const isDowngrade = newPrice < currentPrice;

    if (isDowngrade && !previewOnly) {
      // Check active properties count
      const { count: activePropertiesCount, error: countError } = await supabaseClient
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', user.id)
        .eq('status', 'activa');

      const newPlanLimit = newPlan.features?.max_properties || 0;

      if (countError) {
        console.error('Error counting properties:', countError);
      } else if (activePropertiesCount && activePropertiesCount > newPlanLimit) {
        const excess = activePropertiesCount - newPlanLimit;
        // Return 200 with success: false for business rule errors
        return new Response(
          JSON.stringify({
            success: false,
            error: 'EXCEEDS_PROPERTY_LIMIT',
            message: `Tienes ${activePropertiesCount} propiedades activas, pero el plan ${newPlan.display_name} solo permite ${newPlanLimit}. Debes pausar o eliminar ${excess} ${excess === 1 ? 'propiedad' : 'propiedades'} antes de hacer el downgrade.`,
            currentCount: activePropertiesCount,
            newLimit: newPlanLimit,
            excess,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Determine new price ID
    const newPriceId = billingCycle === 'yearly' 
      ? newPlan.stripe_price_id_yearly 
      : newPlan.stripe_price_id_monthly;

    if (!newPriceId) {
      return new Response(
        JSON.stringify({ error: 'Price configuration missing for this billing cycle' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      currentSub.stripe_subscription_id
    );

    console.log('🔍 Retrieved subscription with status:', stripeSubscription.status);

    // 🚨 CRITICAL: Validate subscription status IMMEDIATELY
    // Cannot change plans for canceled or expired subscriptions
    if (stripeSubscription.status === 'canceled' || stripeSubscription.status === 'incomplete_expired') {
      console.error('❌ BLOCKING: Cannot change plan for canceled subscription:', {
        status: stripeSubscription.status,
        subscriptionId: stripeSubscription.id,
        userId: user.id,
      });
      
      // 🔄 SYNC: Update database to match Stripe status
      console.log('🔄 Syncing database status to match Stripe...');
      const { error: updateError } = await supabaseClient
        .from('user_subscriptions')
        .update({
          status: 'canceled',
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('stripe_subscription_id', currentSub.stripe_subscription_id);

      if (updateError) {
        console.error('Error syncing subscription status:', updateError);
      } else {
        console.log('✅ Database status synchronized with Stripe');
      }
      
      // Return 200 with success: false to avoid RUNTIME_ERROR in Lovable
      // This is a business rule error, not a technical failure
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'SUBSCRIPTION_CANCELED',
          message: 'Tu suscripción ha finalizado. Por favor contrata un nuevo plan para continuar.',
          status: stripeSubscription.status,
          details: 'No se pueden cambiar planes de suscripciones canceladas o expiradas.'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Subscription status valid, proceeding with plan change');

    // 🔍 Check if subscription has pending cancellation
    if (stripeSubscription.cancel_at_period_end) {
      console.log('⚠️ Subscription has pending cancellation, validating upgrade...');
      
      // Calculate current and new prices for comparison
      const currentPrice = currentSub.billing_cycle === 'yearly' 
        ? Number(currentPlan.price_yearly) 
        : Number(currentPlan.price_monthly);
      
      const newPrice = billingCycle === 'yearly'
        ? Number(newPlan.price_yearly)
        : Number(newPlan.price_monthly);
      
      const isUpgrade = newPrice > currentPrice;
      
      // 🚫 BLOCK downgrades or cycle changes when cancel_at_period_end = true
      if (!isUpgrade) {
        console.error('❌ BLOCKING: Cannot downgrade or change cycle with pending cancellation');
        return new Response(
          JSON.stringify({
            success: false,
            error: 'DOWNGRADE_WITH_CANCELLATION',
            message: 'No puedes hacer downgrade con una cancelación programada. Solo puedes hacer upgrade para reactivar tu suscripción.',
            details: 'Espera a que finalice tu suscripción actual para contratar un plan inferior.'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('✅ Upgrade detected with pending cancellation - will reactivate subscription');
    }

    // 🔍 DIAGNOSIS - Current Subscription State
    console.log('🔍 DIAGNOSIS - Current Subscription State:', {
      subscriptionId: stripeSubscription.id,
      status: stripeSubscription.status,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      currentPriceId: stripeSubscription.items.data[0].price.id,
      currentAmount: stripeSubscription.items.data[0].price.unit_amount / 100,
      currentInterval: stripeSubscription.items.data[0].price.recurring?.interval,
      billingCycleAnchor: stripeSubscription.billing_cycle_anchor,
    });

    // Warn if subscription is in problematic state
    if (stripeSubscription.status === 'incomplete' || stripeSubscription.status === 'unpaid') {
      console.warn('Subscription in problematic state:', {
        status: stripeSubscription.status,
        subscriptionId: stripeSubscription.id,
      });
    }

    // If preview only, calculate proration without applying changes
    if (previewOnly) {
      // ⏰ DIAGNOSIS - Time Calculations
      const now = Date.now();
      const periodEnd = stripeSubscription.current_period_end * 1000;
      const periodStart = stripeSubscription.current_period_start * 1000;
      const totalDays = Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24));
      const daysElapsed = totalDays - daysRemaining;

      console.log('⏰ DIAGNOSIS - Time Calculations:', {
        now: new Date(now).toISOString(),
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(periodEnd).toISOString(),
        totalDays,
        daysElapsed,
        daysRemaining,
        percentageUsed: ((daysElapsed / totalDays) * 100).toFixed(2) + '%',
        percentageRemaining: ((daysRemaining / totalDays) * 100).toFixed(2) + '%',
      });

      const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
        customer: currentSub.stripe_customer_id,
        subscription: currentSub.stripe_subscription_id,
        subscription_items: [{
          id: stripeSubscription.items.data[0].id,
          price: newPriceId,
        }],
        subscription_proration_behavior: 'create_prorations',
      });

      // 💰 DIAGNOSIS - Stripe Proration Calculation
      console.log('💰 DIAGNOSIS - Stripe Proration Calculation:', {
        upcomingInvoiceId: upcomingInvoice.id,
        amountDue: upcomingInvoice.amount_due / 100,
        currency: upcomingInvoice.currency,
        subtotal: upcomingInvoice.subtotal / 100,
        total: upcomingInvoice.total / 100,
        periodStart: new Date(upcomingInvoice.period_start * 1000).toISOString(),
        periodEnd: new Date(upcomingInvoice.period_end * 1000).toISOString(),
        lines: upcomingInvoice.lines.data.map((line: any) => ({
          description: line.description,
          amount: line.amount / 100,
          proration: line.proration,
          period: {
            start: new Date(line.period.start * 1000).toISOString(),
            end: new Date(line.period.end * 1000).toISOString(),
          }
        })),
      });

      // Calculate current plan price for comparison
      const currentPlan = currentSub.subscription_plans;
      const currentPrice = currentSub.billing_cycle === 'yearly'
        ? Number(currentPlan.price_yearly)
        : Number(currentPlan.price_monthly);
      
      const newPrice = billingCycle === 'yearly'
        ? Number(newPlan.price_yearly)
        : Number(newPlan.price_monthly);

      const isUpgrade = newPrice > currentPrice;
      const isDowngrade = newPrice < currentPrice;

      // 📊 DIAGNOSIS - Price Comparison
      console.log('📊 DIAGNOSIS - Price Comparison:', {
        currentPlanName: currentPlan.name,
        currentBillingCycle: currentSub.billing_cycle,
        currentPrice,
        newPlanName: newPlan.name,
        newBillingCycle: billingCycle,
        newPrice,
        simpleDifference: newPrice - currentPrice,
        isUpgrade,
        isDowngrade,
      });

      // 🧮 DIAGNOSIS - Manual Proration Calculation
      const usedValue = (daysElapsed / totalDays) * currentPrice;
      const creditForRemaining = (daysRemaining / totalDays) * currentPrice;
      const proportionalNewCost = (daysRemaining / totalDays) * newPrice;
      const manualProration = proportionalNewCost - creditForRemaining;

      console.log('🧮 DIAGNOSIS - Manual Proration Calculation:', {
        usedValue: usedValue.toFixed(2),
        creditForRemaining: creditForRemaining.toFixed(2),
        proportionalNewCost: proportionalNewCost.toFixed(2),
        manualProration: manualProration.toFixed(2),
        stripeProration: (upcomingInvoice.amount_due / 100).toFixed(2),
        difference: ((upcomingInvoice.amount_due / 100) - manualProration).toFixed(2),
        percentageDifference: (((upcomingInvoice.amount_due / 100 - manualProration) / manualProration) * 100).toFixed(2) + '%',
      });

      console.log('Preview calculated:', {
        proratedAmount: upcomingInvoice.amount_due,
        isUpgrade,
        isDowngrade,
      });

      return new Response(
        JSON.stringify({ 
          preview: true,
          proratedAmount: upcomingInvoice.amount_due / 100, // Convert from cents
          proratedCurrency: upcomingInvoice.currency.toUpperCase(),
          isUpgrade,
          isDowngrade,
          currentPrice,
          newPrice,
          nextBillingDate: new Date(upcomingInvoice.period_end * 1000).toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Apply the subscription change
    const updateParams: any = {
      items: [{
        id: stripeSubscription.items.data[0].id,
        price: newPriceId,
      }],
      proration_behavior: 'create_prorations',
      metadata: {
        plan_id: newPlanId,
        user_id: user.id,
        billing_cycle: billingCycle,
      },
    };

    // 🔄 IMPORTANT: If subscription had pending cancellation, reactivate it
    if (stripeSubscription.cancel_at_period_end) {
      updateParams.cancel_at_period_end = false;
      console.log('🔄 Reactivating subscription - removing pending cancellation');
    }

    const updatedSubscription = await stripe.subscriptions.update(
      currentSub.stripe_subscription_id,
      updateParams
    );

    // Update database
    const dbUpdate: any = {
      plan_id: newPlanId,
      billing_cycle: billingCycle,
      updated_at: new Date().toISOString(),
    };

    // 🔄 Sync cancel_at_period_end with Stripe
    if (stripeSubscription.cancel_at_period_end) {
      dbUpdate.cancel_at_period_end = false;
      console.log('🔄 Database: Removing pending cancellation flag');
    }

    const { error: updateError } = await supabaseClient
      .from('user_subscriptions')
      .update(dbUpdate)
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (updateError) {
      console.error('Database update error:', updateError);
    }

    // Log the subscription change
    // Use previously calculated values instead of redeclaring
    const changeType = newPrice > currentPrice ? 'upgrade' : newPrice < currentPrice ? 'downgrade' : 'cycle_change';

    const { error: logError } = await supabaseClient
      .from('subscription_changes')
      .insert({
        user_id: user.id,
        previous_plan_id: currentSub.plan_id,
        new_plan_id: newPlanId,
        previous_billing_cycle: currentSub.billing_cycle,
        new_billing_cycle: billingCycle,
        change_type: changeType,
        metadata: {
          previous_plan_name: currentPlan.name,
          new_plan_name: newPlan.name,
          bypassed_cooldown: isAdmin || bypassCooldown,
          changed_by_admin: isAdmin,
        },
      });

    if (logError) {
      console.error('Error logging subscription change:', logError);
    }

    console.log('Subscription updated successfully');

    // If downgrade, handle property limits
    if (changeType === 'downgrade') {
      const newPlanLimit = newPlan.features?.max_properties || 0;
      
      // Pause excess properties
      const { data: activeProperties } = await supabaseClient
        .from('properties')
        .select('id')
        .eq('agent_id', user.id)
        .eq('status', 'activa')
        .order('created_at', { ascending: false })
        .range(newPlanLimit, 999);

      let propertiesRemoved = 0;
      if (activeProperties && activeProperties.length > 0) {
        const propertyIds = activeProperties.map((p) => p.id);
        await supabaseClient
          .from('properties')
          .update({ status: 'pausada' })
          .in('id', propertyIds);
        
        propertiesRemoved = propertyIds.length;
      }

      // NUEVO: Manejar límite de destacadas al downgrade
      const newFeaturedLimit = newPlan.features?.featured_listings || 0;
      let featuredRemoved = 0;

      // Contar destacadas activas actuales
      const { data: activeFeatured, count: featuredCount } = await supabaseClient
        .from('featured_properties')
        .select('*', { count: 'exact' })
        .eq('agent_id', user.id)
        .eq('status', 'active')
        .gt('end_date', new Date().toISOString());

      // Si excede el nuevo límite, desactivar las más antiguas
      if (featuredCount && featuredCount > newFeaturedLimit) {
        const excessCount = featuredCount - newFeaturedLimit;
        
        // Obtener las destacadas más antiguas para desactivar
        const { data: featuredToRemove } = await supabaseClient
          .from('featured_properties')
          .select('id')
          .eq('agent_id', user.id)
          .eq('status', 'active')
          .gt('end_date', new Date().toISOString())
          .order('start_date', { ascending: true })
          .limit(excessCount);

        if (featuredToRemove && featuredToRemove.length > 0) {
          const featuredIds = featuredToRemove.map(f => f.id);
          
          await supabaseClient
            .from('featured_properties')
            .update({ status: 'removed_downgrade' })
            .in('id', featuredIds);
          
          featuredRemoved = featuredIds.length;
          console.log(`Removed ${featuredRemoved} excess featured properties on downgrade`);
        }
      }

      // Actualizar contador mensual de destacadas si excede el nuevo límite
      const { data: currentSub } = await supabaseClient
        .from('user_subscriptions')
        .select('featured_used_this_month')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (currentSub && currentSub.featured_used_this_month > newFeaturedLimit) {
        await supabaseClient
          .from('user_subscriptions')
          .update({ featured_used_this_month: newFeaturedLimit })
          .eq('user_id', user.id)
          .eq('status', 'active');
      }

      // Send downgrade confirmation
      await supabaseClient.functions.invoke('send-subscription-notification', {
        body: {
          userId: user.id,
          type: 'downgrade_confirmed',
          metadata: {
            previousPlan: currentPlan.display_name,
            newPlan: newPlan.display_name,
            effectiveDate: new Date().toLocaleDateString('es-MX', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            propertiesRemoved,
            featuredRemoved,
            newFeaturedLimit,
          },
        },
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        subscription: updatedSubscription,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error changing subscription plan:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
