import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImageAnalysisRequest {
  imageUrl: string;
  imageId: string;
  propertyId: string;
}

interface ImageAnalysisResult {
  imageId: string;
  qualityScore: number;
  resolutionScore: number;
  lightingScore: number;
  compositionScore: number;
  isInappropriate: boolean;
  isManipulated: boolean;
  isBlurry: boolean;
  isDark: boolean;
  detectedIssues: string[];
  aiNotes: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🖼️ AI Image Analysis request received");
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { images }: { images: ImageAnalysisRequest[] } = await req.json();
    
    if (!images || images.length === 0) {
      throw new Error("No images provided for analysis");
    }

    console.log(`📊 Analyzing ${images.length} images`);

    const analysisPromises = images.map(async (image) => {
      try {
        console.log(`🔍 Analyzing image: ${image.imageId}`);

        const systemPrompt = `Eres un experto en análisis de imágenes inmobiliarias. Analiza esta imagen de propiedad y evalúa:

1. CALIDAD TÉCNICA (0-100):
   - Resolución: ¿Imagen nítida y de alta resolución?
   - Iluminación: ¿Bien iluminada, no muy oscura ni sobreexpuesta?
   - Composición: ¿Bien encuadrada, horizontal, sin objetos cortados?

2. CONTENIDO INAPROPIADO:
   - Contenido sexual, violento o explícito
   - Lenguaje ofensivo en textos visibles
   - Símbolos de odio o discriminatorios
   - Personas en poses inapropiadas

3. MANIPULACIÓN DIGITAL:
   - Edición excesiva que distorsiona la realidad
   - Filtros engañosos que cambian colores reales
   - Photoshop obvio que modifica tamaño de espacios
   - Elementos añadidos/removidos de forma engañosa

4. PROBLEMAS COMUNES:
   - Imagen borrosa o desenfocada
   - Demasiado oscura o con flash excesivo
   - Mala composición (torcida, cortada)
   - Marca de agua intrusiva

Responde SOLO con JSON en este formato exacto:
{
  "qualityScore": 0-100,
  "resolutionScore": 0-100,
  "lightingScore": 0-100,
  "compositionScore": 0-100,
  "isInappropriate": boolean,
  "isManipulated": boolean,
  "isBlurry": boolean,
  "isDark": boolean,
  "detectedIssues": ["lista", "de", "problemas"],
  "aiNotes": "Explicación breve del análisis"
}

Criterios:
- qualityScore es el promedio de los 3 scores técnicos
- isInappropriate debe ser true solo si hay contenido claramente inapropiado
- isManipulated debe ser true solo si hay edición engañosa evidente`;

        // Llamar a Lovable AI con imagen
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { 
                role: "system", 
                content: systemPrompt 
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Analiza esta imagen de propiedad inmobiliaria y proporciona tu análisis en formato JSON."
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: image.imageUrl
                    }
                  }
                ]
              }
            ],
            temperature: 0.2, // Baja para análisis consistente
          }),
        });

        if (!aiResponse.ok) {
          console.error(`❌ AI gateway error for image ${image.imageId}:`, aiResponse.status);
          // Fallback en caso de error
          return {
            imageId: image.imageId,
            qualityScore: 50,
            resolutionScore: 50,
            lightingScore: 50,
            compositionScore: 50,
            isInappropriate: false,
            isManipulated: false,
            isBlurry: false,
            isDark: false,
            detectedIssues: ['Error en análisis IA'],
            aiNotes: 'No se pudo analizar esta imagen. Requiere revisión manual.',
          };
        }

        const aiData = await aiResponse.json();
        const aiContent = aiData.choices?.[0]?.message?.content;
        
        if (!aiContent) {
          throw new Error("No content received from AI");
        }

        console.log(`📦 AI Response for ${image.imageId}:`, aiContent);

        // Parsear respuesta JSON de la IA
        let result: Partial<ImageAnalysisResult>;
        try {
          const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("No JSON found in AI response");
          }
        } catch (parseError) {
          console.error("❌ Failed to parse AI response:", parseError);
          result = {
            qualityScore: 50,
            resolutionScore: 50,
            lightingScore: 50,
            compositionScore: 50,
            isInappropriate: false,
            isManipulated: false,
            isBlurry: false,
            isDark: false,
            detectedIssues: ['Error al procesar análisis'],
            aiNotes: 'Error al interpretar respuesta de IA. Revisar manualmente.',
          };
        }

        // Validar y normalizar resultado
        const finalResult: ImageAnalysisResult = {
          imageId: image.imageId,
          qualityScore: Math.max(0, Math.min(100, result.qualityScore || 50)),
          resolutionScore: Math.max(0, Math.min(100, result.resolutionScore || 50)),
          lightingScore: Math.max(0, Math.min(100, result.lightingScore || 50)),
          compositionScore: Math.max(0, Math.min(100, result.compositionScore || 50)),
          isInappropriate: result.isInappropriate || false,
          isManipulated: result.isManipulated || false,
          isBlurry: result.isBlurry || false,
          isDark: result.isDark || false,
          detectedIssues: Array.isArray(result.detectedIssues) ? result.detectedIssues : [],
          aiNotes: result.aiNotes || 'Análisis completado',
        };

        console.log(`✅ Analysis complete for ${image.imageId}: Score ${finalResult.qualityScore}`);
        return finalResult;

      } catch (imageError) {
        console.error(`❌ Error analyzing image ${image.imageId}:`, imageError);
        return {
          imageId: image.imageId,
          qualityScore: 50,
          resolutionScore: 50,
          lightingScore: 50,
          compositionScore: 50,
          isInappropriate: false,
          isManipulated: false,
          isBlurry: false,
          isDark: false,
          detectedIssues: [`Error: ${imageError instanceof Error ? imageError.message : String(imageError)}`],
          aiNotes: 'Error en análisis. Requiere revisión manual.',
        };
      }
    });

    const results = await Promise.all(analysisPromises);

    // Calcular estadísticas agregadas
    const avgQuality = results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length;
    const hasIssues = results.some(r => 
      r.isInappropriate || 
      r.isManipulated || 
      r.qualityScore < 60
    );

    console.log(`✅ All images analyzed. Average quality: ${avgQuality.toFixed(1)}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        summary: {
          totalImages: results.length,
          averageQuality: Math.round(avgQuality),
          hasIssues,
          inappropriateCount: results.filter(r => r.isInappropriate).length,
          manipulatedCount: results.filter(r => r.isManipulated).length,
          lowQualityCount: results.filter(r => r.qualityScore < 60).length,
        },
        analyzed_at: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("❌ Error in ai-analyze-images:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
};

serve(handler);
