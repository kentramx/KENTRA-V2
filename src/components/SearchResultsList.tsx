/**
 * ✅ Componente de lista de resultados optimizado
 * - Memoización de cálculos pesados
 * - Paginación eficiente
 * - Manejo de estados de carga y vacío
 */

import React, { useMemo, useCallback, useRef } from 'react';
import { Star, AlertCircle } from 'lucide-react';
import PropertyCard from '@/components/PropertyCard';
import { PropertyStats } from '@/components/PropertyStats';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Property, MapProperty } from '@/types/property';

interface SearchResultsListProps {
  properties: Property[];
  isLoading: boolean;
  listingType: string;
  currentPage: number;
  propertiesPerPage: number;
  onPropertyClick: (id: string) => void;
  onPropertyHover?: (property: MapProperty | null) => void;
  savedSearchesCount?: number;
  onScrollToSavedSearches?: () => void;
}

export const SearchResultsList: React.FC<SearchResultsListProps> = React.memo(
  ({
    properties,
    isLoading,
    listingType,
    currentPage,
    propertiesPerPage,
    onPropertyClick,
    onPropertyHover,
    savedSearchesCount = 0,
    onScrollToSavedSearches,
  }) => {
    const propertyCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // ✅ Memoizar propiedades paginadas y ordenadas
    const { paginatedProperties, featuredCount } = useMemo(() => {
      const startIndex = (currentPage - 1) * propertiesPerPage;
      const endIndex = startIndex + propertiesPerPage;
      const paginated = properties.slice(startIndex, endIndex);
      const featured = paginated.filter((p) => p.is_featured).length;
      return { paginatedProperties: paginated, featuredCount: featured };
    }, [properties, currentPage, propertiesPerPage]);

    // ✅ Callback memoizado para hover
    const handlePropertyHover = useCallback(
      (property: Property | null) => {
        if (onPropertyHover && property) {
          onPropertyHover({
            id: property.id,
            title: property.title,
            price: property.price,
            currency: property.currency,
            lat: property.lat || 0,
            lng: property.lng || 0,
            type: property.type,
            listing_type: property.listing_type,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            parking: property.parking,
            sqft: property.sqft,
            address: property.address,
            state: property.state,
            municipality: property.municipality,
            images: property.images,
            agent_id: property.agent_id,
            status: property.status,
            is_featured: property.is_featured,
            created_at: property.created_at,
          });
        } else if (onPropertyHover) {
          onPropertyHover(null);
        }
      },
      [onPropertyHover]
    );

    return (
      <div className="p-4 space-y-4">
        {/* Stats */}
        <PropertyStats properties={properties} listingType={listingType} />

        {/* Búsquedas guardadas - compacto */}
        {savedSearchesCount > 0 && (
          <Card>
            <CardContent className="p-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
                onClick={onScrollToSavedSearches}
              >
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {savedSearchesCount} búsqueda
                    {savedSearchesCount !== 1 ? 's' : ''} guardada
                    {savedSearchesCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-[4/3] bg-muted" />
                <CardContent className="p-3 space-y-2">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : properties.length === 0 ? (
          // Empty state
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No encontramos propiedades con estos filtros.
              </p>
            </CardContent>
          </Card>
        ) : (
          // Property cards
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {paginatedProperties.map((property, index) => {
              const isFeatured = property.is_featured;
              const prevProperty = paginatedProperties[index - 1];
              const isFirstRegular = index > 0 && prevProperty?.is_featured && !isFeatured;

              return (
                <React.Fragment key={property.id}>
                  {/* Separador entre destacadas y regulares */}
                  {isFirstRegular && (
                    <div className="col-span-1 md:col-span-2">
                      <div className="flex items-center gap-3 py-4">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Star className="h-4 w-4" />
                          <span>Más propiedades</span>
                        </div>
                        <div className="h-px flex-1 bg-gradient-to-r from-border via-transparent to-transparent" />
                      </div>
                    </div>
                  )}

                  {/* Property card */}
                  <div
                    ref={(el) => {
                      if (el) {
                        propertyCardRefs.current.set(property.id, el);
                      } else {
                        propertyCardRefs.current.delete(property.id);
                      }
                    }}
                    onMouseEnter={() => handlePropertyHover(property)}
                    onMouseLeave={() => handlePropertyHover(null)}
                  >
                    <PropertyCard
                      id={property.id}
                      title={property.title}
                      price={property.price}
                      type={property.type}
                      listingType={property.listing_type}
                      for_sale={property.for_sale}
                      for_rent={property.for_rent}
                      sale_price={property.sale_price}
                      rent_price={property.rent_price}
                      currency={property.currency}
                      address={property.address}
                      colonia={property.colonia}
                      municipality={property.municipality}
                      state={property.state}
                      bedrooms={property.bedrooms}
                      bathrooms={property.bathrooms}
                      parking={property.parking}
                      sqft={property.sqft}
                      images={property.images}
                      agentId={property.agent_id}
                      isFeatured={property.is_featured}
                      createdAt={property.created_at}
                      onCardClick={onPropertyClick}
                    />
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

SearchResultsList.displayName = 'SearchResultsList';
