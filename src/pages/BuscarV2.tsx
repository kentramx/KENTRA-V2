import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SearchMapMapboxV2 } from '@/components/SearchMapMapboxV2';
import { SearchResultsList } from '@/components/SearchResultsList';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePropertySearch } from '@/hooks/usePropertySearch';
import { PlaceAutocomplete } from '@/components/PlaceAutocomplete';
import { buildPropertyFilters } from '@/utils/buildPropertyFilters';
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
import { MapPin, Bed, Bath, Car, Search, AlertCircle, Save, Star, Trash2, X, Tag, TrendingUp, ChevronDown, SlidersHorizontal, Loader2, Map as MapIcon, List as ListIcon } from 'lucide-react';
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
import type { MapProperty, PropertyFilters, HoveredProperty } from '@/types/property';

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

const BuscarV2 = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFiltering, setIsFiltering] = useState(false);
  const { trackGA4Event } = useTracking();
  
  const syncingFromUrl = useRef(false);
  
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  
  const [selectedPropertyFromMap, setSelectedPropertyFromMap] = useState<string | null>(null);
  
const SALE_MIN_PRICE = 0;
const SALE_MAX_PRICE = 100;

const RENT_MIN_PRICE = 0;
const RENT_MAX_PRICE = 200;

const getPriceRangeForListingType = (listingType: string): [number, number] => {
  if (listingType === 'renta') {
    return [RENT_MIN_PRICE, RENT_MAX_PRICE];
  }
  return [SALE_MIN_PRICE, SALE_MAX_PRICE];
};

const convertSliderValueToPrice = (value: number, listingType: string): number => {
  if (listingType === 'renta') {
    return value * 1000;
  }
  return value * 1000000;
};
  const [priceRange, setPriceRange] = useState<[number, number]>([SALE_MIN_PRICE, SALE_MAX_PRICE]);
  
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [savedSearchQuery, setSavedSearchQuery] = useState('');
  const [savedSearchSort, setSavedSearchSort] = useState<'date' | 'name'>('date');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  
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
  
  useEffect(() => {
    console.log('[BuscarV2 Debug] filters.listingType changed to:', filters.listingType);
  }, [filters.listingType]);

  useEffect(() => {
    console.log('[BuscarV2 Debug] URL listingType changed to:', searchParams.get('listingType'));
  }, [searchParams]);
  
  const propertyFilters = useMemo(
    () => buildPropertyFilters(filters),
    [filters]
  );

  const {
    properties,
    isLoading: loading,
    isFetching,
    error: searchError,
    totalCount,
    hasNextPage,
    fetchNextPage,
    hasTooManyResults,
    actualTotal,
  } = usePropertySearch(propertyFilters);

  const sortedProperties = useMemo(() => {
    const sorted = [...properties];
    
    sorted.sort((a, b) => {
      const aFeatured = a.is_featured ? 1 : 0;
      const bFeatured = b.is_featured ? 1 : 0;
      if (aFeatured !== bFeatured) {
        return bFeatured - aFeatured;
      }
      
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

  const filteredProperties = sortedProperties;
  
  const [searchCoordinates, setSearchCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  
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
  
  const handlePropertyClick = useCallback((id: string) => {
    setSelectedPropertyId(id);
    setSheetOpen(true);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('propiedad', id);
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);
  
  const handleCloseSheet = () => {
    setSheetOpen(false);
    setSelectedPropertyId(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('propiedad');
    setSearchParams(newParams, { replace: true });
  };
  
  useEffect(() => {
    syncingFromUrl.current = true;
    
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
  
  const locationDisplayValue = filters.municipio && filters.estado
    ? `${filters.municipio}, ${filters.estado}`
    : filters.estado || '';

  const [estados] = useState<string[]>(mexicoStates);
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [hoveredProperty, setHoveredProperty] = useState<MapProperty | null>(null);
  const hoverFromMap = useRef(false);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('list');
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapVisibleCount, setMapVisibleCount] = useState<number>(0);

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
  
  const handlePropertyHoverFromMap = useCallback((property: MapProperty | null) => {
    hoverFromMap.current = true;
    setHoveredProperty(property);
  }, []);

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

  useEffect(() => {
    if (syncingFromUrl.current) {
      console.log('[BuscarV2] Sincronización bloqueada: syncingFromUrl activo');
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
      console.log('[BuscarV2] Actualizando URL:', { next, current });
      setSearchParams(params, { replace: true });
    } else {
      console.log('[BuscarV2] URL sin cambios, skip update');
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

  const handlePropertyHoverFromList = useCallback((property: HoveredProperty | null) => {
    hoverFromMap.current = false;
    
    if (property && property.lat && property.lng) {
      setHoveredProperty({
        id: property.id,
        title: property.title,
        price: property.price,
        currency: property.currency,
        lat: property.lat,
        lng: property.lng,
      } as MapProperty);
    } else {
      setHoveredProperty(null);
    }
  }, []);

  const handleMarkerClick = useCallback((propertyId: string) => {
    monitoring.debug('[BuscarV2] Click en marcador del mapa', {
      component: 'BuscarV2',
      action: 'markerClick',
      propertyId,
    });
    
    setSelectedPropertyFromMap(propertyId);
    
    handlePropertyClick(propertyId);
    
    setTimeout(() => {
      setSelectedPropertyFromMap(null);
    }, 2000);
    
    trackGA4Event('select_item', {
      item_list_name: 'search_map',
      items: [{ item_id: propertyId }],
    });
  }, [handlePropertyClick, trackGA4Event]);

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
        component: 'BuscarV2',
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
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

  const totalCountFromData = properties.length;

  const hasActiveFilters = !!(
    filters.estado || 
    filters.municipio || 
    filters.tipo || 
    filters.listingType || 
    filters.precioMin || 
    filters.precioMax || 
    filters.recamaras || 
    filters.banos
  );

  const hasLocationFilters = !!(
    filters.estado || 
    filters.municipio || 
    filters.tipo || 
    filters.precioMin || 
    filters.precioMax || 
    filters.recamaras || 
    filters.banos
  );

  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      { label: 'Inicio', href: '/', active: false }
    ];

    if (filters.estado && filters.municipio) {
      items.push({
        label: filters.estado,
        href: `/buscar-v2?estado=${filters.estado}`,
        active: false
      });
      items.push({
        label: filters.municipio,
        href: `/buscar-v2?estado=${filters.estado}&municipio=${filters.municipio}`,
        active: true
      });
    } else if (filters.estado) {
      items.push({
        label: filters.estado,
        href: `/buscar-v2?estado=${filters.estado}`,
        active: true
      });
    } else {
      items.push({
        label: 'Buscar Propiedades V2',
        href: '/buscar-v2',
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

  const handleOrdenChange = (value: string) => {
    setFilters(prev => ({ ...prev, orden: value as Filters['orden'] }));
  };

  const handleSavedSearchSortChange = (value: string) => {
    setSavedSearchSort(value as 'date' | 'name');
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={seoTitle + ' [V2 Mapbox]'}
        description={seoDescription}
        canonical="/buscar-v2"
        structuredData={listStructuredData}
      />
      <Navbar />
      
      <div className="pt-16">
        <div className="border-b bg-background sticky top-16 z-30">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
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
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="estado-select">Estado</Label>
                        <Select
                          value={filters.estado}
                          onValueChange={(value) => setFilters(prev => ({ ...prev, estado: value, municipio: '', colonia: '' }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un estado" />
                          </SelectTrigger>
                          <SelectContent>
                            {estados.map(estado => (
                              <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="municipio-select">Municipio</Label>
                        <Select
                          value={filters.municipio}
                          onValueChange={(value) => setFilters(prev => ({ ...prev, municipio: value, colonia: '' }))}
                          disabled={!filters.estado}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un municipio" />
                          </SelectTrigger>
                          <SelectContent>
                            {municipios.map(municipio => (
                              <SelectItem key={municipio} value={municipio}>{municipio}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="colonia-input">Colonia</Label>
                        <Input
                          id="colonia-input"
                          value={filters.colonia}
                          onChange={(e) => setFilters(prev => ({ ...prev, colonia: e.target.value }))}
                          placeholder="Colonia"
                        />
                      </div>

                      <div>
                        <Label>Tipo de propiedad</Label>
                        <Select
                          value={filters.tipo}
                          onValueChange={(value) => setFilters(prev => ({ ...prev, tipo: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Todos</SelectItem>
                            <SelectItem value="casa">Casa</SelectItem>
                            <SelectItem value="departamento">Departamento</SelectItem>
                            <SelectItem value="terreno">Terreno</SelectItem>
                            <SelectItem value="oficina">Oficina</SelectItem>
                            <SelectItem value="local">Local</SelectItem>
                            <SelectItem value="bodega">Bodega</SelectItem>
                            <SelectItem value="edificio">Edificio</SelectItem>
                            <SelectItem value="rancho">Rancho</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Tipo de listado</Label>
                        <RadioGroup
                          value={filters.listingType}
                          onValueChange={(value) => setFilters(prev => ({ ...prev, listingType: value }))}
                          className="flex gap-4"
                        >
                          <RadioGroupItem value="venta" id="venta" />
                          <Label htmlFor="venta">Venta</Label>
                          <RadioGroupItem value="renta" id="renta" />
                          <Label htmlFor="renta">Renta</Label>
                        </RadioGroup>
                      </div>

                      <div>
                        <Label>Precio</Label>
                        <Slider
                          value={safePriceRange}
                          onValueChange={handlePriceRangeChange}
                          min={minRangeForType}
                          max={maxRangeForType}
                          step={1}
                        />
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{formatPriceDisplay(safePriceRange[0])}</span>
                          <span>{formatPriceDisplay(safePriceRange[1])}</span>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="recamaras-select">Recámaras</Label>
                        <Select
                          value={filters.recamaras}
                          onValueChange={(value) => setFilters(prev => ({ ...prev, recamaras: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Cualquier cantidad" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Cualquier cantidad</SelectItem>
                            <SelectItem value="1">1+</SelectItem>
                            <SelectItem value="2">2+</SelectItem>
                            <SelectItem value="3">3+</SelectItem>
                            <SelectItem value="4">4+</SelectItem>
                            <SelectItem value="5">5+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="banos-select">Baños</Label>
                        <Select
                          value={filters.banos}
                          onValueChange={(value) => setFilters(prev => ({ ...prev, banos: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Cualquier cantidad" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Cualquier cantidad</SelectItem>
                            <SelectItem value="1">1+</SelectItem>
                            <SelectItem value="2">2+</SelectItem>
                            <SelectItem value="3">3+</SelectItem>
                            <SelectItem value="4">4+</SelectItem>
                            <SelectItem value="5">5+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="orden-select">Ordenar por</Label>
                        <Select
                          value={filters.orden}
                          onValueChange={handleOrdenChange}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="price_desc">Precio: Mayor a menor</SelectItem>
                            <SelectItem value="price_asc">Precio: Menor a mayor</SelectItem>
                            <SelectItem value="newest">Más nuevo</SelectItem>
                            <SelectItem value="oldest">Más antiguo</SelectItem>
                            <SelectItem value="bedrooms_desc">Recámaras: Mayor a menor</SelectItem>
                            <SelectItem value="sqft_desc">Metros cuadrados: Mayor a menor</SelectItem>
                          </SelectContent>
                        </Select>
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

              <div className="hidden lg:flex items-center gap-2">
                <div>
                  <Label htmlFor="estado-select-desktop">Estado</Label>
                  <Select
                    value={filters.estado}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, estado: value, municipio: '', colonia: '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {estados.map(estado => (
                        <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="municipio-select-desktop">Municipio</Label>
                  <Select
                    value={filters.municipio}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, municipio: value, colonia: '' }))}
                    disabled={!filters.estado}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un municipio" />
                    </SelectTrigger>
                    <SelectContent>
                      {municipios.map(municipio => (
                        <SelectItem key={municipio} value={municipio}>{municipio}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="colonia-input-desktop">Colonia</Label>
                  <Input
                    id="colonia-input-desktop"
                    value={filters.colonia}
                    onChange={(e) => setFilters(prev => ({ ...prev, colonia: e.target.value }))}
                    placeholder="Colonia"
                  />
                </div>

                <div>
                  <Label>Tipo de propiedad</Label>
                  <Select
                    value={filters.tipo}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, tipo: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      <SelectItem value="casa">Casa</SelectItem>
                      <SelectItem value="departamento">Departamento</SelectItem>
                      <SelectItem value="terreno">Terreno</SelectItem>
                      <SelectItem value="oficina">Oficina</SelectItem>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="bodega">Bodega</SelectItem>
                      <SelectItem value="edificio">Edificio</SelectItem>
                      <SelectItem value="rancho">Rancho</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tipo de listado</Label>
                  <RadioGroup
                    value={filters.listingType}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, listingType: value }))}
                    className="flex gap-4"
                  >
                    <RadioGroupItem value="venta" id="venta-desktop" />
                    <Label htmlFor="venta-desktop">Venta</Label>
                    <RadioGroupItem value="renta" id="renta-desktop" />
                    <Label htmlFor="renta-desktop">Renta</Label>
                  </RadioGroup>
                </div>

                <div className="w-48">
                  <Label>Precio</Label>
                  <Slider
                    value={safePriceRange}
                    onValueChange={handlePriceRangeChange}
                    min={minRangeForType}
                    max={maxRangeForType}
                    step={1}
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{formatPriceDisplay(safePriceRange[0])}</span>
                    <span>{formatPriceDisplay(safePriceRange[1])}</span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="recamaras-select-desktop">Recámaras</Label>
                  <Select
                    value={filters.recamaras}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, recamaras: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Cualquier cantidad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Cualquier cantidad</SelectItem>
                      <SelectItem value="1">1+</SelectItem>
                      <SelectItem value="2">2+</SelectItem>
                      <SelectItem value="3">3+</SelectItem>
                      <SelectItem value="4">4+</SelectItem>
                      <SelectItem value="5">5+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="banos-select-desktop">Baños</Label>
                  <Select
                    value={filters.banos}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, banos: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Cualquier cantidad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Cualquier cantidad</SelectItem>
                      <SelectItem value="1">1+</SelectItem>
                      <SelectItem value="2">2+</SelectItem>
                      <SelectItem value="3">3+</SelectItem>
                      <SelectItem value="4">4+</SelectItem>
                      <SelectItem value="5">5+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="orden-select-desktop">Ordenar por</Label>
                  <Select
                    value={filters.orden}
                    onValueChange={handleOrdenChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="price_desc">Precio: Mayor a menor</SelectItem>
                      <SelectItem value="price_asc">Precio: Menor a mayor</SelectItem>
                      <SelectItem value="newest">Más nuevo</SelectItem>
                      <SelectItem value="oldest">Más antiguo</SelectItem>
                      <SelectItem value="bedrooms_desc">Recámaras: Mayor a menor</SelectItem>
                      <SelectItem value="sqft_desc">Metros cuadrados: Mayor a menor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex-1 hidden lg:block" />

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

        <div className="flex flex-col lg:flex-row lg:h-full" style={{ height: 'calc(100vh - 140px)' }}>
          <div className="lg:hidden sticky top-0 z-20 bg-background border-b p-2">
            <div className="flex gap-2">
                    <Button
                      variant={mobileView === 'list' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMobileView('list')}
                      className="flex-1"
                    >
                      <ListIcon className="h-4 w-4 mr-2" />
                      Lista ({totalCount > 0 ? totalCount.toLocaleString() : '0'})
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

          <div className={`relative ${mobileView === 'map' ? 'block' : 'hidden'} lg:block lg:w-1/2 lg:h-full`} style={{ height: 'calc(100vh - 200px)' }}>
            <div className="absolute top-4 left-4 z-10 bg-background/95 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg border">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">
                  {mobileView === 'map' || window.innerWidth >= 1024 ? mapVisibleCount : totalCount}
                </span>
                <span className="text-muted-foreground text-sm">
                  {(mobileView === 'map' || window.innerWidth >= 1024 ? mapVisibleCount : totalCount) === 1 ? 'propiedad' : 'propiedades'}
                </span>
                {isFetching && properties.length > 0 && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            {mapError ? (
              <div className="flex h-full items-center justify-center p-8">
                <div className="text-center max-w-md">
                  <MapIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground mb-2">
                    No pudimos cargar el mapa en este momento.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Puedes seguir usando la lista de propiedades sin problema.
                  </p>
                </div>
              </div>
            ) : (
              <SearchMapMapboxV2
                filters={propertyFilters}
                searchCoordinates={searchCoordinates}
                onMarkerClick={handleMarkerClick}
                onPropertyHover={handlePropertyHoverFromMap}
                hoveredPropertyId={hoveredProperty?.id || null}
                hoveredPropertyCoords={
                  hoveredProperty?.lat && hoveredProperty?.lng
                    ? { lat: hoveredProperty.lat, lng: hoveredProperty.lng }
                    : null
                }
                height="100%"
                onMapError={setMapError}
                onVisibleCountChange={setMapVisibleCount}
              />
            )}
          </div>

          <div className={`w-full lg:w-1/2 overflow-y-auto ${mobileView === 'list' ? 'block' : 'hidden'} lg:block`}>
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

            {!searchError && !loading && filteredProperties.length === 0 && (
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

            {!searchError && filteredProperties.length > 0 && (
              <InfiniteScrollContainer
                onLoadMore={() => {
                  if (hasNextPage && !isFetching) {
                    fetchNextPage();
                  }
                }}
                hasMore={!!hasNextPage}
                isLoading={isFetching}
                className="space-y-4"
              >
                <div className="px-4 pt-2 pb-1 text-sm text-muted-foreground">
                  {hasTooManyResults ? (
                    <p>
                      Mostrando <span className="font-medium text-foreground">{properties.length}</span> de{' '}
                      <span className="font-medium text-foreground">{actualTotal}+</span> resultados.{' '}
                      <span className="text-amber-600 dark:text-amber-500">
                        Refina tus filtros para ver todos.
                      </span>
                    </p>
                  ) : (
                    <p>
                      Mostrando <span className="font-medium text-foreground">{properties.length}</span> de{' '}
                      <span className="font-medium text-foreground">{actualTotal}</span> resultados
                    </p>
                  )}
                </div>

                <SearchResultsList
                  properties={filteredProperties}
                  isLoading={loading && properties.length === 0}
                  listingType={filters.listingType}
                  onPropertyClick={handlePropertyClick}
                  onPropertyHover={handlePropertyHoverFromList}
                  savedSearchesCount={user ? savedSearches.length : 0}
                  onScrollToSavedSearches={() => {
                    const element = document.getElementById('saved-searches');
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  highlightedPropertyId={selectedPropertyFromMap}
                  scrollToPropertyId={selectedPropertyFromMap}
                />

                {hasNextPage && !isFetching && (
                  <div className="flex justify-center py-4 px-4">
                    <Button 
                      onClick={() => fetchNextPage()} 
                      variant="outline"
                      size="lg"
                    >
                      Cargar más propiedades
                    </Button>
                  </div>
                )}
              </InfiniteScrollContainer>
            )}

            <div id="saved-searches" className="mt-8 px-4">
              {user && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold">Búsquedas guardadas</h2>
                    <Select value={savedSearchSort} onValueChange={handleSavedSearchSortChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Más recientes</SelectItem>
                        <SelectItem value="name">Por nombre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {filteredSavedSearches.length === 0 && (
                    <p className="text-sm text-muted-foreground">No tienes búsquedas guardadas.</p>
                  )}
                  <div className="space-y-2">
                    {filteredSavedSearches.map(search => (
                      <Card key={search.id} className="p-3 flex items-center justify-between">
                        <div className="flex-1 cursor-pointer" onClick={() => handleLoadSearch(search.filters)}>
                          {search.name}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSearch(search.id, search.name)}
                          title="Eliminar búsqueda"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </div>
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

export default BuscarV2;
