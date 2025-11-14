/**
 * Utilidades para generación de títulos y descripciones SEO-optimizados
 */

/**
 * Genera un título SEO para una propiedad
 * Formato: [Tipo] en [Ubicación] - [Precio] | Kentra
 */
export function generatePropertyTitle(property: {
  type: string;
  municipality: string;
  state: string;
  price: number;
  bedrooms?: number;
  listingType: string;
}): string {
  const typeLabels: Record<string, string> = {
    casa: 'Casa',
    departamento: 'Departamento',
    terreno: 'Terreno',
    oficina: 'Oficina',
    local: 'Local Comercial',
    bodega: 'Bodega',
    edificio: 'Edificio',
    rancho: 'Rancho',
  };

  const typeLabel = typeLabels[property.type] || 'Propiedad';
  const actionLabel = property.listingType === 'venta' ? 'en Venta' : 'en Renta';
  const priceFormatted = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(property.price);

  const bedroomInfo = property.bedrooms ? ` ${property.bedrooms} Rec` : '';

  // "[Tipo] en [Ciudad], [Estado] - [Precio] | Kentra"
  const title = `${typeLabel} ${actionLabel} en ${property.municipality}, ${property.state}${bedroomInfo} - ${priceFormatted}`;
  
  // Truncar a 60 caracteres si es necesario
  return title.length > 60 ? title.substring(0, 57) + '...' : title;
}

/**
 * Genera una descripción SEO para una propiedad
 */
export function generatePropertyDescription(property: {
  type: string;
  municipality: string;
  state: string;
  price: number;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  listingType: string;
  description?: string;
}): string {
  const typeLabels: Record<string, string> = {
    casa: 'casa',
    departamento: 'departamento',
    terreno: 'terreno',
    oficina: 'oficina',
    local: 'local comercial',
    bodega: 'bodega',
    edificio: 'edificio',
    rancho: 'rancho',
  };

  const typeLabel = typeLabels[property.type] || 'propiedad';
  const actionLabel = property.listingType === 'venta' ? 'en venta' : 'en renta';
  
  const priceFormatted = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(property.price);

  const features = [];
  if (property.bedrooms) features.push(`${property.bedrooms} recámaras`);
  if (property.bathrooms) features.push(`${property.bathrooms} baños`);
  if (property.sqft) features.push(`${property.sqft} m²`);

  const featuresText = features.length > 0 ? ` con ${features.join(', ')}` : '';

  // Usar inicio de la descripción si existe, sino generar una
  let description = property.description 
    ? property.description.substring(0, 100)
    : `Excelente ${typeLabel} ${actionLabel} en ${property.municipality}, ${property.state}${featuresText}. Precio: ${priceFormatted}.`;

  // Truncar a 160 caracteres
  return description.length > 160 ? description.substring(0, 157) + '...' : description;
}

/**
 * Genera un título SEO para página de búsqueda
 */
export function generateSearchTitle(filters: {
  estado?: string;
  municipio?: string;
  tipo?: string;
  listingType?: string;
}): string {
  const parts = [];
  
  if (filters.tipo && filters.tipo !== 'all') {
    const typeLabels: Record<string, string> = {
      casa: 'Casas',
      departamento: 'Departamentos',
      terreno: 'Terrenos',
      oficina: 'Oficinas',
      local: 'Locales Comerciales',
      bodega: 'Bodegas',
      edificio: 'Edificios',
      rancho: 'Ranchos',
    };
    parts.push(typeLabels[filters.tipo] || 'Propiedades');
  } else {
    parts.push('Propiedades');
  }

  const action = filters.listingType === 'renta' ? 'en Renta' : 'en Venta';
  parts.push(action);

  if (filters.municipio) {
    parts.push(`en ${filters.municipio}`);
  } else if (filters.estado) {
    parts.push(`en ${filters.estado}`);
  }

  parts.push('| Kentra');

  return parts.join(' ');
}

/**
 * Genera una descripción SEO para página de búsqueda
 */
export function generateSearchDescription(filters: {
  estado?: string;
  municipio?: string;
  tipo?: string;
  listingType?: string;
  resultCount?: number;
}): string {
  const typeLabels: Record<string, string> = {
    casa: 'casas',
    departamento: 'departamentos',
    terreno: 'terrenos',
    oficina: 'oficinas',
    local: 'locales comerciales',
    bodega: 'bodegas',
    edificio: 'edificios',
    rancho: 'ranchos',
  };

  const typeText = filters.tipo && filters.tipo !== 'all' 
    ? typeLabels[filters.tipo] || 'propiedades'
    : 'propiedades';

  const action = filters.listingType === 'renta' ? 'en renta' : 'en venta';
  
  let location = '';
  if (filters.municipio) {
    location = `en ${filters.municipio}, ${filters.estado || 'México'}`;
  } else if (filters.estado) {
    location = `en ${filters.estado}`;
  } else {
    location = 'en México';
  }

  const countText = filters.resultCount ? `${filters.resultCount} ` : '';

  return `Encuentra ${countText}${typeText} ${action} ${location}. Compara precios, ubicaciones y características. Contacta directamente con agentes certificados en Kentra.`;
}

/**
 * Genera un título SEO para perfil de agente
 */
export function generateAgentTitle(agent: {
  name: string;
  city?: string;
  state?: string;
}): string {
  const location = agent.city && agent.state 
    ? ` en ${agent.city}, ${agent.state}`
    : agent.state 
    ? ` en ${agent.state}`
    : '';

  return `${agent.name} - Agente Inmobiliario${location} | Kentra`;
}

/**
 * Genera descripción SEO para perfil de agente
 */
export function generateAgentDescription(agent: {
  name: string;
  bio?: string;
  propertiesCount?: number;
  city?: string;
  state?: string;
}): string {
  const location = agent.city && agent.state 
    ? ` en ${agent.city}, ${agent.state}`
    : '';
  
  const propCount = agent.propertiesCount 
    ? ` Con ${agent.propertiesCount} propiedades disponibles.`
    : '';

  const bio = agent.bio 
    ? agent.bio.substring(0, 80)
    : `Agente inmobiliario certificado${location}.`;

  return `${bio}${propCount} Contacta con ${agent.name} para comprar, vender o rentar propiedades en Kentra.`;
}
