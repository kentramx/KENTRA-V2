/**
 * ✅ Hook centralizado para búsqueda de propiedades
 * - Única fuente de verdad para filtros
 * - Sincronización automática con URL
 * - Validación y normalización de filtros
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PropertyFilters } from '@/types/property';

export interface SearchFilters {
  estado: string;
  municipio: string;
  precioMin: string;
  precioMax: string;
  tipo: string;
  listingType: string;
  recamaras: string;
  banos: string;
  orden: 'price_desc' | 'price_asc' | 'newest' | 'oldest' | 'bedrooms_desc' | 'sqft_desc';
}

const DEFAULT_FILTERS: SearchFilters = {
  estado: '',
  municipio: '',
  tipo: '',
  listingType: '',
  precioMin: '',
  precioMax: '',
  recamaras: '',
  banos: '',
  orden: 'price_desc',
};

/**
 * Convierte SearchFilters a PropertyFilters para queries de Supabase
 */
export function buildPropertyFilters(filters: SearchFilters): PropertyFilters {
  return {
    estado: filters.estado || undefined,
    municipio: filters.municipio || undefined,
    tipo: filters.tipo || undefined,
    listingType: filters.listingType || undefined,
    precioMin: filters.precioMin ? parseFloat(filters.precioMin) : undefined,
    precioMax: filters.precioMax ? parseFloat(filters.precioMax) : undefined,
    recamaras: filters.recamaras || undefined,
    banos: filters.banos || undefined,
    status: ['activa'],
  };
}

/**
 * Parsea filtros desde URL params
 */
function parseFiltersFromURL(searchParams: URLSearchParams): Partial<SearchFilters> {
  const parsed: Partial<SearchFilters> = {};
  
  // Location
  const estado = searchParams.get('estado');
  if (estado) parsed.estado = estado;
  
  const municipio = searchParams.get('municipio');
  if (municipio) parsed.municipio = municipio;
  
  // Property type
  const tipo = searchParams.get('tipo');
  if (tipo) parsed.tipo = tipo;
  
  // Listing type
  const listingType = searchParams.get('listingType');
  if (listingType) parsed.listingType = listingType;
  
  // Price range
  const precioMin = searchParams.get('precioMin');
  if (precioMin && !isNaN(parseFloat(precioMin))) {
    parsed.precioMin = precioMin;
  }
  
  const precioMax = searchParams.get('precioMax');
  if (precioMax && !isNaN(parseFloat(precioMax))) {
    parsed.precioMax = precioMax;
  }
  
  // Bedrooms & Bathrooms
  const recamaras = searchParams.get('recamaras');
  if (recamaras) parsed.recamaras = recamaras;
  
  const banos = searchParams.get('banos');
  if (banos) parsed.banos = banos;
  
  // Order
  const orden = searchParams.get('orden');
  if (orden && ['price_desc', 'price_asc', 'newest', 'oldest', 'bedrooms_desc', 'sqft_desc'].includes(orden)) {
    parsed.orden = orden as SearchFilters['orden'];
  }
  
  return parsed;
}

/**
 * Convierte filtros a URL params
 */
function filtersToURLParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  
  if (filters.estado) params.set('estado', filters.estado);
  if (filters.municipio) params.set('municipio', filters.municipio);
  if (filters.tipo) params.set('tipo', filters.tipo);
  if (filters.listingType) params.set('listingType', filters.listingType);
  if (filters.precioMin) params.set('precioMin', filters.precioMin);
  if (filters.precioMax) params.set('precioMax', filters.precioMax);
  if (filters.recamaras) params.set('recamaras', filters.recamaras);
  if (filters.banos) params.set('banos', filters.banos);
  
  if (filters.orden !== DEFAULT_FILTERS.orden) {
    params.set('orden', filters.orden);
  }
  
  return params;
}

export function usePropertySearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Inicializar filtros desde URL o usar defaults
  const [filters, setFilters] = useState<SearchFilters>(() => {
    const urlFilters = parseFiltersFromURL(searchParams);
    return { ...DEFAULT_FILTERS, ...urlFilters };
  });
  
  // Sincronizar cambios de filtros con URL
  useEffect(() => {
    const newParams = filtersToURLParams(filters);
    
    // Solo actualizar si hay cambios
    if (newParams.toString() !== searchParams.toString()) {
      setSearchParams(newParams, { replace: true });
    }
  }, [filters, searchParams, setSearchParams]);
  
  // Convertir a PropertyFilters para queries
  const propertyFilters = useMemo(() => buildPropertyFilters(filters), [filters]);
  
  // Resetear todos los filtros
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);
  
  // Contar filtros activos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.estado) count++;
    if (filters.municipio) count++;
    if (filters.tipo) count++;
    if (filters.listingType) count++;
    if (filters.precioMin) count++;
    if (filters.precioMax) count++;
    if (filters.recamaras) count++;
    if (filters.banos) count++;
    return count;
  }, [filters]);
  
  return {
    filters,
    setFilters,
    propertyFilters,
    resetFilters,
    activeFiltersCount,
  };
}
