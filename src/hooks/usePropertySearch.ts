/**
 * Hook centralizado para búsqueda de propiedades
 * Encapsula la lógica de obtención de datos y proporciona una interfaz limpia
 */

import { useMemo } from 'react';
import { usePropertiesInfinite } from './usePropertiesInfinite';
import type { PropertyFilters, PropertySummary } from '@/types/property';

export interface UsePropertySearchResult {
  properties: PropertySummary[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  totalCount: number;
  hasNextPage: boolean;
  fetchNextPage: () => void;
}

export const usePropertySearch = (filters: PropertyFilters): UsePropertySearchResult => {
  const {
    data: infiniteData,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
    error,
  } = usePropertiesInfinite(filters);

  // Construir arreglo plano de propiedades desde las páginas
  const properties = useMemo(
    () => infiniteData?.pages.flatMap((page) => page.properties) ?? [],
    [infiniteData]
  );

  const totalCount = properties.length;

  return {
    properties,
    isLoading,
    isFetching,
    error: error as Error | null,
    totalCount,
    hasNextPage: hasNextPage ?? false,
    fetchNextPage,
  };
};
