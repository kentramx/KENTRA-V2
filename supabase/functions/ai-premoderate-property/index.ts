import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PropertyData {
  title: string;
  description: string;
  price: number;
  type: string;
  listing_type: string;
  address: string;
  municipality: string;
  state: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  amenities?: Array<{ category: string; items: string[] }>;
}

interface ModerationResult {
  score: number;
  status: 'pass' | 'review' | 'reject';
  notes: string;
  issues: string[];
  suggestions: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🤖 AI Pre-moderation request received");
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const propertyData: PropertyData = await req.json();
    console.log(`📋 Analyzing property: ${propertyData.title}`);

    // Construir prompt detallado para la IA
    const systemPrompt = `Eres un experto moderador de propiedades inmobiliarias en México. Tu trabajo es analizar propiedades y detectar:

1. CONTENIDO INAPROPIADO:
   - Lenguaje ofensivo, discriminatorio o spam
   - Información fraudulenta o engañosa
   - Datos de contacto no autorizados (teléfonos, emails, URLs en descripción)
   
2. CALIDAD DE INFORMACIÓN:
   - Descripción muy corta (<50 palabras) o excesivamente larga
   - Falta de detalles importantes según el tipo de propiedad
   - Precio fuera de rangos razonables de mercado mexicano
   
3. COHERENCIA:
   - Tipo de propiedad vs características (ej: terreno con recámaras)
   - Precio vs tipo y ubicación
   - Amenidades lógicas para el tipo de propiedad

Responde SOLO con JSON en este formato exacto:
{
  "score": 0-100,
  "status": "pass" | "review" | "reject",
  "notes": "Explicación breve de tu decisión",
  "issues": ["lista", "de", "problemas"],
  "suggestions": ["lista", "de", "mejoras"]
}

Criterios de score:
- 90-100: Excelente, auto-aprobar (pass)
- 70-89: Buena pero revisar (review)
- 0-69: Problemas graves, auto-rechazar (reject)`;

    const userPrompt = `Analiza esta propiedad:

TÍTULO: ${propertyData.title}

DESCRIPCIÓN:
${propertyData.description}

DATOS:
- Tipo: ${propertyData.type}
- Operación: ${propertyData.listing_type}
- Precio: $${propertyData.price.toLocaleString('es-MX')} MXN
- Ubicación: ${propertyData.municipality}, ${propertyData.state}
- Dirección: ${propertyData.address}
${propertyData.bedrooms ? `- Recámaras: ${propertyData.bedrooms}` : ''}
${propertyData.bathrooms ? `- Baños: ${propertyData.bathrooms}` : ''}
${propertyData.sqft ? `- m²: ${propertyData.sqft}` : ''}
${propertyData.amenities && propertyData.amenities.length > 0 ? `- Amenidades: ${propertyData.amenities.map(a => a.category + ': ' + a.items.join(', ')).join(' | ')}` : ''}

Analiza y responde con JSON.`;

    // Llamar a Lovable AI
    console.log("🔮 Calling Lovable AI for analysis...");
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3, // Baja temperatura para respuestas consistentes
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: "rate_limit", 
            message: "Límite de solicitudes excedido. Intenta de nuevo en unos momentos." 
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: "payment_required", 
            message: "Créditos de IA agotados. Contacta a soporte." 
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("❌ AI gateway error:", aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;
    
    if (!aiContent) {
      throw new Error("No content received from AI");
    }

    console.log("📦 AI Response:", aiContent);

    // Parsear respuesta JSON de la IA
    let result: ModerationResult;
    try {
      // Intentar extraer JSON del contenido (la IA podría incluir texto adicional)
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in AI response");
      }
    } catch (parseError) {
      console.error("❌ Failed to parse AI response:", parseError);
      // Fallback: marcar para revisión manual
      result = {
        score: 50,
        status: 'review',
        notes: 'Error al procesar respuesta de IA. Requiere revisión manual.',
        issues: ['Error en análisis automático'],
        suggestions: ['Revisar manualmente']
      };
    }

    // Validar y normalizar resultado
    result.score = Math.max(0, Math.min(100, result.score || 50));
    result.status = ['pass', 'review', 'reject'].includes(result.status) ? result.status : 'review';
    result.notes = result.notes || 'Sin notas';
    result.issues = Array.isArray(result.issues) ? result.issues : [];
    result.suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];

    console.log(`✅ Analysis complete: Score ${result.score}, Status: ${result.status}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        result,
        analyzed_at: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("❌ Error in ai-premoderate-property:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        // Fallback seguro en caso de error total
        result: {
          score: 50,
          status: 'review',
          notes: 'Error en pre-moderación automática. Requiere revisión manual.',
          issues: [`Error del sistema: ${error.message}`],
          suggestions: []
        }
      }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
};

serve(handler);
