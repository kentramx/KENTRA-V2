/**
 * ✅ Utilidad centralizada para construir PropertyFilters
 * Evita duplicación entre lista y mapa
 */

import type { PropertyFilters } from '@/types/property';

export interface RawSearchFilters {
  estado?: string;
  municipio?: string;
  precioMin?: string;
  precioMax?: string;
  tipo?: string;
  listingType?: string;
  recamaras?: string;
  banos?: string;
}

export function buildPropertyFilters(filters: RawSearchFilters): PropertyFilters {
  return {
    estado: filters.estado && filters.estado !== 'all' ? filters.estado : undefined,
    municipio: filters.municipio && filters.municipio !== 'all' ? filters.municipio : undefined,
    tipo: filters.tipo && filters.tipo !== 'all' ? filters.tipo : undefined,
    listingType: filters.listingType && filters.listingType !== 'all' ? filters.listingType : undefined,
    precioMin: filters.precioMin ? parseFloat(filters.precioMin) : undefined,
    precioMax: filters.precioMax ? parseFloat(filters.precioMax) : undefined,
    recamaras: filters.recamaras && filters.recamaras !== 'all' ? filters.recamaras : undefined,
    banos: filters.banos && filters.banos !== 'all' ? filters.banos : undefined,
    status: ['activa'],
  };
}
