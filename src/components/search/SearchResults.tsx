import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ChevronDown } from 'lucide-react';
import PropertyCard from '@/components/PropertyCard';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import type { Property } from '@/types/property';

interface SearchResultsProps {
  properties: Property[];
  isLoading: boolean;
  error: Error | null;
  totalProperties: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPropertyHover: (propertyId: string | null) => void;
  onPropertyClick: (propertyId: string) => void;
  hoveredPropertyId: string | null;
}

export const SearchResults = ({
  properties,
  isLoading,
  error,
  totalProperties,
  currentPage,
  totalPages,
  onPageChange,
  onPropertyHover,
  onPropertyClick,
  hoveredPropertyId,
}: SearchResultsProps) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex gap-4">
                <Skeleton className="w-48 h-32" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Error al cargar las propiedades: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (properties.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No se encontraron propiedades</h3>
          <p className="text-muted-foreground">
            Intenta ajustar tus filtros de búsqueda para ver más resultados
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header con contador */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          <AnimatedCounter value={totalProperties} /> propiedades encontradas
        </h2>
      </div>

      {/* Lista de propiedades */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
        {properties.map((property) => (
          <div
            key={property.id}
            onMouseEnter={() => onPropertyHover(property.id)}
            onMouseLeave={() => onPropertyHover(null)}
            onClick={() => onPropertyClick(property.id)}
            className={`transition-all ${
              hoveredPropertyId === property.id ? 'ring-2 ring-primary rounded-lg' : ''
            }`}
          >
            <PropertyCard
              id={property.id}
              title={property.title}
              price={property.price}
              bedrooms={property.bedrooms}
              bathrooms={property.bathrooms}
              parking={property.parking}
              images={property.images}
              address={property.address}
              state={property.state}
              municipality={property.municipality}
              type={property.type}
              listingType={property.listing_type}
              isFeatured={property.is_featured}
              agentId={property.agent_id}
            />
          </div>
        ))}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Anterior
          </Button>
          
          <div className="flex items-center gap-2">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? 'default' : 'outline'}
                  onClick={() => onPageChange(pageNum)}
                  size="sm"
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
};
