import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📋 Fetching invoices for user: ${user.id}`);

    // Get stripe_customer_id from user_subscriptions
    const { data: subscription, error: subError } = await supabaseClient
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error("Error fetching subscription:", subError);
      return new Response(
        JSON.stringify({ error: "Error fetching subscription data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscription?.stripe_customer_id) {
      console.log("No Stripe customer ID found for user");
      return new Response(
        JSON.stringify({ invoices: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Fetch invoices from Stripe
    const invoices = await stripe.invoices.list({
      customer: subscription.stripe_customer_id,
      limit: 50,
    });

    console.log(`✅ Found ${invoices.data.length} invoices`);

    // Format invoices for response
    const formattedInvoices = invoices.data.map((invoice: Stripe.Invoice) => ({
      id: invoice.id,
      number: invoice.number,
      date: invoice.created,
      amount: invoice.amount_paid / 100, // Convert from cents
      currency: invoice.currency?.toUpperCase() || "MXN",
      status: invoice.status,
      description: invoice.lines.data[0]?.description || "Suscripción Kentra",
      pdfUrl: invoice.invoice_pdf,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
    }));

    return new Response(
      JSON.stringify({ invoices: formattedInvoices }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in get-invoices:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
