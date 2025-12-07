/**
 * ✅ Utilidad centralizada para construir PropertyFilters
 * Evita duplicación entre lista y mapa
 */

import type { PropertyFilters } from '@/types/property';

export interface RawSearchFilters {
  estado?: string;
  municipio?: string;
  colonia?: string;
  precioMin?: string;
  precioMax?: string;
  tipo?: string;
  listingType?: string;
  recamaras?: string;
  banos?: string;
  orden?: string;
}

export function buildPropertyFilters(filters: RawSearchFilters): PropertyFilters {
  return {
    estado: filters.estado || undefined,
    municipio: filters.municipio || undefined,
    colonia: filters.colonia || undefined,
    tipo: filters.tipo || undefined,
    listingType: filters.listingType || undefined,
    precioMin: filters.precioMin ? parseFloat(filters.precioMin) : undefined,
    precioMax: filters.precioMax ? parseFloat(filters.precioMax) : undefined,
    recamaras: filters.recamaras || undefined,
    banos: filters.banos || undefined,
    orden: filters.orden || undefined,
    status: ['activa'],
  };
}
