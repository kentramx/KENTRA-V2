import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePropertiesViewport, ViewportBounds } from '@/hooks/usePropertiesViewport';
import { useSearchState } from '@/hooks/useSearchState';
import { useSearchSync } from '@/hooks/useSearchSync';
import Navbar from '@/components/Navbar';
import { PropertyDetailSheet } from '@/components/PropertyDetailSheet';
import { Button } from '@/components/ui/button';
import { Map as MapIcon, List as ListIcon } from 'lucide-react';
import { PropertyStats } from '@/components/PropertyStats';
import { DynamicBreadcrumbs, type BreadcrumbItem } from '@/components/DynamicBreadcrumbs';
import { useTracking } from '@/hooks/useTracking';
import { SEOHead } from '@/components/SEOHead';
import { generateSearchTitle, generateSearchDescription } from '@/utils/seo';
import { generatePropertyListStructuredData } from '@/utils/structuredData';
import { SearchFilters } from '@/components/search/SearchFilters';
import { SearchResults } from '@/components/search/SearchResults';
import { SearchMap } from '@/components/search/SearchMap';
import { SavedSearches } from '@/components/search/SavedSearches';

interface Property {
  id: string;
  title: string;
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  lat: number | null;
  lng: number | null;
  address: string;
  state: string;
  municipality: string;
  type: 'casa' | 'departamento' | 'terreno' | 'oficina' | 'local' | 'bodega' | 'edificio' | 'rancho';
  listing_type: string;
  images: { url: string; position: number }[];
  created_at: string | null;
  sqft: number | null;
  agent_id: string;
  is_featured?: boolean;
}

interface Filters {
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

const ITEMS_PER_PAGE = 24;

const Buscar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isFiltering, setIsFiltering] = useState(false);
  const { trackGA4Event } = useTracking();

  // State management con hook personalizado
  const {
    filters,
    setFilters,
    updateFilter,
    resetFilters,
    currentPage,
    setCurrentPage,
    viewMode,
    setViewMode,
  } = useSearchState(searchParams);

  // Estados para mapa y propiedades
  const [mapBounds, setMapBounds] = useState<ViewportBounds | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(
    searchParams.get('propertyId')
  );
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);

  // Sincronización con URL
  useSearchSync(filters, selectedProperty, setIsFiltering);

  // Fetch propiedades desde el viewport
  const { data: viewportData, isLoading, error } = usePropertiesViewport(mapBounds, {
    estado: filters.estado,
    municipio: filters.municipio,
    tipo: filters.tipo === 'all' ? undefined : filters.tipo,
    listingType: filters.listingType,
    precioMin: filters.precioMin ? parseFloat(filters.precioMin) : undefined,
    precioMax: filters.precioMax ? parseFloat(filters.precioMax) : undefined,
  });

  // Obtener propiedades y aplicar filtros adicionales
  const allProperties = useMemo(() => {
    const properties = (viewportData?.properties || []) as Property[];
    
    return properties.filter((property) => {
      if (filters.recamaras && property.bedrooms && property.bedrooms < parseInt(filters.recamaras)) return false;
      if (filters.banos && property.bathrooms && property.bathrooms < parseInt(filters.banos)) return false;
      return true;
    });
  }, [viewportData, filters.recamaras, filters.banos]);

  // Ordenar propiedades
  const sortedProperties = useMemo(() => {
    const sorted = [...allProperties];
    
    // Destacar propiedades featured
    sorted.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      
      // Aplicar orden seleccionado
      switch (filters.orden) {
        case 'price_asc':
          return a.price - b.price;
        case 'price_desc':
          return b.price - a.price;
        case 'newest':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case 'oldest':
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        case 'bedrooms_desc':
          return (b.bedrooms || 0) - (a.bedrooms || 0);
        case 'sqft_desc':
          return (b.sqft || 0) - (a.sqft || 0);
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [allProperties, filters.orden]);

  // Paginación
  const totalProperties = sortedProperties.length;
  const totalPages = Math.ceil(totalProperties / ITEMS_PER_PAGE);
  const paginatedProperties = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return sortedProperties.slice(start, end);
  }, [sortedProperties, currentPage]);

  // Handlers
  const handleSearch = useCallback(() => {
    setCurrentPage(1);
  }, [setCurrentPage]);

  const handlePropertyClick = useCallback((propertyId: string) => {
    setSelectedProperty(propertyId);
    navigate(`/buscar?propertyId=${propertyId}`);
  }, [navigate]);

  const handlePropertyHover = useCallback((propertyId: string | null) => {
    setHoveredPropertyId(propertyId);
  }, []);

  const handleBoundsChange = useCallback((bounds: ViewportBounds) => {
    setMapBounds(bounds);
  }, []);

  const handleLoadSearch = useCallback((loadedFilters: Filters) => {
    setFilters(loadedFilters);
    setCurrentPage(1);
  }, [setFilters, setCurrentPage]);

  // Verificar favorito
  useEffect(() => {
    const checkFavorite = async () => {
      if (!user || !selectedProperty) return;

      const { data } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('property_id', selectedProperty)
        .maybeSingle();

      setIsFavorite(!!data);
    };

    checkFavorite();
  }, [selectedProperty, user]);

  // Toggle favorito
  const handleToggleFavorite = useCallback(async () => {
    if (!user || !selectedProperty) return;

    if (isFavorite) {
      await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('property_id', selectedProperty);
      setIsFavorite(false);
    } else {
      await supabase
        .from('favorites')
        .insert({ user_id: user.id, property_id: selectedProperty });
      setIsFavorite(true);
    }
  }, [user, selectedProperty, isFavorite]);

  // Contar filtros activos
  const activeFiltersCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === 'orden') return false;
      return value !== '' && value !== 'all';
    }).length;
  }, [filters]);

  // Breadcrumbs
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Inicio', href: '/', active: false },
    { label: 'Buscar', href: '/buscar', active: !filters.estado && !filters.municipio },
  ];

  if (filters.estado) breadcrumbs.push({ label: filters.estado, href: `/buscar?estado=${filters.estado}`, active: !filters.municipio });
  if (filters.municipio) breadcrumbs.push({ label: filters.municipio, href: '#', active: true });

  // SEO
  const seoTitle = generateSearchTitle(filters as any);
  const seoDescription = generateSearchDescription(filters as any);
  const structuredData = generatePropertyListStructuredData(sortedProperties.slice(0, 10) as any);

  return (
    <>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        canonical={`https://kentra.mx/buscar${searchParams.toString() ? `?${searchParams.toString()}` : ''}`}
        structuredData={structuredData}
      />

      <div className="min-h-screen bg-background">
        <Navbar />
        
        <div className="container mx-auto px-4 py-6">
          <DynamicBreadcrumbs items={breadcrumbs} />
          
          {/* Header con Stats */}
          <div className="mb-6">
            <PropertyStats properties={sortedProperties as any} listingType={filters.listingType} />
          </div>

          {/* Búsquedas guardadas */}
          {user && (
            <div className="mb-4">
              <SavedSearches
                userId={user.id}
                currentFilters={filters}
                onLoadSearch={handleLoadSearch}
              />
            </div>
          )}

          {/* Toggle Vista Lista/Mapa (Mobile) */}
          <div className="lg:hidden mb-4 flex gap-2">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              onClick={() => setViewMode('list')}
              className="flex-1"
            >
              <ListIcon className="mr-2 h-4 w-4" />
              Lista
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'outline'}
              onClick={() => setViewMode('map')}
              className="flex-1"
            >
              <MapIcon className="mr-2 h-4 w-4" />
              Mapa
            </Button>
          </div>

          {/* Layout Principal */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Filtros (Desktop) */}
            <div className="lg:col-span-3">
              <SearchFilters
                filters={filters}
                onFilterChange={updateFilter}
                onResetFilters={resetFilters}
                onSearch={handleSearch}
                activeFiltersCount={activeFiltersCount}
                propertyCount={totalProperties}
              />
            </div>

            {/* Resultados */}
            <div className={`lg:col-span-5 ${viewMode === 'map' ? 'hidden lg:block' : ''}`}>
              <SearchResults
                properties={paginatedProperties}
                isLoading={isLoading}
                error={error}
                totalProperties={totalProperties}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                onPropertyHover={handlePropertyHover}
                onPropertyClick={handlePropertyClick}
                hoveredPropertyId={hoveredPropertyId}
              />
            </div>

            {/* Mapa (Desktop siempre visible, Mobile solo en modo mapa) */}
            <div className={`lg:col-span-4 ${viewMode === 'list' ? 'hidden lg:block' : ''}`}>
              <SearchMap
                properties={sortedProperties}
                hoveredPropertyId={hoveredPropertyId}
                selectedProperty={selectedProperty}
                onPropertyClick={handlePropertyClick}
                onPropertyHover={handlePropertyHover}
                onBoundsChange={handleBoundsChange}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Property Detail Sheet */}
      <PropertyDetailSheet
        propertyId={selectedProperty || ''}
        open={!!selectedProperty}
        onClose={() => {
          setSelectedProperty(null);
          navigate('/buscar');
        }}
      />
    </>
  );
};

export default Buscar;

