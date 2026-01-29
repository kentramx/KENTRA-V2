/**
 * SearchPropertyList - Scrollable list of property cards
 */

import { useMapStore } from '@/stores/mapStore';
import { SearchPropertyCard } from './SearchPropertyCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';

export function SearchPropertyList() {
  const {
    listProperties,
    totalCount,
    page,
    totalPages,
    setPage,
    isLoading,
    selectedPropertyId,
    setSelectedPropertyId,
    setHoveredPropertyId
  } = useMapStore();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card">
        <h2 className="font-semibold">
          {totalCount.toLocaleString()} propiedades encontradas
        </h2>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          // Loading skeletons
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 p-3 bg-card rounded-lg border">
              <Skeleton className="w-28 h-20 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))
        ) : listProperties.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <MapPin className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1">No hay propiedades</h3>
            <p className="text-sm text-muted-foreground max-w-[200px]">
              Intenta ajustar los filtros o ampliar el área de búsqueda
            </p>
          </div>
        ) : (
          // Property cards
          listProperties.map(property => (
            <SearchPropertyCard
              key={property.id}
              property={property}
              isSelected={property.id === selectedPropertyId}
              onSelect={() => setSelectedPropertyId(property.id)}
              onHoverStart={() => setHoveredPropertyId(property.id)}
              onHoverEnd={() => setHoveredPropertyId(null)}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-border bg-card flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>

          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
