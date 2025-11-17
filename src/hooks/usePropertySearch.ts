/**
 * Hook centralizado para búsqueda de propiedades
 * Encapsula la lógica de obtención de datos y proporciona una interfaz limpia
 */

import { useMemo } from 'react';
import { usePropertiesInfinite } from './usePropertiesInfinite';
import type { PropertyFilters, PropertySummary } from '@/types/property';

const MAX_RESULTS = 300; // ✅ Límite para evitar sobrecarga

export interface UsePropertySearchResult {
  properties: PropertySummary[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  totalCount: number;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  hasTooManyResults: boolean; // ✅ Indica si hay más de MAX_RESULTS
  actualTotal: number; // ✅ Total real antes del límite
}

export const usePropertySearch = (filters: PropertyFilters): UsePropertySearchResult => {
  const {
    data: infiniteData,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
    error,
    totalCount: realTotalCount,
  } = usePropertiesInfinite(filters);

  // Construir arreglo plano de propiedades desde las páginas
  const allProperties = useMemo(
    () => infiniteData?.pages.flatMap((page) => page.properties) ?? [],
    [infiniteData]
  );

  // ✅ Aplicar límite de resultados
  const actualTotal = allProperties.length;
  const hasTooManyResults = actualTotal > MAX_RESULTS;
  const properties = useMemo(
    () => hasTooManyResults ? allProperties.slice(0, MAX_RESULTS) : allProperties,
    [allProperties, hasTooManyResults]
  );

  return {
    properties,
    isLoading,
    isFetching,
    error: error as Error | null,
    totalCount: realTotalCount, // ✅ Total real de propiedades disponibles
    hasNextPage: hasNextPage ?? false,
    fetchNextPage,
    hasTooManyResults,
    actualTotal,
  };
};
