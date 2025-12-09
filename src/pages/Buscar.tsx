import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { SearchResultsList } from '@/components/SearchResultsList';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePropertiesInfinite } from '@/hooks/usePropertiesInfinite';
import { PlaceAutocomplete } from '@/components/PlaceAutocomplete';
import { buildPropertyFilters } from '@/utils/buildPropertyFilters';
import type { PropertySummary } from '@/types/property';
import Navbar from '@/components/Navbar';
import PropertyCard from '@/components/PropertyCard';
import { PropertyImageGallery } from '@/components/PropertyImageGallery';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { MapPin, Bed, Bath, Car, Search, AlertCircle, Save, Star, Trash2, X, Tag, TrendingUp, ChevronDown, SlidersHorizontal, Loader2, Map, List } from 'lucide-react';
import type { MapFilters, ViewMode } from '@/types/map';

// Lazy load SearchMap para evitar bloqueo en compilación
const SearchMap = lazy(() => import('@/components/maps/SearchMap').then(mod => ({ default: mod.SearchMap })));
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { mexicoStates, mexicoMunicipalities } from '@/data/mexicoLocations';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { PropertyStats } from '@/components/PropertyStats';
import { DynamicBreadcrumbs, type BreadcrumbItem } from '@/components/DynamicBreadcrumbs';
import { useTracking } from '@/hooks/useTracking';
import { SEOHead } from '@/components/SEOHead';
import { generateSearchTitle, generateSearchDescription } from '@/utils/seo';
import { generatePropertyListStructuredData } from '@/utils/structuredData';
import { PropertyDetailSheet } from '@/components/PropertyDetailSheet';
import { InfiniteScrollContainer } from '@/components/InfiniteScrollContainer';
import { monitoring } from '@/lib/monitoring';
import { cn } from '@/lib/utils';

interface Filters {
  estado: string;
  municipio: string;
  colonia: string;
  precioMin: string;
  precioMax: string;
  tipo: string;
  listingType: string;
  recamaras: string;
  banos: string;
  orden: 'price_desc' | 'price_asc' | 'newest' | 'oldest' | 'bedrooms_desc' | 'sqft_desc';
}

const getTipoLabel = (tipo: string) => {
  const labels: Record<string, string> = {
    casa: '🏠 Casa',
    departamento: '🏢 Depto',
    terreno: '🌳 Terreno',
    oficina: '💼 Oficina',
    local: '🏪 Local',
    bodega: '📦 Bodega',
    edificio: '🏛️ Edificio',
    rancho: '🐎 Rancho'
  };
  return labels[tipo] || tipo;
};

const Buscar = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFiltering, setIsFiltering] = useState(false);
  const { trackGA4Event } = useTracking();
  
  // Flag para prevenir sobrescritura durante sincronización URL -> estado
  const syncingFromUrl = useRef(false);
  
  // Estado para el Sheet de propiedad
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  
// Rangos para VENTA (en millones)
const SALE_MIN_PRICE = 0;
const SALE_MAX_PRICE = 100; // $100M o más

// Rangos para RENTA (en miles)
const RENT_MIN_PRICE = 0;
const RENT_MAX_PRICE = 200; // $200,000 mensuales o más

const getPriceRangeForListingType = (listingType: string): [number, number] => {
  if (listingType === 'renta') {
    return [RENT_MIN_PRICE, RENT_MAX_PRICE];
  }
  return [SALE_MIN_PRICE, SALE_MAX_PRICE];
};

const convertSliderValueToPrice = (value: number, listingType: string): number => {
  if (listingType === 'renta') {
    return value * 1000; // Miles para rentas
  }
  return value * 1000000; // Millones para ventas
};
  const [priceRange, setPriceRange] = useState<[number, number]>([SALE_MIN_PRICE, SALE_MAX_PRICE]);
  
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [savedSearchQuery, setSavedSearchQuery] = useState('');
  const [savedSearchSort, setSavedSearchSort] = useState<'date' | 'name'>('date');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  
  
  // Valores por defecto para filtros
  
  // Valores por defecto para filtros
  const DEFAULT_FILTERS: Filters = {
    estado: '',
    municipio: '',
    colonia: '',
    precioMin: '',
    precioMax: '',
    tipo: '',
    listingType: '',
    recamaras: '',
    banos: '',
    orden: 'price_desc',
  };

  const [filters, setFilters] = useState<Filters>({
    estado: searchParams.get('estado') || '',
    municipio: searchParams.get('municipio') || '',
    colonia: searchParams.get('colonia') || '',
    precioMin: searchParams.get('precioMin') || '',
    precioMax: searchParams.get('precioMax') || '',
    tipo: searchParams.get('tipo') || '',
    listingType: searchParams.get('listingType') || 'venta',
    recamaras: searchParams.get('recamaras') || '',
    banos: searchParams.get('banos') || '',
    orden: (searchParams.get('orden') as any) || 'price_desc',
  });
  
  // Construir filtros para la query
  const propertyFilters = useMemo(
    () => buildPropertyFilters(filters),
    [filters]
  );

  // FUENTE ÚNICA DE DATOS: usePropertiesInfinite
  const {
    properties,
    totalCount,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loading,
    isFetching,
    error: searchError,
  } = usePropertiesInfinite(propertyFilters);

  // Aplicar ordenamiento (destacadas primero, luego criterio seleccionado)
  const sortedProperties = useMemo(() => {
    const sorted = [...properties];
    
    sorted.sort((a, b) => {
      // 1. Prioridad principal: Destacadas primero
      const aFeatured = a.is_featured ? 1 : 0;
      const bFeatured = b.is_featured ? 1 : 0;
      if (aFeatured !== bFeatured) {
        return bFeatured - aFeatured;
      }
      
      // 2. Ordenamiento secundario según criterio seleccionado
      switch (filters.orden) {
        case 'price_desc':
          return b.price - a.price;
        case 'price_asc':
          return a.price - b.price;
        case 'newest': {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        }
        case 'oldest': {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateA - dateB;
        }
        case 'bedrooms_desc':
          return (b.bedrooms || 0) - (a.bedrooms || 0);
        case 'sqft_desc':
          return (b.sqft || 0) - (a.sqft || 0);
        default:
          return b.price - a.price;
      }
    });
    
    return sorted;
  }, [properties, filters.orden]);

  // Alias para compatibilidad
  const filteredProperties = sortedProperties;
  const listProperties = sortedProperties;
  
  // Estado para guardar coordenadas de la ubicación buscada
  const [searchCoordinates, setSearchCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  
  // Sincronizar Sheet desde URL
  useEffect(() => {
    const propertyId = searchParams.get('propiedad');
    if (propertyId) {
      setSelectedPropertyId(propertyId);
      setSheetOpen(true);
    } else {
      setSheetOpen(false);
      setSelectedPropertyId(null);
    }
  }, [searchParams]);
  
  // Función para abrir Sheet
  const handlePropertyClick = useCallback((id: string) => {
    setSelectedPropertyId(id);
    setSheetOpen(true);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('propiedad', id);
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);
  
  // Función para cerrar Sheet
  const handleCloseSheet = () => {
    setSheetOpen(false);
    setSelectedPropertyId(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('propiedad');
    setSearchParams(newParams, { replace: true });
  };
  
  // Sincronizar filters con searchParams cuando la URL cambia
  useEffect(() => {
    syncingFromUrl.current = true;
    
    // Cargar coordenadas desde URL si existen
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    if (lat && lng) {
      setSearchCoordinates({ 
        lat: parseFloat(lat), 
        lng: parseFloat(lng) 
      });
    } else {
      setSearchCoordinates(null);
    }
    
    const newFilters = {
      estado: searchParams.get('estado') || '',
      municipio: searchParams.get('municipio') || '',
      colonia: searchParams.get('colonia') || '',
      precioMin: searchParams.get('precioMin') || '',
      precioMax: searchParams.get('precioMax') || '',
      tipo: searchParams.get('tipo') || '',
      listingType: searchParams.get('listingType') || 'venta',
      recamaras: searchParams.get('recamaras') || '',
      banos: searchParams.get('banos') || '',
      orden: (searchParams.get('orden') as any) || 'price_desc',
    };
    
    if (JSON.stringify(newFilters) !== JSON.stringify(filters)) {
      setFilters(newFilters);
    }
    
    Promise.resolve().then(() => {
      syncingFromUrl.current = false;
    });
  }, [searchParams]);
  
  // Construir el valor de visualización para el input de ubicación
  const locationDisplayValue = filters.municipio && filters.estado
    ? `${filters.municipio}, ${filters.estado}`
    : filters.estado || '';

  const [estados] = useState<string[]>(mexicoStates);
  const [municipios, setMunicipios] = useState<string[]>([]);

  // Normalizar rango de precios para evitar valores fuera de rango al alternar Venta/Renta
  const [minRangeForType, maxRangeForType] = getPriceRangeForListingType(filters.listingType);
  const safePriceRange: [number, number] = [
    Math.max(minRangeForType, Math.min(priceRange[0], maxRangeForType)),
    Math.max(minRangeForType, Math.min(priceRange[1], maxRangeForType)),
  ];

  const filteredSavedSearches = savedSearches
    .filter(search => 
      search.name.toLowerCase().includes(savedSearchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (savedSearchSort === 'name') {
        return a.name.localeCompare(b.name);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Reiniciar y normalizar precio al cambiar tipo de operación
  useEffect(() => {
    const [minRange, maxRange] = getPriceRangeForListingType(filters.listingType);
    
    const needsReset = 
      priceRange[0] < minRange || 
      priceRange[0] > maxRange || 
      priceRange[1] < minRange || 
      priceRange[1] > maxRange;
    
    if (needsReset) {
      setPriceRange([minRange, maxRange]);
      
      setFilters((prev) => ({
        ...prev,
        precioMin: '',
        precioMax: '',
      }));
    }
  }, [filters.listingType, priceRange]);

  // Track búsqueda en GA4 cuando se aplican filtros
  useEffect(() => {
    const hasFilters = !!(
      filters.estado || 
      filters.municipio || 
      filters.tipo || 
      filters.listingType || 
      filters.precioMin || 
      filters.precioMax || 
      filters.recamaras || 
      filters.banos
    );
    
    if (hasFilters) {
      const searchTerm = [
        filters.estado,
        filters.municipio,
        filters.tipo,
        filters.listingType,
      ].filter(Boolean).join(' ');
      
      trackGA4Event('search', {
        search_term: searchTerm || 'búsqueda general',
        item_list_name: 'property_search',
        items: properties.slice(0, 10).map(p => ({
          item_id: p.id,
          item_name: p.title,
          item_category: p.type,
          price: p.price,
        })),
      });
    }
  }, [filters.estado, filters.municipio, filters.tipo, filters.listingType, trackGA4Event]);

  useEffect(() => {
    if (user) {
      fetchSavedSearches();
    }
  }, [user]);

  const fetchSavedSearches = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedSearches(data || []);
    } catch (error) {
      console.error('Error fetching saved searches:', error);
    }
  };

  const handleSaveSearch = async () => {
    if (!user) {
      toast({
        title: 'Inicia sesión',
        description: 'Debes iniciar sesión para guardar búsquedas',
        variant: 'destructive',
      });
      return;
    }

    if (!searchName.trim()) {
      toast({
        title: 'Error',
        description: 'Ingresa un nombre para la búsqueda',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('saved_searches')
        .insert([{
          user_id: user.id,
          name: searchName,
          filters: filters as any,
        }]);

      if (error) throw error;

      toast({
        title: 'Búsqueda guardada',
        description: `"${searchName}" se guardó correctamente`,
      });

      setSearchName('');
      setSaveDialogOpen(false);
      fetchSavedSearches();
    } catch (error: any) {
      console.error('Error saving search:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la búsqueda',
        variant: 'destructive',
      });
    }
  };

  const handleLoadSearch = (savedFilters: any) => {
    setFilters(savedFilters);
    toast({
      title: 'Búsqueda cargada',
      description: 'Los filtros se aplicaron correctamente',
    });
  };

  const handleDeleteSearch = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from('saved_searches')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Búsqueda eliminada',
        description: `"${name}" se eliminó correctamente`,
      });

      fetchSavedSearches();
    } catch (error) {
      console.error('Error deleting search:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la búsqueda',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    const currentListingType = filters.listingType;
    const [minRange, maxRange] = getPriceRangeForListingType(currentListingType);
    
    const minFromUrl = filters.precioMin 
      ? parseFloat(filters.precioMin) / (currentListingType === 'renta' ? 1000 : 1000000)
      : minRange;
    const maxFromUrl = filters.precioMax 
      ? parseFloat(filters.precioMax) / (currentListingType === 'renta' ? 1000 : 1000000)
      : maxRange;
    setPriceRange([minFromUrl, maxFromUrl]);
  }, []);

  const handlePriceRangeChange = (values: number[]) => {
    setPriceRange(values as [number, number]);
    
    const [minRange, maxRange] = getPriceRangeForListingType(filters.listingType);
    
    setFilters(prev => ({
      ...prev,
      precioMin: values[0] === minRange ? '' : convertSliderValueToPrice(values[0], prev.listingType).toString(),
      precioMax: values[1] === maxRange ? '' : convertSliderValueToPrice(values[1], prev.listingType).toString(),
    }));
  };

  const formatPriceDisplay = (value: number, listingType?: string) => {
    const currentListingType = listingType || filters.listingType;
    const [minRange, maxRange] = getPriceRangeForListingType(currentListingType);
    
    if (value === 0 || value === minRange) return '$0';
    if (value === maxRange) return 'Sin límite';
    
    if (currentListingType === 'renta') {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value * 1000);
    } else {
      if (value >= 1) {
        return `$${value.toFixed(1)}M`;
      } else {
        return new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value * 1000000);
      }
    }
  };

  // Sincronización filters → URL
  useEffect(() => {
    if (syncingFromUrl.current) {
      return;
    }
    
    const params = new URLSearchParams();
    
    if (filters.estado) params.set('estado', filters.estado);
    if (filters.municipio) params.set('municipio', filters.municipio);
    if (filters.colonia) params.set('colonia', filters.colonia);
    if (filters.precioMin) params.set('precioMin', filters.precioMin);
    if (filters.precioMax) params.set('precioMax', filters.precioMax);
    if (filters.tipo) params.set('tipo', filters.tipo);
    
    params.set('listingType', filters.listingType || 'venta');
    
    if (filters.recamaras) params.set('recamaras', filters.recamaras);
    if (filters.banos) params.set('banos', filters.banos);
    if (filters.orden !== 'price_desc') params.set('orden', filters.orden);
    
    if (searchCoordinates) {
      params.set('lat', searchCoordinates.lat.toString());
      params.set('lng', searchCoordinates.lng.toString());
    }

    const propiedad = searchParams.get('propiedad');
    if (propiedad) {
      params.set('propiedad', propiedad);
    }

    const next = params.toString();
    const current = searchParams.toString();
    
    if (next !== current) {
      setSearchParams(params, { replace: true });
    }
  }, [filters, searchCoordinates]);

  useEffect(() => {
    if (filters.estado) {
      setMunicipios(mexicoMunicipalities[filters.estado] || []);
    } else {
      setMunicipios([]);
    }
  }, [filters.estado]);

  const removeFilter = (filterKey: keyof Filters) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: filterKey === 'orden' ? 'price_desc' : ''
    }));
  };

  const getActiveFilterChips = () => {
    const chips: Array<{
      key: string;
      label: string;
      removeFilter: () => void;
    }> = [];

    if (filters.estado) {
      chips.push({
        key: 'estado',
        label: `Estado: ${filters.estado}`,
        removeFilter: () => removeFilter('estado')
      });
    }

    if (filters.municipio) {
      chips.push({
        key: 'municipio',
        label: `Municipio: ${filters.municipio}`,
        removeFilter: () => removeFilter('municipio')
      });
    }

    if (filters.colonia) {
      chips.push({
        key: 'colonia',
        label: `Colonia: ${filters.colonia}`,
        removeFilter: () => removeFilter('colonia')
      });
    }

    if (filters.precioMin) {
      chips.push({
        key: 'precioMin',
        label: `Precio mín: $${Number(filters.precioMin).toLocaleString('es-MX')}`,
        removeFilter: () => removeFilter('precioMin')
      });
    }

    if (filters.precioMax) {
      chips.push({
        key: 'precioMax',
        label: `Precio máx: $${Number(filters.precioMax).toLocaleString('es-MX')}`,
        removeFilter: () => removeFilter('precioMax')
      });
    }

    if (filters.tipo) {
      const tipoLabels: Record<string, string> = {
        casa: 'Casa',
        departamento: 'Departamento',
        terreno: 'Terreno',
        oficina: 'Oficina',
        local: 'Local',
        bodega: 'Bodega',
        edificio: 'Edificio',
        rancho: 'Rancho'
      };
      chips.push({
        key: 'tipo',
        label: `Tipo: ${tipoLabels[filters.tipo] || filters.tipo}`,
        removeFilter: () => removeFilter('tipo')
      });
    }

    if (filters.listingType) {
      chips.push({
        key: 'listingType',
        label: filters.listingType === 'venta' ? 'En venta' : 'En renta',
        removeFilter: () => removeFilter('listingType')
      });
    }

    if (filters.recamaras) {
      chips.push({
        key: 'recamaras',
        label: `${filters.recamaras}+ recámaras`,
        removeFilter: () => removeFilter('recamaras')
      });
    }

    if (filters.banos) {
      chips.push({
        key: 'banos',
        label: `${filters.banos}+ baños`,
        removeFilter: () => removeFilter('banos')
      });
    }

    return chips;
  };

  const activeFiltersCount = [
    filters.precioMin,
    filters.precioMax,
    filters.tipo,
    filters.listingType,
    filters.recamaras,
    filters.banos,
  ].filter(Boolean).length;

  useEffect(() => {
    setIsFiltering(isFetching && properties.length === 0);
  }, [isFetching, properties.length]);

  const handleFavoriteClick = async (propertyId: string) => {
    if (!user) {
      toast({
        title: 'Inicia sesión',
        description: 'Debes iniciar sesión para agregar favoritos',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: existing } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('property_id', propertyId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;

        toast({
          title: 'Eliminado de favoritos',
          description: 'La propiedad se eliminó de tus favoritos',
        });
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert([{
            user_id: user.id,
            property_id: propertyId,
          }]);

        if (error) throw error;

        toast({
          title: '⭐ Agregado a favoritos',
          description: 'La propiedad se agregó a tus favoritos',
        });
      }
    } catch (error) {
      monitoring.error('Error managing favorite', {
        component: 'Buscar',
        propertyId,
        error,
      });
      toast({
        title: 'Error',
        description: 'No se pudo actualizar favoritos',
        variant: 'destructive',
      });
    }
  };

  const handleSearchInputChange = (value: string) => {
    if (!value || value.trim() === '') {
      setFilters(prev => {
        if (!prev.estado && !prev.municipio) return prev;
        
        return {
          ...prev,
          estado: '',
          municipio: ''
        };
      });
      setSearchCoordinates(null);
    }
  };

  const handlePlaceSelect = (location: { address: string; municipality: string; state: string; colonia?: string; lat?: number; lng?: number; }) => {
    setFilters(prev => ({
      ...prev,
      estado: location.state || '',
      municipio: location.municipality || '',
      colonia: location.colonia || '',
    }));

    if (location.lat && location.lng) {
      setSearchCoordinates({ lat: location.lat, lng: location.lng });
    }

    const description = location.colonia 
      ? `${location.colonia}, ${location.municipality}, ${location.state}`
      : `${location.municipality}, ${location.state}`;

    toast({
      title: 'Ubicación seleccionada',
      description,
    });
  };

  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      { label: 'Inicio', href: '/', active: false }
    ];

    if (filters.estado && filters.municipio) {
      items.push({
        label: filters.estado,
        href: `/buscar?estado=${filters.estado}`,
        active: false
      });
      items.push({
        label: filters.municipio,
        href: `/buscar?estado=${filters.estado}&municipio=${filters.municipio}`,
        active: true
      });
    } else if (filters.estado) {
      items.push({
        label: filters.estado,
        href: `/buscar?estado=${filters.estado}`,
        active: true
      });
    } else {
      items.push({
        label: 'Buscar Propiedades',
        href: '/buscar',
        active: true
      });
    }

    return items;
  };

  if (loading && !properties.length) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-screen gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando propiedades...</p>
        </div>
      </div>
    );
  }

  // Generar metadatos SEO dinámicos
  const seoTitle = generateSearchTitle({
    estado: filters.estado,
    municipio: filters.municipio,
    tipo: filters.tipo,
    listingType: filters.listingType,
  });

  const seoDescription = generateSearchDescription({
    estado: filters.estado,
    municipio: filters.municipio,
    tipo: filters.tipo,
    listingType: filters.listingType,
    resultCount: filteredProperties.length,
  });

  const listStructuredData = generatePropertyListStructuredData(
    filteredProperties.slice(0, 10).map(p => ({
      id: p.id,
      title: p.title,
      price: p.price,
      url: `${window.location.origin}/property/${p.id}`,
      image: p.images?.[0]?.url,
    })),
    filters.municipio || filters.estado || 'Propiedades en México'
  );

  // Handlers for form controls
  const handleOrdenChange = (value: string) => {
    setFilters(prev => ({ ...prev, orden: value as Filters['orden'] }));
  };

  const handleSavedSearchSortChange = (value: string) => {
    setSavedSearchSort(value as 'date' | 'name');
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        canonical="/buscar"
        structuredData={listStructuredData}
      />
      <Navbar />
      
      <div className="pt-20">
        {/* Barra de búsqueda y filtros compacta */}
        <div className="border-b bg-background sticky top-16 z-30">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Búsqueda de ubicación */}
              <div className="min-w-[240px] flex-1 lg:flex-initial relative">
                <PlaceAutocomplete
                  key={`location-${locationDisplayValue || 'empty'}`}
                  onPlaceSelect={handlePlaceSelect}
                  onInputChange={handleSearchInputChange}
                  placeholder="Ciudad, código postal..."
                  defaultValue={locationDisplayValue}
                  showIcon={true}
                  label=""
                />
                {locationDisplayValue && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 z-20"
                    onClick={() => {
                      setFilters(prev => ({
                        ...prev,
                        estado: '',
                        municipio: ''
                      }));
                      setSearchCoordinates(null);
                    }}
                    title="Limpiar ubicación"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <Separator orientation="vertical" className="h-8 hidden lg:block" />

              {/* Botón de Filtros para Móvil */}
              <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden">
                    <SlidersHorizontal className="h-4 w-4 mr-2" />
                    Filtros
                    {activeFiltersCount > 0 && ` (${activeFiltersCount})`}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[90vh]">
                  <SheetHeader>
                    <SheetTitle>Filtros de búsqueda</SheetTitle>
                    <SheetDescription>
                      Personaliza tu búsqueda de propiedades
                    </SheetDescription>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(90vh-120px)] mt-4">
                    <div className="space-y-6 pr-4">
                      {/* Tipo de Propiedad */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Tipo de propiedad</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: 'casa', label: '🏠 Casa' },
                            { value: 'departamento', label: '🏢 Depto' },
                            { value: 'terreno', label: '🌳 Terreno' },
                            { value: 'oficina', label: '💼 Oficina' },
                            { value: 'local', label: '🏪 Local' },
                            { value: 'bodega', label: '📦 Bodega' },
                            { value: 'edificio', label: '🏛️ Edificio' },
                            { value: 'rancho', label: '🐎 Rancho' },
                          ].map(tipo => (
                            <Button
                              key={tipo.value}
                              variant={filters.tipo === tipo.value ? 'default' : 'outline'}
                              size="sm"
                              className="justify-start"
                              onClick={() => setFilters(prev => ({ ...prev, tipo: prev.tipo === tipo.value ? '' : tipo.value }))}
                            >
                              {tipo.label}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      {/* Operación */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Tipo de operación</h4>
                        <RadioGroup value={filters.listingType || ''} onValueChange={(value) => setFilters(prev => ({ ...prev, listingType: value }))}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="venta" id="venta-mobile" />
                            <Label htmlFor="venta-mobile">💰 Venta</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="renta" id="renta-mobile" />
                            <Label htmlFor="renta-mobile">📅 Renta</Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <Separator />

                      {/* Precio */}
                      <div className="space-y-4">
                        <h4 className="font-medium text-sm">Rango de precio</h4>
                        <Slider
                          min={getPriceRangeForListingType(filters.listingType)[0]}
                          max={getPriceRangeForListingType(filters.listingType)[1]}
                          step={filters.listingType === 'renta' ? 1 : 0.5}
                          value={safePriceRange}
                          onValueChange={handlePriceRangeChange}
                        />
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{formatPriceDisplay(priceRange[0])}</span>
                          <span>{formatPriceDisplay(priceRange[1])}</span>
                        </div>
                      </div>

                      <Separator />

                      {/* Recámaras y Baños */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium text-sm mb-3">Recámaras</h4>
                          <div className="grid grid-cols-5 gap-2">
                            {['', '1', '2', '3', '4'].map(num => (
                              <Button
                                key={num}
                                variant={filters.recamaras === num ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilters(prev => ({ ...prev, recamaras: num }))}
                              >
                                {num || 'Todas'}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium text-sm mb-3">Baños</h4>
                          <div className="grid grid-cols-4 gap-2">
                            {['', '1', '2', '3'].map(num => (
                              <Button
                                key={num}
                                variant={filters.banos === num ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setFilters(prev => ({ ...prev, banos: num }))}
                              >
                                {num || 'Todos'}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Ordenar */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Ordenar por</h4>
                        <RadioGroup value={filters.orden} onValueChange={handleOrdenChange}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="price_desc" id="price_desc_mobile" />
                            <Label htmlFor="price_desc_mobile">💰 Precio: Mayor a menor</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="price_asc" id="price_asc_mobile" />
                            <Label htmlFor="price_asc_mobile">💸 Precio: Menor a mayor</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="newest" id="newest_mobile" />
                            <Label htmlFor="newest_mobile">✨ Más recientes</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="oldest" id="oldest_mobile" />
                            <Label htmlFor="oldest_mobile">🕰️ Más antiguos</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="bedrooms_desc" id="bedrooms_desc_mobile" />
                            <Label htmlFor="bedrooms_desc_mobile">🛏️ Recámaras: Mayor a menor</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="sqft_desc" id="sqft_desc_mobile" />
                            <Label htmlFor="sqft_desc_mobile">📏 Área (m²): Mayor a menor</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                  </ScrollArea>
                  <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
                    <Button className="w-full" onClick={() => setMobileFiltersOpen(false)}>
                      Ver {filteredProperties.length} propiedades
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>

              {/* Filtros Desktop - Popovers */}
              <div className="hidden lg:flex items-center gap-2">
              {/* 2. Tipo */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    {filters.tipo ? getTipoLabel(filters.tipo) : 'Tipo'}
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96" align="start">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Tipo de propiedad</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'casa', label: '🏠 Casa' },
                        { value: 'departamento', label: '🏢 Depto' },
                        { value: 'terreno', label: '🌳 Terreno' },
                        { value: 'oficina', label: '💼 Oficina' },
                        { value: 'local', label: '🏪 Local' },
                        { value: 'bodega', label: '📦 Bodega' },
                        { value: 'edificio', label: '🏛️ Edificio' },
                        { value: 'rancho', label: '🐎 Rancho' },
                      ].map(tipo => (
                        <Button
                          key={tipo.value}
                          variant={filters.tipo === tipo.value ? 'default' : 'outline'}
                          size="sm"
                          className="justify-start"
                          onClick={() => setFilters(prev => ({ ...prev, tipo: prev.tipo === tipo.value ? '' : tipo.value }))}
                        >
                          {tipo.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* 3. Operación (Venta/Renta) */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    {filters.listingType === 'venta' ? '💰 Venta' : filters.listingType === 'renta' ? '📅 Renta' : 'Operación'}
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56" align="start">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Tipo de operación</h4>
                    <RadioGroup value={filters.listingType || ''} onValueChange={(value) => setFilters(prev => ({ ...prev, listingType: value }))}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="venta" id="venta" />
                        <Label htmlFor="venta">💰 Venta</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="renta" id="renta" />
                        <Label htmlFor="renta">📅 Renta</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </PopoverContent>
              </Popover>

              {/* 4. Precio */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    {(() => {
                      const [minRange, maxRange] = getPriceRangeForListingType(filters.listingType);
                      return priceRange[0] === minRange && priceRange[1] === maxRange 
                        ? 'Precio' 
                        : `${formatPriceDisplay(priceRange[0])} - ${formatPriceDisplay(priceRange[1])}`;
                    })()}
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Rango de precio</h4>
                    <Slider
                      min={getPriceRangeForListingType(filters.listingType)[0]}
                      max={getPriceRangeForListingType(filters.listingType)[1]}
                      step={filters.listingType === 'renta' ? 1 : 0.5}
                      value={safePriceRange}
                      onValueChange={handlePriceRangeChange}
                    />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{formatPriceDisplay(priceRange[0])}</span>
                      <span>{formatPriceDisplay(priceRange[1])}</span>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* 5. Beds & Baths */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    {filters.recamaras || filters.banos 
                      ? `${filters.recamaras || '0'}+ rec, ${filters.banos || '0'}+ baños` 
                      : 'Rec & Baños'}
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Recámaras</h4>
                      <div className="grid grid-cols-5 gap-2">
                        {['', '1', '2', '3', '4'].map(num => (
                          <Button
                            key={num}
                            variant={filters.recamaras === num ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilters(prev => ({ ...prev, recamaras: num }))}
                          >
                            {num || 'Todas'}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm mb-2">Baños</h4>
                      <div className="grid grid-cols-4 gap-2">
                        {['', '1', '2', '3'].map(num => (
                          <Button
                            key={num}
                            variant={filters.banos === num ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilters(prev => ({ ...prev, banos: num }))}
                          >
                            {num || 'Todos'}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* 6. Ordenar por */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    Ordenar por
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72" align="start">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Ordenar propiedades por</h4>
                    <RadioGroup 
                      value={filters.orden} 
                      onValueChange={handleOrdenChange}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="price_desc" id="price_desc" />
                        <Label htmlFor="price_desc" className="cursor-pointer">
                          💰 Precio: Mayor a menor
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="price_asc" id="price_asc" />
                        <Label htmlFor="price_asc" className="cursor-pointer">
                          💸 Precio: Menor a mayor
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="newest" id="newest" />
                        <Label htmlFor="newest" className="cursor-pointer">
                          ✨ Más recientes
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="oldest" id="oldest" />
                        <Label htmlFor="oldest" className="cursor-pointer">
                          🕰️ Más antiguos
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="bedrooms_desc" id="bedrooms_desc" />
                        <Label htmlFor="bedrooms_desc" className="cursor-pointer">
                          🛏️ Recámaras: Mayor a menor
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sqft_desc" id="sqft_desc" />
                        <Label htmlFor="sqft_desc" className="cursor-pointer">
                          📏 Área (m²): Mayor a menor
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </PopoverContent>
              </Popover>
              </div>

              {/* Espaciador */}
              <div className="flex-1 hidden lg:block" />

              {/* Save search button */}
              {user && (
                <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="hidden lg:flex">
                      <Save className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Guardar búsqueda</DialogTitle>
                      <DialogDescription>
                        Dale un nombre a esta búsqueda para acceder rápidamente después
                      </DialogDescription>
                    </DialogHeader>
                    <Input
                      placeholder="Nombre de la búsqueda"
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                    />
                    <DialogFooter>
                      <Button onClick={handleSaveSearch}>Guardar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Chips de filtros activos */}
            {activeFiltersCount > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {getActiveFilterChips().map(chip => (
                  <Badge 
                    key={chip.key} 
                    variant="secondary" 
                    className="gap-1 text-xs py-0 h-6 px-2"
                  >
                    {chip.label}
                    <X className="h-3 w-3 cursor-pointer" onClick={chip.removeFilter} />
                  </Badge>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => {
                    setFilters(DEFAULT_FILTERS);
                    setSearchCoordinates(null);
                    setPriceRange([SALE_MIN_PRICE, SALE_MAX_PRICE]);
                  }}
                >
                  Limpiar filtros
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Botones de vista (móvil) */}
        <div className="lg:hidden flex justify-center gap-2 py-2 border-b bg-background">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4 mr-1" />
            Lista
          </Button>
          <Button
            variant={viewMode === 'map' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('map')}
          >
            <Map className="h-4 w-4 mr-1" />
            Mapa
          </Button>
        </div>

        {/* Contenedor principal: Split View */}
        <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 180px)' }}>
          {/* Lista de propiedades */}
          <div className={cn(
            "flex-1 overflow-y-auto",
            viewMode === 'map' && 'hidden lg:block',
            viewMode === 'split' && 'lg:w-1/2',
            viewMode === 'list' && 'w-full'
          )}>
            <div className="p-4 space-y-4">
              {/* Estado de error */}
              {searchError && (
                <div className="flex flex-col items-center justify-center p-8 space-y-4 min-h-[400px]">
                  <AlertCircle className="h-12 w-12 text-destructive" />
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold">Error al cargar propiedades</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Ocurrió un problema al buscar las propiedades. Por favor, intenta de nuevo.
                    </p>
                  </div>
                  <Button 
                    onClick={() => window.location.reload()}
                    variant="outline"
                  >
                    Reintentar
                  </Button>
                </div>
              )}

              {/* Estado de carga inicial */}
              {!searchError && loading && properties.length === 0 && (
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Buscando propiedades...</span>
                  </div>
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-48 w-full" />
                  ))}
                </div>
              )}

              {/* Estado vacío - sin resultados */}
              {!searchError && !loading && listProperties.length === 0 && (
                <div className="flex flex-col items-center justify-center p-12 space-y-4 text-center min-h-[400px]">
                  <div className="rounded-full bg-muted p-6">
                    <Search className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">No encontramos propiedades</h3>
                    <p className="text-muted-foreground max-w-md">
                      No hay propiedades que coincidan con tus filtros actuales.
                    </p>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Intenta:</p>
                    <ul className="space-y-1">
                      <li>• Ampliar el rango de precio</li>
                      <li>• Cambiar la ubicación</li>
                      <li>• Ajustar los filtros de recámaras y baños</li>
                    </ul>
                  </div>
                  <Button
                    onClick={() => {
                      setFilters(DEFAULT_FILTERS);
                      setSearchCoordinates(null);
                      setPriceRange([SALE_MIN_PRICE, SALE_MAX_PRICE]);
                    }}
                    variant="outline"
                  >
                    Limpiar todos los filtros
                  </Button>
                </div>
              )}

              {/* Lista de propiedades con resultados */}
              {!searchError && listProperties.length > 0 && (
                <InfiniteScrollContainer
                  onLoadMore={() => {
                    if (hasNextPage && !isFetching) {
                      fetchNextPage();
                    }
                  }}
                  hasMore={!!hasNextPage}
                  isLoading={isFetchingNextPage}
                  className="space-y-4"
                >
                  {/* Contador de resultados */}
                  <div className="pb-2 text-sm text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">{totalCount}</span>{' '}
                      {totalCount === 1 ? 'propiedad encontrada' : 'propiedades encontradas'}
                    </p>
                  </div>

                  <SearchResultsList
                    properties={listProperties}
                    isLoading={loading && listProperties.length === 0}
                    listingType={filters.listingType}
                    onPropertyClick={handlePropertyClick}
                    savedSearchesCount={user ? savedSearches.length : 0}
                    onScrollToSavedSearches={() => {
                      const element = document.getElementById('saved-searches');
                      element?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  />
                </InfiniteScrollContainer>
              )}

              {/* Búsquedas guardadas */}
              {user && savedSearches.length > 0 && (
                <div id="saved-searches" className="pt-8">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4" />
                          <Label className="font-semibold">Búsquedas guardadas</Label>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <Input
                          placeholder="Buscar..."
                          value={savedSearchQuery}
                          onChange={(e) => setSavedSearchQuery(e.target.value)}
                        />
                        <Select value={savedSearchSort} onValueChange={handleSavedSearchSortChange}>
                          <SelectTrigger className="w-auto">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="date">Fecha</SelectItem>
                            <SelectItem value="name">Nombre</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {filteredSavedSearches.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                          <p className="text-sm">No se encontraron búsquedas</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {filteredSavedSearches.map((search) => (
                            <div
                              key={search.id}
                              className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                            >
                              <button
                                onClick={() => handleLoadSearch(search.filters)}
                                className="flex-1 text-left"
                              >
                                <p className="font-medium text-sm">{search.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(search.created_at).toLocaleDateString('es-MX', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </p>
                              </button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteSearch(search.id, search.name)}
                                className="hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>

          {/* Mapa */}
          <div className={cn(
            "border-l bg-muted/30",
            viewMode === 'list' && 'hidden lg:hidden',
            viewMode === 'map' && 'w-full lg:w-1/2',
            viewMode === 'split' && 'hidden lg:block lg:w-1/2'
          )}>
            <Suspense fallback={
              <div className="h-full flex items-center justify-center bg-muted">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            }>
              <SearchMap
                filters={{
                  listing_type: filters.listingType as 'venta' | 'renta' | null,
                  property_type: filters.tipo || null,
                  price_min: filters.precioMin ? Number(filters.precioMin) : null,
                  price_max: filters.precioMax ? Number(filters.precioMax) : null,
                  bedrooms_min: filters.recamaras ? Number(filters.recamaras) : null,
                  bathrooms_min: filters.banos ? Number(filters.banos) : null,
                  state: filters.estado || null,
                  municipality: filters.municipio || null,
                }}
                selectedPropertyId={selectedPropertyId}
                hoveredPropertyId={hoveredPropertyId}
                onPropertyClick={handlePropertyClick}
                onPropertyHover={setHoveredPropertyId}
                className="h-full"
              />
            </Suspense>
          </div>
        </div>
      </div>
      
      <PropertyDetailSheet 
        propertyId={selectedPropertyId}
        open={sheetOpen}
        onClose={handleCloseSheet}
      />
    </div>
  );
};

export default Buscar;
