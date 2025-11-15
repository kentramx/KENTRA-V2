import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const baseUrl = Deno.env.get('SITE_URL') || 'https://kentramx-main.lovable.app';

    const url = new URL(req.url);
    const sitemapIndex = url.searchParams.get('index');

    // Contar total de propiedades activas
    const { count: totalProperties } = await supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'activa');

    const total = totalProperties || 0;
    const maxUrlsPerSitemap = 50000;
    const needsIndex = total > maxUrlsPerSitemap;

    // Si necesitamos índice y no se especificó cuál sitemap, devolver el índice
    if (needsIndex && !sitemapIndex) {
      const numSitemaps = Math.ceil(total / maxUrlsPerSitemap);
      
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      
      // Sitemap 0 contiene páginas estáticas
      xml += '  <sitemap>\n';
      xml += `    <loc>${baseUrl}/api/sitemap?index=0</loc>\n`;
      xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
      xml += '  </sitemap>\n';

      // Sitemaps 1+ contienen propiedades
      for (let i = 1; i <= numSitemaps; i++) {
        xml += '  <sitemap>\n';
        xml += `    <loc>${baseUrl}/api/sitemap?index=${i}</loc>\n`;
        xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
        xml += '  </sitemap>\n';
      }

      xml += '</sitemapindex>';

      return new Response(xml, {
        headers: corsHeaders,
        status: 200,
      });
    }

    // Generar sitemap específico
    const currentIndex = parseInt(sitemapIndex || '0');
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // El sitemap 0 contiene páginas estáticas
    if (currentIndex === 0) {
      // Home
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/</loc>\n`;
      xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
      xml += '    <changefreq>daily</changefreq>\n';
      xml += '    <priority>1.0</priority>\n';
      xml += '  </url>\n';

      // Búsqueda
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/buscar</loc>\n`;
      xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
      xml += '    <changefreq>daily</changefreq>\n';
      xml += '    <priority>0.9</priority>\n';
      xml += '  </url>\n';

      // Páginas de pricing
      const pricingPages = [
        '/pricing-agente',
        '/pricing-inmobiliaria',
        '/pricing-desarrolladora',
      ];

      for (const page of pricingPages) {
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}${page}</loc>\n`;
        xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
        xml += '    <changefreq>monthly</changefreq>\n';
        xml += '    <priority>0.7</priority>\n';
        xml += '  </url>\n';
      }

      // Directorio de agentes
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/directorio-agentes</loc>\n`;
      xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '  </url>\n';
    } else {
      // Sitemaps 1+ contienen propiedades (50k cada uno)
      const offset = (currentIndex - 1) * maxUrlsPerSitemap;
      
      const { data: properties, error } = await supabase
        .from('properties')
        .select('id, updated_at')
        .eq('status', 'activa')
        .order('updated_at', { ascending: false })
        .range(offset, offset + maxUrlsPerSitemap - 1);

      if (error) throw error;

      for (const property of properties || []) {
        const lastmod = property.updated_at 
          ? new Date(property.updated_at).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/property/${property.id}</loc>\n`;
        xml += `    <lastmod>${lastmod}</lastmod>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.8</priority>\n';
        xml += '  </url>\n';
      }
    }

    xml += '</urlset>';

    return new Response(xml, {
      headers: corsHeaders,
      status: 200,
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
