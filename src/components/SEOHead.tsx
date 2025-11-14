import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogType?: 'website' | 'article' | 'product';
  ogImage?: string;
  ogUrl?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  noindex?: boolean;
  structuredData?: object;
}

/**
 * Componente centralizado para gestión de metadatos SEO
 * 
 * Implementa:
 * - Title y description dinámicos
 * - Open Graph tags para redes sociales
 * - Twitter Cards
 * - Canonical URLs
 * - Datos estructurados (JSON-LD)
 */
export const SEOHead = ({
  title,
  description,
  canonical,
  ogType = 'website',
  ogImage,
  ogUrl,
  twitterCard = 'summary_large_image',
  noindex = false,
  structuredData,
}: SEOHeadProps) => {
  // Asegurar que el título tenga límite de 60 caracteres para SEO
  const truncatedTitle = title.length > 60 ? title.substring(0, 57) + '...' : title;
  
  // Asegurar que la descripción tenga límite de 160 caracteres
  const truncatedDescription = description.length > 160 
    ? description.substring(0, 157) + '...' 
    : description;

  // URL base del sitio
  const siteUrl = window.location.origin;
  const fullCanonical = canonical ? `${siteUrl}${canonical}` : window.location.href;
  const fullOgUrl = ogUrl || fullCanonical;
  const defaultOgImage = `${siteUrl}/pwa-512x512.png`;
  const fullOgImage = ogImage || defaultOgImage;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{truncatedTitle}</title>
      <meta name="description" content={truncatedDescription} />
      {canonical && <link rel="canonical" href={fullCanonical} />}
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      {/* Open Graph Tags */}
      <meta property="og:title" content={truncatedTitle} />
      <meta property="og:description" content={truncatedDescription} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={fullOgUrl} />
      <meta property="og:image" content={fullOgImage} />
      <meta property="og:site_name" content="Kentra" />
      <meta property="og:locale" content="es_MX" />

      {/* Twitter Card Tags */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={truncatedTitle} />
      <meta name="twitter:description" content={truncatedDescription} />
      <meta name="twitter:image" content={fullOgImage} />

      {/* Structured Data (JSON-LD) */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
};
