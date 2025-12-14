import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting expire-upsells check...");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Buscar upsells activos que ya expiraron
    const { data: expiredUpsells, error: fetchError } = await supabaseClient
      .from("user_active_upsells")
      .select("*, upsells(*)")
      .eq("status", "active")
      .not("end_date", "is", null)
      .lt("end_date", new Date().toISOString());

    if (fetchError) {
      console.error("Error fetching expired upsells:", fetchError);
      throw fetchError;
    }

    if (!expiredUpsells || expiredUpsells.length === 0) {
      console.log("No expired upsells found");
      return new Response(
        JSON.stringify({ success: true, expired: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${expiredUpsells.length} expired upsell(s)`);

    let expiredCount = 0;

    for (const upsell of expiredUpsells) {
      try {
        // Marcar como expirado
        const { error: updateError } = await supabaseClient
          .from("user_active_upsells")
          .update({ status: "expired" })
          .eq("id", upsell.id);

        if (updateError) {
          console.error(`Error updating upsell ${upsell.id}:`, updateError);
          continue;
        }

        // Enviar notificación al usuario
        try {
          await supabaseClient.functions.invoke("send-subscription-notification", {
            body: {
              userId: upsell.user_id,
              type: "upsell_expired",
              metadata: {
                upsellName: upsell.upsells?.name || "Servicio adicional",
                expiredDate: new Date(upsell.end_date).toLocaleDateString("es-MX"),
              },
            },
          });
        } catch (notifyErr) {
          console.error(`Error sending notification for upsell ${upsell.id}:`, notifyErr);
          // No fallar el proceso completo si falla la notificación
        }

        expiredCount++;
        console.log(`Expired upsell ${upsell.id} for user ${upsell.user_id}`);
      } catch (err) {
        console.error(`Error processing upsell ${upsell.id}:`, err);
      }
    }

    console.log(`Successfully expired ${expiredCount} upsells`);

    return new Response(
      JSON.stringify({ success: true, expired: expiredCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in expire-upsells:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
