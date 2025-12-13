import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Colores de la marca Kentra
const COLORS = {
  primary: "#5C5C3D", // Verde olivo
  background: "#FDFCFA",
  text: "#1A1A1A",
  muted: "#6B7280",
  accent: "#6B8F47",
};

const SITE_URL = "https://kentra.com.mx";

// Formatear precio en MXN
function formatPrice(price: number): string {
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(1)}M`;
  } else if (price >= 1000) {
    return `$${(price / 1000).toFixed(0)}K`;
  }
  return `$${price.toLocaleString()}`;
}

// Generar SVG para propiedad
function generatePropertySVG(property: any): string {
  const price = formatPrice(property.price || 0);
  const title = property.title?.slice(0, 40) || "Propiedad";
  const location = `${property.municipality || ""}, ${property.state || ""}`.slice(0, 35);
  const beds = property.bedrooms || 0;
  const baths = property.bathrooms || 0;
  const sqft = property.sqft || 0;
  const listingType = property.listing_type === "renta" ? "En Renta" : "En Venta";
  
  return `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#FAF9F6"/>
          <stop offset="100%" style="stop-color:#F0EDE8"/>
        </linearGradient>
        <clipPath id="imgClip">
          <rect x="60" y="120" width="480" height="380" rx="16"/>
        </clipPath>
      </defs>
      
      <!-- Background -->
      <rect width="1200" height="630" fill="url(#bg)"/>
      
      <!-- Image placeholder with gradient -->
      <rect x="60" y="120" width="480" height="380" rx="16" fill="#E5E7EB"/>
      <text x="300" y="320" text-anchor="middle" fill="#9CA3AF" font-family="system-ui" font-size="48">🏠</text>
      
      <!-- Listing type badge -->
      <rect x="80" y="140" width="120" height="36" rx="8" fill="${COLORS.primary}"/>
      <text x="140" y="165" text-anchor="middle" fill="white" font-family="system-ui" font-size="16" font-weight="600">${listingType}</text>
      
      <!-- Content area -->
      <text x="580" y="180" fill="${COLORS.text}" font-family="system-ui" font-size="36" font-weight="700">${title}</text>
      
      <text x="580" y="240" fill="${COLORS.primary}" font-family="system-ui" font-size="56" font-weight="800">${price} MXN</text>
      
      <!-- Features -->
      <text x="580" y="320" fill="${COLORS.muted}" font-family="system-ui" font-size="28">
        🛏 ${beds} rec  ·  🛁 ${baths} baños  ·  📐 ${sqft}m²
      </text>
      
      <!-- Location -->
      <text x="580" y="380" fill="${COLORS.muted}" font-family="system-ui" font-size="24">📍 ${location}</text>
      
      <!-- Kentra branding -->
      <rect x="580" y="460" width="180" height="60" rx="12" fill="${COLORS.primary}"/>
      <text x="670" y="500" text-anchor="middle" fill="white" font-family="system-ui" font-size="28" font-weight="700">KENTRA</text>
      
      <!-- URL -->
      <text x="1140" y="590" text-anchor="end" fill="${COLORS.muted}" font-family="system-ui" font-size="20">kentra.com.mx</text>
    </svg>
  `;
}

// Generar SVG para agente
function generateAgentSVG(agent: any, stats: any): string {
  const name = agent.name?.slice(0, 30) || "Agente";
  const location = [agent.city, agent.state].filter(Boolean).join(", ").slice(0, 35) || "México";
  const properties = stats.activeProperties || 0;
  const rating = stats.averageRating?.toFixed(1) || "N/A";
  const reviews = stats.totalReviews || 0;
  
  return `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#FAF9F6"/>
          <stop offset="100%" style="stop-color:#F0EDE8"/>
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="1200" height="630" fill="url(#bg)"/>
      
      <!-- Avatar placeholder -->
      <circle cx="200" cy="280" r="100" fill="${COLORS.primary}" opacity="0.1"/>
      <circle cx="200" cy="280" r="95" fill="white"/>
      <text x="200" y="300" text-anchor="middle" fill="${COLORS.primary}" font-family="system-ui" font-size="72">${name.charAt(0).toUpperCase()}</text>
      
      <!-- Content -->
      <text x="360" y="200" fill="${COLORS.text}" font-family="system-ui" font-size="48" font-weight="700">${name}</text>
      <text x="360" y="260" fill="${COLORS.primary}" font-family="system-ui" font-size="28" font-weight="500">Agente Inmobiliario Certificado</text>
      
      <!-- Location -->
      <text x="360" y="320" fill="${COLORS.muted}" font-family="system-ui" font-size="24">📍 ${location}</text>
      
      <!-- Stats -->
      <text x="360" y="400" fill="${COLORS.text}" font-family="system-ui" font-size="28">🏠 ${properties} propiedades  ·  ⭐ ${rating} (${reviews} reseñas)</text>
      
      <!-- Kentra branding -->
      <rect x="360" y="460" width="180" height="60" rx="12" fill="${COLORS.primary}"/>
      <text x="450" y="500" text-anchor="middle" fill="white" font-family="system-ui" font-size="28" font-weight="700">KENTRA</text>
      
      <!-- URL -->
      <text x="1140" y="590" text-anchor="end" fill="${COLORS.muted}" font-family="system-ui" font-size="20">kentra.com.mx</text>
    </svg>
  `;
}

// Generar SVG para búsqueda
function generateSearchSVG(params: { estado?: string; municipio?: string; tipo?: string; listingType?: string; count?: number }): string {
  const { estado, municipio, tipo, listingType, count } = params;
  
  let title = "Propiedades";
  if (tipo) title = tipo.charAt(0).toUpperCase() + tipo.slice(1) + "s";
  if (listingType === "renta") title += " en Renta";
  else if (listingType === "venta") title += " en Venta";
  
  const location = [municipio, estado].filter(Boolean).join(", ") || "México";
  const countText = count ? `+${count} propiedades disponibles` : "Encuentra tu propiedad ideal";
  
  return `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#FAF9F6"/>
          <stop offset="100%" style="stop-color:#F0EDE8"/>
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="1200" height="630" fill="url(#bg)"/>
      
      <!-- Decorative icons -->
      <text x="100" y="180" fill="${COLORS.primary}" opacity="0.15" font-size="120">🏠</text>
      <text x="900" y="500" fill="${COLORS.primary}" opacity="0.15" font-size="100">🏢</text>
      <text x="1000" y="200" fill="${COLORS.primary}" opacity="0.1" font-size="80">🏡</text>
      
      <!-- Main content -->
      <text x="600" y="220" text-anchor="middle" fill="${COLORS.text}" font-family="system-ui" font-size="56" font-weight="700">${title}</text>
      <text x="600" y="300" text-anchor="middle" fill="${COLORS.primary}" font-family="system-ui" font-size="40" font-weight="500">en ${location}</text>
      <text x="600" y="380" text-anchor="middle" fill="${COLORS.muted}" font-family="system-ui" font-size="32">${countText}</text>
      
      <!-- Kentra branding -->
      <rect x="510" y="440" width="180" height="60" rx="12" fill="${COLORS.primary}"/>
      <text x="600" y="480" text-anchor="middle" fill="white" font-family="system-ui" font-size="28" font-weight="700">KENTRA</text>
      
      <!-- URL -->
      <text x="600" y="580" text-anchor="middle" fill="${COLORS.muted}" font-family="system-ui" font-size="20">kentra.com.mx</text>
    </svg>
  `;
}

// Generar SVG default
function generateDefaultSVG(): string {
  return `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#FAF9F6"/>
          <stop offset="100%" style="stop-color:#F0EDE8"/>
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="1200" height="630" fill="url(#bg)"/>
      
      <!-- Decorative icons -->
      <text x="150" y="200" fill="${COLORS.primary}" opacity="0.1" font-size="100">🏠</text>
      <text x="950" y="180" fill="${COLORS.primary}" opacity="0.1" font-size="80">🏢</text>
      <text x="100" y="480" fill="${COLORS.primary}" opacity="0.1" font-size="90">🏡</text>
      <text x="1000" y="500" fill="${COLORS.primary}" opacity="0.1" font-size="70">🏘️</text>
      
      <!-- Logo -->
      <rect x="460" y="180" width="280" height="100" rx="20" fill="${COLORS.primary}"/>
      <text x="600" y="250" text-anchor="middle" fill="white" font-family="system-ui" font-size="56" font-weight="800">KENTRA</text>
      
      <!-- Tagline -->
      <text x="600" y="340" text-anchor="middle" fill="${COLORS.text}" font-family="system-ui" font-size="36" font-weight="600">El Marketplace Inmobiliario</text>
      <text x="600" y="390" text-anchor="middle" fill="${COLORS.primary}" font-family="system-ui" font-size="36" font-weight="600">de México</text>
      
      <!-- Features -->
      <text x="600" y="480" text-anchor="middle" fill="${COLORS.muted}" font-family="system-ui" font-size="24">✓ Miles de propiedades  ·  ✓ Agentes certificados  ·  ✓ Búsqueda con mapa</text>
      
      <!-- URL -->
      <text x="600" y="560" text-anchor="middle" fill="${COLORS.muted}" font-family="system-ui" font-size="22">kentra.com.mx</text>
    </svg>
  `;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "default";
    const id = url.searchParams.get("id");

    console.log(`[og-image] Generating ${type} image${id ? ` for ${id}` : ""}`);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Generar cache key
    const cacheKey = type === "default" 
      ? "default.svg" 
      : `${type}-${id || url.searchParams.get("estado") || "generic"}.svg`;

    // Verificar si existe en cache
    const { data: cachedImage } = await supabaseClient
      .storage
      .from("og-images")
      .download(cacheKey);

    if (cachedImage) {
      console.log(`[og-image] Serving cached: ${cacheKey}`);
      const svgContent = await cachedImage.text();
      return new Response(svgContent, {
        headers: {
          ...corsHeaders,
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=604800", // 7 días
        },
      });
    }

    let svgContent: string;

    switch (type) {
      case "property": {
        if (!id) {
          svgContent = generateDefaultSVG();
          break;
        }

        const { data: property } = await supabaseClient
          .from("properties")
          .select("id, title, price, municipality, state, bedrooms, bathrooms, sqft, listing_type, type")
          .eq("id", id)
          .single();

        if (!property) {
          svgContent = generateDefaultSVG();
        } else {
          svgContent = generatePropertySVG(property);
        }
        break;
      }

      case "agent": {
        if (!id) {
          svgContent = generateDefaultSVG();
          break;
        }

        const { data: agent } = await supabaseClient
          .from("profiles")
          .select("id, name, city, state, avatar_url")
          .eq("id", id)
          .single();

        if (!agent) {
          svgContent = generateDefaultSVG();
        } else {
          // Fetch stats
          const { data: propertiesCount } = await supabaseClient
            .from("properties")
            .select("id", { count: "exact" })
            .eq("agent_id", id)
            .eq("status", "activa");

          const { data: reviewsData } = await supabaseClient
            .from("agent_reviews")
            .select("rating")
            .eq("agent_id", id);

          const avgRating = reviewsData?.length
            ? reviewsData.reduce((acc, r) => acc + r.rating, 0) / reviewsData.length
            : 0;

          const stats = {
            activeProperties: propertiesCount?.length || 0,
            averageRating: avgRating,
            totalReviews: reviewsData?.length || 0,
          };

          svgContent = generateAgentSVG(agent, stats);
        }
        break;
      }

      case "search": {
        const estado = url.searchParams.get("estado") || undefined;
        const municipio = url.searchParams.get("municipio") || undefined;
        const tipo = url.searchParams.get("tipo") || undefined;
        const listingType = url.searchParams.get("listingType") || undefined;

        // Get approximate count
        let query = supabaseClient
          .from("properties")
          .select("id", { count: "exact" })
          .eq("status", "activa");

        if (estado) query = query.ilike("state", `%${estado}%`);
        if (municipio) query = query.ilike("municipality", `%${municipio}%`);
        if (tipo) query = query.eq("type", tipo);
        if (listingType) query = query.eq("listing_type", listingType);

        const { count } = await query;

        svgContent = generateSearchSVG({
          estado,
          municipio,
          tipo,
          listingType,
          count: count || 0,
        });
        break;
      }

      default:
        svgContent = generateDefaultSVG();
    }

    // Guardar en cache
    const { error: uploadError } = await supabaseClient
      .storage
      .from("og-images")
      .upload(cacheKey, svgContent, {
        contentType: "image/svg+xml",
        upsert: true,
      });

    if (uploadError) {
      console.error("[og-image] Cache upload error:", uploadError);
    } else {
      console.log(`[og-image] Cached: ${cacheKey}`);
    }

    return new Response(svgContent, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=604800", // 7 días
      },
    });
  } catch (error) {
    console.error("[og-image] Error:", error);
    
    // Return default SVG on error
    const fallbackSVG = generateDefaultSVG();
    return new Response(fallbackSVG, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600", // 1 hora para errores
      },
    });
  }
});
