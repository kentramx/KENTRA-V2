import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PropertyFilters, PropertySummary } from '@/types/property';

const ITEMS_PER_PAGE = 12;

interface QueryResult {
  properties: PropertySummary[];
  count: number | null;
}

export const usePropertiesInfinite = (
  filters: PropertyFilters,
  searchCoordinates: { lat: number; lng: number } | null = null
) => {
  const query = useInfiniteQuery({
    queryKey: ['properties-infinite', filters, searchCoordinates],
    initialPageParam: 0 as number,
    getNextPageParam: (lastPage: QueryResult, allPages: QueryResult[]) => {
      if (!lastPage.properties || lastPage.properties.length < ITEMS_PER_PAGE) return undefined;
      return allPages.length;
    },
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      console.log('🚀 [List] Buscando con filtros:', filters);

      let query = supabase
        .from('properties')
        .select('*', { count: 'exact' });

      // 1. STATUS: Filtrar solo propiedades activas
      query = query.eq('status', 'activa');

      // 2. UBICACIÓN (Flexible con ilike)
      if (filters.estado && filters.estado.trim() !== '') {
        query = query.ilike('state', `%${filters.estado}%`);
      }
      
      if (filters.municipio && filters.municipio.trim() !== '') {
        query = query.ilike('municipality', `%${filters.municipio}%`);
      }

      // ✅ Filtro por Colonia (buscar en colonia o address)
      if (filters.colonia && filters.colonia.trim() !== '') {
        // Buscar en la columna 'colonia' O en 'address' como fallback
        query = query.or(`colonia.ilike.%${filters.colonia.trim()}%,address.ilike.%${filters.colonia.trim()}%`);
      }

      // ✅ FILTRO DE PROXIMIDAD (Radio Dinámico)
      if (searchCoordinates && searchCoordinates.lat && searchCoordinates.lng) {
        const ROUGH_KM_DEGREE = 0.009; // ~1km
        let radiusKm = 10; // Default: Municipio/Ciudad
        
        // Si hay colonia específica, cerrar el radio
        if (filters.colonia && filters.colonia.trim() !== '') {
          console.log('🎯 Búsqueda por Colonia detectada, reduciendo radio a 3km');
          radiusKm = 3;
        } 
        // Si es búsqueda de Estado (sin municipio), ampliar radio
        else if (filters.estado && (!filters.municipio || filters.municipio === '')) {
          console.log('🌎 Búsqueda por Estado detectada, ampliando radio a 25km');
          radiusKm = 25; 
        }
        
        console.log(`📍 Filtrando coordenadas: Radio ${radiusKm}km`);
        const delta = ROUGH_KM_DEGREE * radiusKm;
        
        query = query
          .gte('lat', searchCoordinates.lat - delta)
          .lte('lat', searchCoordinates.lat + delta)
          .gte('lng', searchCoordinates.lng - delta)
          .lte('lng', searchCoordinates.lng + delta);
      }

      // 3. TIPO Y LISTING (Validar que no sea 'undefined')
      if (filters.tipo && filters.tipo !== '' && filters.tipo !== 'todos') {
        query = query.eq('type', filters.tipo as any);
      }

      // Asegurar que listingType tenga valor válido antes de filtrar
      if (filters.listingType && filters.listingType !== '' && filters.listingType !== 'undefined') {
        query = query.eq('listing_type', filters.listingType);
      }

      // 4. PRECIO (Manejo seguro de 0 y rangos)
      const minPrice = filters.precioMin ? Number(filters.precioMin) : 0;
      if (!isNaN(minPrice) && minPrice > 0) {
        query = query.gte('price', minPrice);
      }

      const maxPrice = filters.precioMax ? Number(filters.precioMax) : 0;
      // Solo filtrar máximo si es un valor razonable (no infinito)
      if (!isNaN(maxPrice) && maxPrice > 0 && maxPrice < 1000000000) {
        query = query.lte('price', maxPrice);
      }

      // 5. CARACTERÍSTICAS
      const bedrooms = filters.recamaras ? Number(filters.recamaras) : 0;
      if (bedrooms > 0) {
        query = query.gte('bedrooms', bedrooms);
      }

      const bathrooms = filters.banos ? Number(filters.banos) : 0;
      if (bathrooms > 0) {
        query = query.gte('bathrooms', bathrooms);
      }

      // 6. ORDENAMIENTO
      switch (filters.orden) {
        case 'price_asc':
          query = query.order('price', { ascending: true });
          break;
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'bedrooms_desc':
          query = query.order('bedrooms', { ascending: false });
          break;
        case 'sqft_desc':
          query = query.order('sqft', { ascending: false });
          break;
        case 'price_desc':
        default:
          query = query.order('price', { ascending: false });
          break;
      }

      // PAGINACIÓN
      const from = pageParam * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      
      if (error) {
        console.error('❌ Error en lista:', error);
        throw error;
      }

      // ✅ MAPEO DE DATOS (DB snake_case -> Frontend camelCase/PropertySummary)
      const mappedData: PropertySummary[] = (data || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        price: Number(p.price),
        currency: p.currency || 'MXN',
        type: p.type,
        listing_type: p.listing_type as 'venta' | 'renta',
        for_sale: p.for_sale ?? (p.listing_type === 'venta'),
        for_rent: p.for_rent ?? (p.listing_type === 'renta'),
        sale_price: p.sale_price || (p.listing_type === 'venta' ? p.price : null),
        rent_price: p.rent_price || (p.listing_type === 'renta' ? p.price : null),
        address: p.address || `${p.municipality}, ${p.state}`,
        colonia: p.colonia,
        municipality: p.municipality,
        state: p.state,
        lat: p.lat ? Number(p.lat) : null,
        lng: p.lng ? Number(p.lng) : null,
        bedrooms: Number(p.bedrooms) || 0,
        bathrooms: Number(p.bathrooms) || 0,
        parking: Number(p.parking) || 0,
        sqft: Number(p.sqft) || 0,
        agent_id: p.agent_id,
        created_at: p.created_at,
        images: Array.isArray(p.images) ? p.images : [],
        is_featured: p.is_featured || false
      }));

      return { properties: mappedData, count: count || 0 };
    },
  });

  // Extraer todas las propiedades de todas las páginas
  const allProperties = query.data?.pages.flatMap(page => page.properties) ?? [];
  const totalCount = query.data?.pages[0]?.count ?? 0;

  return {
    ...query,
    properties: allProperties,
    totalCount,
  };
};
