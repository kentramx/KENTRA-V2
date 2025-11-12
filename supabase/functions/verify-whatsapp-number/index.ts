import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Crear cliente de Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Obtener usuario autenticado
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuario no autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener el número de WhatsApp del perfil
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('whatsapp_number')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Error al obtener perfil de usuario' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile?.whatsapp_number) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No tienes un número de WhatsApp configurado' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phoneNumber = profile.whatsapp_number;

    // Verificar con Twilio Lookup API
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');

    if (!twilioAccountSid || !twilioAuthToken) {
      console.error('Twilio credentials not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Servicio de verificación no disponible' 
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Llamar a Twilio Lookup API v2
    const twilioUrl = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phoneNumber)}?Fields=line_type_intelligence`;
    const basicAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    console.log('Calling Twilio Lookup API for:', phoneNumber);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
    });

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      console.error('Twilio API error:', twilioResponse.status, errorText);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error al verificar el número con Twilio',
          details: twilioResponse.status === 404 ? 'Número inválido' : 'Error de servicio'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const twilioData = await twilioResponse.json();
    console.log('Twilio response:', JSON.stringify(twilioData, null, 2));

    // Verificar si el número tiene WhatsApp activo
    // Twilio indica WhatsApp en line_type_intelligence
    const lineTypeIntelligence = twilioData.line_type_intelligence;
    const hasWhatsApp = 
      lineTypeIntelligence?.type === 'voip' && 
      lineTypeIntelligence?.carrier_name?.toLowerCase().includes('whatsapp');

    console.log('WhatsApp detection result:', hasWhatsApp);

    // Actualizar perfil con resultado de verificación
    const updateData: any = {
      whatsapp_verified: hasWhatsApp,
    };

    if (hasWhatsApp) {
      updateData.whatsapp_verified_at = new Date().toISOString();
    }

    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return new Response(
        JSON.stringify({ error: 'Error al actualizar el perfil' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Si la verificación fue exitosa, enviar email de confirmación
    if (hasWhatsApp) {
      console.log('Sending WhatsApp verification confirmation email...');
      
      // Obtener nombre del perfil para el email
      const { data: profileData } = await supabaseClient
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();

      try {
        // Invocar edge function de email (no bloqueante)
        await supabaseClient.functions.invoke('send-whatsapp-verification-email', {
          body: {
            userEmail: user.email,
            userName: profileData?.name || 'Usuario',
            whatsappNumber: phoneNumber,
          }
        });
        console.log('WhatsApp verification email sent successfully');
      } catch (emailError) {
        // No bloquear el flujo si el email falla
        console.error('Error sending verification email (non-blocking):', emailError);
      }
    }

    // Retornar resultado
    return new Response(
      JSON.stringify({
        success: true,
        hasWhatsApp,
        phoneNumber,
        message: hasWhatsApp 
          ? 'WhatsApp verificado correctamente' 
          : 'Este número no tiene WhatsApp activo',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(
      JSON.stringify({ 
        error: 'Error interno del servidor',
        details: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});