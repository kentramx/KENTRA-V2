import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting: 20 requests per hour per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

// Simple FAQ cache
const faqCache = new Map<string, { response: string; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('x-real-ip') ||
         req.headers.get('cf-connecting-ip') ||
         'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

function getCacheKey(message: string): string {
  return message.toLowerCase().trim().replace(/[^\w\s]/g, '');
}

function getCachedResponse(message: string): string | null {
  const key = getCacheKey(message);
  const cached = faqCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[support-chatbot] Cache hit for: ${key.substring(0, 30)}...`);
    return cached.response;
  }
  
  return null;
}

function setCachedResponse(message: string, response: string): void {
  const key = getCacheKey(message);
  faqCache.set(key, { response, timestamp: Date.now() });
}

const KENTRA_CONTEXT = `
Eres el asistente de soporte de Kentra, una plataforma inmobiliaria mexicana para publicar y buscar propiedades.

INFORMACIÓN IMPORTANTE DE KENTRA:

SOBRE LA PLATAFORMA:
- Kentra es una plataforma web para comprar, vender y rentar propiedades en México
- Funciona en cualquier dispositivo con navegador moderno
- Tres tipos de usuarios: Agentes independientes, Inmobiliarias, Desarrolladoras
- Los compradores pueden buscar propiedades sin cuenta, pero necesitan una para guardar favoritos o contactar agentes

PLANES Y PRECIOS:
- Trial gratuito: 14 días para probar todas las funciones
- Plan Básico: Desde $299 MXN/mes - 5 propiedades
- Plan Profesional: Desde $599 MXN/mes - 20 propiedades
- Plan Premium: Desde $999 MXN/mes - propiedades ilimitadas
- Descuento del 16% (2 meses gratis) al pagar anualmente

MÉTODOS DE PAGO:
- Tarjetas de crédito y débito (Visa, Mastercard, American Express)
- Todos los pagos se procesan de forma segura con Stripe
- NO aceptamos pagos en efectivo ni transferencias bancarias

PUBLICAR PROPIEDADES:
- Registrarse como agente → Elegir plan → Ir a "Publicar Propiedad"
- Completar formulario con fotos, descripción, precio, ubicación, características
- Las propiedades son revisadas y publicadas rápidamente
- Se pueden editar o eliminar desde el Panel de Agente

VERIFICACIÓN DE AGENTE:
- Subir INE y documentos profesionales en el perfil
- El proceso toma 24-48 horas hábiles
- Los agentes verificados tienen una insignia especial

SOPORTE:
- Email: soporte@kentra.com.mx (respuesta en 24-48 horas)
- WhatsApp: Lunes a Viernes 9am-6pm
- Centro de Ayuda: kentra.com.mx/ayuda

REGLAS DE RESPUESTA:
1. Responde SIEMPRE en español mexicano, profesional pero amigable
2. Respuestas cortas y directas (máximo 150 palabras)
3. Si no sabes algo con certeza, redirige a soporte@kentra.com.mx
4. NO inventes información sobre precios exactos o features no mencionados
5. NO hagas promesas de soporte técnico específico o tiempos de resolución
6. Si la pregunta no es sobre Kentra, indica amablemente que solo puedes ayudar con temas de la plataforma
`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIP = getClientIP(req);
    
    // Check rate limit
    if (!checkRateLimit(clientIP)) {
      console.log(`[support-chatbot] Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ 
          error: "Has alcanzado el límite de preguntas. Por favor espera un momento o contacta soporte@kentra.com.mx" 
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { message, history = [] } = await req.json();

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "El mensaje es requerido" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (message.length > 500) {
      return new Response(
        JSON.stringify({ error: "El mensaje es demasiado largo (máximo 500 caracteres)" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache for common questions
    const cachedResponse = getCachedResponse(message);
    if (cachedResponse) {
      return new Response(
        JSON.stringify({ response: cachedResponse, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[support-chatbot] Processing message from IP ${clientIP}: ${message.substring(0, 50)}...`);

    // Build messages array for AI
    const aiMessages = [
      { role: "system", content: KENTRA_CONTEXT },
      ...history.slice(-6).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content
      })),
      { role: "user", content: message }
    ];

    // Call Lovable AI (Gemini Flash Lite - most economical)
    const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY") || ""}`
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: aiMessages,
        max_tokens: 300,
        temperature: 0.7
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`[support-chatbot] AI API error: ${aiResponse.status} - ${errorText}`);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const responseText = aiData.choices?.[0]?.message?.content || 
      "Lo siento, no pude procesar tu pregunta. Por favor contacta a soporte@kentra.com.mx";

    // Cache the response for common questions
    setCachedResponse(message, responseText);

    console.log(`[support-chatbot] Response generated successfully`);

    return new Response(
      JSON.stringify({ response: responseText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[support-chatbot] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Error al procesar tu pregunta. Por favor intenta de nuevo o contacta soporte@kentra.com.mx",
        response: "Lo siento, tuve un problema técnico. Por favor intenta de nuevo o escríbenos a soporte@kentra.com.mx para ayudarte directamente."
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
