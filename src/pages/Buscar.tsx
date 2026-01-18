/**
 * Página de búsqueda estilo Zillow
 * Arquitectura limpia: ~400 líneas
 * - Hooks separados para mapa y lista
 * - Estado mínimo derivado de URL
 * - Sin useEffects problemáticos
 */

import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchMap } from '@/components/maps/SearchMap';
import { useMapClusters } from '@/hooks/useMapClusters';
import { usePropertySearch } from '@/hooks/usePropertySearch';
import { useFavorites } from '@/hooks/useFavorites';
import PropertyCard from '@/components/PropertyCard';
import { PropertyCardSkeleton } from '@/components/PropertyCardSkeleton';
import { PropertyDetailSheet } from '@/components/PropertyDetailSheet';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapIcon, List, Loader2, SlidersHorizontal, X, Home, Building2, TreePine } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MapViewport, MapFilters } from '@/types/map';

// Viewport inicial (México)
const INITIAL_VIEWPORT: MapViewport = {
  center: { lat: 23.6345, lng: -102.5528 },
  zoom: 5,
  bounds: {
    north: 32.72,
    south: 14.53,
    east: -86.7,
    west: -118.4,
  },
};

// Tipos de propiedad
const PROPERTY_TYPES = [
  { value: 'all', label: 'Todos', icon: Home },
  { value: 'casa', label: 'Casa', icon: Home },
  { value: 'departamento', label: 'Departamento', icon: Building2 },
  { value: 'terreno', label: 'Terreno', icon: TreePine },
];

export default function Buscar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { favorites, toggleFavorite } = useFavorites();

  // Estado del mapa
  const [viewport, setViewport] = useState<MapViewport>(INITIAL_VIEWPORT);
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);

  // Estado de UI
  const [mobileView, setMobileView] = useState<'map' | 'list'>('list');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Filtros desde URL
  const filters: MapFilters = useMemo(() => ({
    listing_type: (searchParams.get('operacion') as 'venta' | 'renta') || 'venta',
    property_type: searchParams.get('tipo') || undefined,
    min_price: searchParams.get('precioMin') ? Number(searchParams.get('precioMin')) : undefined,
    max_price: searchParams.get('precioMax') ? Number(searchParams.get('precioMax')) : undefined,
    min_bedrooms: searchParams.get('recamaras') ? Number(searchParams.get('recamaras')) : undefined,
    state: searchParams.get('estado') || undefined,
    municipality: searchParams.get('municipio') || undefined,
  }), [searchParams]);

  // Datos del mapa (clusters + propiedades visibles)
  const {
    clusters,
    properties: mapProperties,
    total: mapTotal,
    isClustered,
    isLoading: mapLoading,
    isFetching: mapFetching,
  } = useMapClusters({ viewport, filters });

  // Datos de la lista (paginados, sincronizados con viewport)
  const {
    properties: listProperties,
    total: listTotal,
    totalPages,
    isLoading: listLoading,
    isFetching: listFetching,
    hasNextPage,
  } = usePropertySearch({
    filters,
    bounds: viewport.bounds,
    page,
    limit: 20,
  });

  // Handlers
  const handleViewportChange = useCallback((newViewport: MapViewport) => {
    setViewport(newViewport);
    setPage(1); // Reset página al mover mapa
  }, []);

  const handlePropertyClick = useCallback((id: string) => {
    setSelectedPropertyId(id);
    setSheetOpen(true);
  }, []);

  const handleFilterChange = useCallback((key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params, { replace: true });
    setPage(1);
  }, [searchParams, setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams({ operacion: 'venta' }, { replace: true });
    setPage(1);
  }, [setSearchParams]);

  // Contar filtros activos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.property_type) count++;
    if (filters.min_price) count++;
    if (filters.max_price) count++;
    if (filters.min_bedrooms) count++;
    if (filters.state) count++;
    if (filters.municipality) count++;
    return count;
  }, [filters]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="pt-16">
        {/* Barra de filtros */}
        <div className="sticky top-16 z-30 border-b bg-background">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Tipo de operación */}
              <Select
                value={filters.listing_type || 'venta'}
                onValueChange={(v) => handleFilterChange('operacion', v)}
              >
                <SelectTrigger className="w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="venta">Venta</SelectItem>
                  <SelectItem value="renta">Renta</SelectItem>
                </SelectContent>
              </Select>

              {/* Tipo de propiedad */}
              <Select
                value={filters.property_type || 'all'}
                onValueChange={(v) => handleFilterChange('tipo', v)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Recámaras */}
              <Select
                value={filters.min_bedrooms?.toString() || 'any'}
                onValueChange={(v) => handleFilterChange('recamaras', v === 'any' ? undefined : v)}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Recámaras" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Cualquier</SelectItem>
                  <SelectItem value="1">1+ recámara</SelectItem>
                  <SelectItem value="2">2+ recámaras</SelectItem>
                  <SelectItem value="3">3+ recámaras</SelectItem>
                  <SelectItem value="4">4+ recámaras</SelectItem>
                </SelectContent>
              </Select>

              {/* Más filtros (móvil) */}
              <Button variant="outline" size="sm" className="lg:hidden">
                <SlidersHorizontal className="h-4 w-4 mr-1" />
                Filtros {activeFiltersCount > 0 && `(${activeFiltersCount})`}
              </Button>

              {/* Limpiar filtros */}
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Limpiar
                </Button>
              )}

              {/* Contador de resultados */}
              <div className="ml-auto text-sm text-muted-foreground hidden sm:block">
                {listLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando...
                  </span>
                ) : (
                  <span>
                    <strong className="text-foreground">{listTotal.toLocaleString()}</strong> propiedades
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Layout principal */}
        <div className="flex flex-col lg:flex-row" style={{ height: 'calc(100vh - 140px)' }}>
          {/* Toggle móvil */}
          <div className="lg:hidden sticky top-[140px] z-20 bg-background border-b p-2">
            <div className="flex gap-2">
              <Button
                variant={mobileView === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMobileView('list')}
                className="flex-1"
              >
                <List className="h-4 w-4 mr-2" />
                Lista ({listTotal})
              </Button>
              <Button
                variant={mobileView === 'map' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMobileView('map')}
                className="flex-1"
              >
                <MapIcon className="h-4 w-4 mr-2" />
                Mapa
              </Button>
            </div>
          </div>

          {/* Mapa */}
          <div
            className={cn(
              'lg:w-1/2 lg:h-full',
              mobileView === 'map' ? 'h-[calc(100vh-200px)]' : 'hidden lg:block'
            )}
          >
            <SearchMap
              properties={mapProperties}
              clusters={clusters}
              totalCount={mapTotal}
              isClustered={isClustered}
              isLoading={mapLoading}
              isFetching={mapFetching}
              hoveredPropertyId={hoveredPropertyId}
              selectedPropertyId={selectedPropertyId}
              onPropertyClick={handlePropertyClick}
              onPropertyHover={(p) => setHoveredPropertyId(p?.id || null)}
              onViewportChange={handleViewportChange}
            />
          </div>

          {/* Lista */}
          <div
            className={cn(
              'lg:w-1/2 lg:h-full overflow-y-auto',
              mobileView === 'list' ? 'flex-1' : 'hidden lg:block'
            )}
          >
            {/* Contador móvil */}
            <div className="px-4 py-3 border-b sticky top-0 bg-background z-10 sm:hidden">
              <p className="text-sm text-muted-foreground">
                {listLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando...
                  </span>
                ) : (
                  <>
                    <span className="font-medium text-foreground">{listTotal.toLocaleString()}</span> propiedades
                  </>
                )}
              </p>
            </div>

            {/* Grid de propiedades */}
            <div className="p-4">
              {listLoading && listProperties.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <PropertyCardSkeleton key={i} />
                  ))}
                </div>
              ) : listProperties.length === 0 ? (
                <div className="text-center py-12">
                  <MapIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-lg font-medium mb-2">No se encontraron propiedades</p>
                  <p className="text-muted-foreground mb-4">
                    Intenta ajustar los filtros o mover el mapa
                  </p>
                  <Button variant="outline" onClick={clearFilters}>
                    Limpiar filtros
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {listProperties.map((property) => (
                      <PropertyCard
                        key={property.id}
                        property={property}
                        isFavorite={favorites.has(property.id)}
                        isHighlighted={property.id === hoveredPropertyId}
                        onClick={() => handlePropertyClick(property.id)}
                        onFavoriteToggle={() => toggleFavorite(property.id)}
                        onMouseEnter={() => setHoveredPropertyId(property.id)}
                        onMouseLeave={() => setHoveredPropertyId(null)}
                      />
                    ))}
                  </div>

                  {/* Cargar más */}
                  {hasNextPage && (
                    <div className="text-center py-6">
                      <Button
                        variant="outline"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={listFetching}
                      >
                        {listFetching ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Cargando...
                          </>
                        ) : (
                          `Cargar más (${page}/${totalPages})`
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Indicador de fin */}
                  {!hasNextPage && listProperties.length > 0 && (
                    <p className="text-center text-sm text-muted-foreground py-6">
                      Mostrando todas las propiedades
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sheet de detalle */}
      <PropertyDetailSheet
        propertyId={selectedPropertyId}
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setSelectedPropertyId(null);
        }}
      />
    </div>
  );
}
