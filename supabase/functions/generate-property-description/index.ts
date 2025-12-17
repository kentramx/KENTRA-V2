import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit config
const USER_RATE_LIMIT = 5; // 5 generations per hour per user
const GLOBAL_RATE_LIMIT = 100; // 100 generations per hour global
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// In-memory rate limiting (resets on function cold start, but good enough for basic protection)
const userRateLimits = new Map<string, { count: number; resetAt: number }>();
const globalRateLimit = { count: 0, resetAt: Date.now() + RATE_WINDOW_MS };

// Simple cache (in-memory, resets on cold start - production would use Redis)
const descriptionCache = new Map<string, { description: string; createdAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  
  // Check global rate limit
  if (now > globalRateLimit.resetAt) {
    globalRateLimit.count = 0;
    globalRateLimit.resetAt = now + RATE_WINDOW_MS;
  }
  if (globalRateLimit.count >= GLOBAL_RATE_LIMIT) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetIn: Math.ceil((globalRateLimit.resetAt - now) / 1000 / 60) 
    };
  }
  
  // Check user rate limit
  let userLimit = userRateLimits.get(userId);
  if (!userLimit || now > userLimit.resetAt) {
    userLimit = { count: 0, resetAt: now + RATE_WINDOW_MS };
    userRateLimits.set(userId, userLimit);
  }
  
  if (userLimit.count >= USER_RATE_LIMIT) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetIn: Math.ceil((userLimit.resetAt - now) / 1000 / 60) 
    };
  }
  
  return { 
    allowed: true, 
    remaining: USER_RATE_LIMIT - userLimit.count - 1,
    resetIn: Math.ceil((userLimit.resetAt - now) / 1000 / 60)
  };
}

function incrementRateLimit(userId: string) {
  const userLimit = userRateLimits.get(userId);
  if (userLimit) {
    userLimit.count++;
  }
  globalRateLimit.count++;
}

function generateCacheKey(data: any): string {
  // Create a hash based on key property characteristics
  const keyParts = [
    data.type || '',
    data.bedrooms || '',
    data.bathrooms || '',
    data.sqft || '',
    data.state || '',
    data.municipality || '',
    data.for_sale ? 'sale' : 'rent',
  ];
  return keyParts.join('|').toLowerCase();
}

function getCachedDescription(key: string): string | null {
  const cached = descriptionCache.get(key);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    console.log(`[Cache HIT] Key: ${key}`);
    return cached.description;
  }
  if (cached) {
    descriptionCache.delete(key);
  }
  console.log(`[Cache MISS] Key: ${key}`);
  return null;
}

function setCachedDescription(key: string, description: string) {
  // Clean old entries periodically
  if (descriptionCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of descriptionCache.entries()) {
      if (now - v.createdAt > CACHE_TTL_MS) {
        descriptionCache.delete(k);
      }
    }
  }
  descriptionCache.set(key, { description, createdAt: Date.now() });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuario no autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { propertyData } = body;

    if (!propertyData) {
      return new Response(
        JSON.stringify({ error: 'Datos de propiedad requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const rateCheck = checkRateLimit(user.id);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ 
          error: `Límite de generaciones alcanzado. Intenta de nuevo en ${rateCheck.resetIn} minutos.`,
          remaining: 0,
          resetIn: rateCheck.resetIn
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache
    const cacheKey = generateCacheKey(propertyData);
    const cachedDescription = getCachedDescription(cacheKey);
    
    if (cachedDescription) {
      // Don't increment rate limit for cache hits
      return new Response(
        JSON.stringify({ 
          description: cachedDescription,
          remaining: rateCheck.remaining,
          cached: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build prompt
    const {
      type,
      state,
      municipality,
      colonia,
      bedrooms,
      bathrooms,
      sqft,
      lot_size,
      parking,
      amenities,
      for_sale,
      for_rent,
      sale_price,
      rent_price,
      currency
    } = propertyData;

    const price = for_sale ? sale_price : rent_price;
    const listingType = for_sale && for_rent ? 'venta y renta' : (for_sale ? 'venta' : 'renta');
    
    // Format amenities for prompt
    const amenitiesList = amenities?.flatMap((cat: any) => cat.items || []).slice(0, 10).join(', ') || 'No especificadas';

    const prompt = `Genera una descripción profesional para esta propiedad inmobiliaria en México:

- Tipo: ${type || 'propiedad'}
- Ubicación: ${colonia || ''}, ${municipality || ''}, ${state || 'México'}
- Recámaras: ${bedrooms || 'N/A'}, Baños: ${bathrooms || 'N/A'}
- Superficie construida: ${sqft || 'N/A'} m²
- Superficie terreno: ${lot_size || 'N/A'} m²
- Estacionamiento: ${parking || 'N/A'} lugares
- Amenidades: ${amenitiesList}
- Precio: $${price?.toLocaleString() || 'A consultar'} ${currency || 'MXN'} (${listingType})

Escribe entre 80 y 120 palabras en español profesional inmobiliario.
Destaca la ubicación, características principales y propuesta de valor.
No uses emojis, exclamaciones exageradas ni frases como "¡Oportunidad única!".
El tono debe ser elegante y persuasivo pero contenido.
Incluye un llamado a la acción sutil al final.`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Servicio de IA no configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AI Request] User: ${user.id}, Type: ${type}, Location: ${municipality}, ${state}`);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { 
            role: 'system', 
            content: 'Eres un experto copywriter inmobiliario en México. Escribes descripciones profesionales, elegantes y persuasivas para propiedades.' 
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Servicio de IA temporalmente no disponible. Intenta más tarde.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Servicio de IA no disponible en este momento.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Error al generar descripción' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const generatedDescription = aiData.choices?.[0]?.message?.content?.trim();

    if (!generatedDescription) {
      console.error('No content in AI response:', aiData);
      return new Response(
        JSON.stringify({ error: 'No se pudo generar la descripción' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Increment rate limit only for successful API calls
    incrementRateLimit(user.id);

    // Cache the result
    setCachedDescription(cacheKey, generatedDescription);

    console.log(`[AI Success] User: ${user.id}, Chars: ${generatedDescription.length}, Remaining: ${rateCheck.remaining}`);

    return new Response(
      JSON.stringify({ 
        description: generatedDescription,
        remaining: rateCheck.remaining,
        cached: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-property-description:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
