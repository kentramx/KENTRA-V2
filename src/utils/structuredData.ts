/**
 * Utilidades para generar datos estructurados (schema.org) para SEO
 * 
 * Referencias:
 * - https://schema.org/RealEstateListing
 * - https://schema.org/Offer
 * - https://developers.google.com/search/docs/appearance/structured-data/product
 */

interface PropertyStructuredDataProps {
  id: string;
  title: string;
  description: string;
  price: number;
  currency?: string;
  type: string;
  listingType: 'venta' | 'renta';
  address: string;
  municipality: string;
  state: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  images?: string[];
  url: string;
  agentName?: string;
  agentPhone?: string;
}

/**
 * Genera JSON-LD para una propiedad inmobiliaria
 */
export function generatePropertyStructuredData(
  property: PropertyStructuredDataProps
): object {
  const propertyTypeMap: Record<string, string> = {
    casa: 'SingleFamilyResidence',
    departamento: 'Apartment',
    terreno: 'LandParcel',
    oficina: 'OfficeSpace',
    local: 'Store',
    bodega: 'Warehouse',
    edificio: 'Building',
    rancho: 'Farm',
  };

  const offerType = property.listingType === 'venta' ? 'SalePrice' : 'RentPrice';
  const priceSpecification = property.listingType === 'renta' 
    ? { unitText: 'MONTH', unitCode: 'MON' }
    : {};

  return {
    '@context': 'https://schema.org',
    '@type': propertyTypeMap[property.type] || 'Residence',
    '@id': property.url,
    name: property.title,
    description: property.description,
    address: {
      '@type': 'PostalAddress',
      streetAddress: property.address,
      addressLocality: property.municipality,
      addressRegion: property.state,
      addressCountry: 'MX',
    },
    ...(property.bedrooms && { numberOfRooms: property.bedrooms }),
    ...(property.bathrooms && { numberOfBathroomsTotal: property.bathrooms }),
    // sqft field contains square meters (despite the name) - using MTK for schema.org
    ...(property.sqft && { floorSize: { '@type': 'QuantitativeValue', value: property.sqft, unitCode: 'MTK' } }),
    offers: {
      '@type': 'Offer',
      priceCurrency: property.currency || 'MXN',
      price: property.price,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: property.price,
        priceCurrency: property.currency || 'MXN',
        ...priceSpecification,
      },
      availability: 'https://schema.org/InStock',
      priceValidUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 días
      url: property.url,
    },
    ...(property.images && property.images.length > 0 && {
      image: property.images.map(url => ({
        '@type': 'ImageObject',
        url,
        contentUrl: url,
      })),
    }),
    ...(property.agentName && {
      realEstateAgent: {
        '@type': 'RealEstateAgent',
        name: property.agentName,
        ...(property.agentPhone && { telephone: property.agentPhone }),
      },
    }),
  };
}

/**
 * Genera JSON-LD para la página principal
 */
export function generateWebsiteStructuredData(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Kentra',
    description: 'Plataforma inmobiliaria líder en México. Encuentra casas, departamentos, terrenos y propiedades comerciales en venta y renta.',
    url: window.location.origin,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${window.location.origin}/buscar?query={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Genera JSON-LD para organización (Kentra)
 */
export function generateOrganizationStructuredData(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Kentra',
    description: 'Plataforma inmobiliaria líder en México',
    url: window.location.origin,
    logo: `${window.location.origin}/pwa-512x512.png`,
    sameAs: [
      // Agregar redes sociales cuando estén disponibles
      // 'https://facebook.com/kentra',
      // 'https://twitter.com/kentra',
      // 'https://instagram.com/kentra',
    ],
  };
}

/**
 * Genera JSON-LD para breadcrumbs
 */
export function generateBreadcrumbStructuredData(
  breadcrumbs: { name: string; href: string }[]
): object {
  const siteUrl = window.location.origin;
  
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${siteUrl}${crumb.href}`,
    })),
  };
}

/**
 * Genera JSON-LD para perfil de agente inmobiliario
 */
export function generateAgentStructuredData(agent: {
  name: string;
  bio?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  profileUrl: string;
  propertiesCount?: number;
  avgRating?: number;
  reviewCount?: number;
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: agent.name,
    ...(agent.bio && { description: agent.bio }),
    ...(agent.phone && { telephone: agent.phone }),
    ...(agent.email && { email: agent.email }),
    ...(agent.city && agent.state && {
      address: {
        '@type': 'PostalAddress',
        addressLocality: agent.city,
        addressRegion: agent.state,
        addressCountry: 'MX',
      },
    }),
    url: agent.profileUrl,
    ...(agent.avgRating && agent.reviewCount && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: agent.avgRating,
        reviewCount: agent.reviewCount,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  };
}

/**
 * Genera JSON-LD para listado de propiedades (ItemList)
 */
export function generatePropertyListStructuredData(
  properties: Array<{
    id: string;
    title: string;
    price: number;
    url: string;
    image?: string;
  }>,
  listName: string = 'Propiedades en Kentra'
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    numberOfItems: properties.length,
    itemListElement: properties.map((property, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: property.title,
        offers: {
          '@type': 'Offer',
          price: property.price,
          priceCurrency: 'MXN',
        },
        url: property.url,
        ...(property.image && { image: property.image }),
      },
    })),
  };
}
