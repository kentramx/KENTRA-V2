import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProperties } from '@/hooks/useProperties';
import { PlaceAutocomplete } from '@/components/PlaceAutocomplete';
import BasicGoogleMap from '@/components/BasicGoogleMap';
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

import { PropertyDetailSheet } from '@/components/PropertyDetailSheet';

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
  
  const [filters, setFilters] = useState<Filters>({
    estado: searchParams.get('estado') || '',
    municipio: searchParams.get('municipio') || '',
    precioMin: searchParams.get('precioMin') || '',
    precioMax: searchParams.get('precioMax') || '',
    tipo: searchParams.get('tipo') || '',
    listingType: searchParams.get('listingType') || '',
    recamaras: searchParams.get('recamaras') || '',
    banos: searchParams.get('banos') || '',
    orden: (searchParams.get('orden') as any) || 'price_desc',
  });
  
  // Fetch de propiedades con React Query
  const queryFilters = useMemo(() => ({
    estado: filters.estado || undefined,
    municipio: filters.municipio || undefined,
    tipo: filters.tipo || undefined,
    listingType: filters.listingType || undefined,
    precioMin: filters.precioMin ? parseFloat(filters.precioMin) : undefined,
    precioMax: filters.precioMax ? parseFloat(filters.precioMax) : undefined,
    recamaras: filters.recamaras || undefined,
    banos: filters.banos || undefined,
    status: ['activa'],
  }), [filters.estado, filters.municipio, filters.tipo, filters.listingType, filters.precioMin, filters.precioMax, filters.recamaras, filters.banos]);

  const { data: properties = [], isLoading: loading, isFetching } = useProperties(queryFilters);

  // Ordenar propiedades según criterio seleccionado
  // PRIORIDAD: Destacadas primero, luego aplicar orden seleccionado
  const sortedProperties = useMemo(() => {
    const sorted = [...properties];
    
    sorted.sort((a, b) => {
      // 1. Prioridad principal: Destacadas primero
      const aFeatured = a.is_featured ? 1 : 0;
      const bFeatured = b.is_featured ? 1 : 0;
      if (aFeatured !== bFeatured) {
        return bFeatured - aFeatured; // Destacadas primero
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

  const filteredProperties = sortedProperties;
  
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
  const handlePropertyClick = (id: string) => {
    setSelectedPropertyId(id);
    setSheetOpen(true);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('propiedad', id);
    setSearchParams(newParams, { replace: true });
  };
  
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
      precioMin: searchParams.get('precioMin') || '',
      precioMax: searchParams.get('precioMax') || '',
      tipo: searchParams.get('tipo') || '',
      listingType: searchParams.get('listingType') || '',
      recamaras: searchParams.get('recamaras') || '',
      banos: searchParams.get('banos') || '',
      orden: (searchParams.get('orden') as any) || 'price_desc',
    };
    
    // Solo actualizar si hay cambios reales para evitar loops infinitos
    if (JSON.stringify(newFilters) !== JSON.stringify(filters)) {
      setFilters(newFilters);
    } else {
      syncingFromUrl.current = false;
    }
  }, [searchParams]);
  
  // Construir el valor de visualización para el input de ubicación
  const locationDisplayValue = filters.municipio && filters.estado
    ? `${filters.municipio}, ${filters.estado}`
    : filters.estado || '';

  const [estados] = useState<string[]>(mexicoStates);
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [hoveredProperty, setHoveredProperty] = useState<Property | null>(null);
  const propertyCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const hoverFromMap = useRef(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PROPERTIES_PER_PAGE = 20;
  const [mobileView, setMobileView] = useState<'map' | 'list'>('list');

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
  
  // Auto-scroll a la tarjeta cuando se hace hover sobre un marcador del mapa
  useEffect(() => {
    if (hoveredProperty && hoverFromMap.current) {
      const cardElement = propertyCardRefs.current.get(hoveredProperty.id);
      if (cardElement) {
        cardElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
    // Reset flag después de hacer scroll
    hoverFromMap.current = false;
  }, [hoveredProperty]);

  // Reiniciar rango de precios cuando cambia el tipo de operación
  useEffect(() => {
    const [minRange, maxRange] = getPriceRangeForListingType(filters.listingType);
    setPriceRange([minRange, maxRange]);
    
    setFilters(prev => ({
      ...prev,
      precioMin: '',
      precioMax: ''
    }));
  }, [filters.listingType]);

  // Reiniciar a página 1 cuando cambien los filtros
  useEffect(() => {
    setCurrentPage(1);
    
    // Track búsqueda en GA4 cuando se aplican filtros
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
  }, [filters, searchCoordinates, properties]);

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
    // Si estamos sincronizando desde URL, no sobrescribir
    if (syncingFromUrl.current) {
      syncingFromUrl.current = false;
      return;
    }
    
    const params = new URLSearchParams();
    
    if (filters.estado) params.set('estado', filters.estado);
    if (filters.municipio) params.set('municipio', filters.municipio);
    if (filters.precioMin) params.set('precioMin', filters.precioMin);
    if (filters.precioMax) params.set('precioMax', filters.precioMax);
    if (filters.tipo) params.set('tipo', filters.tipo);
    if (filters.listingType) params.set('listingType', filters.listingType);
    if (filters.recamaras) params.set('recamaras', filters.recamaras);
    if (filters.banos) params.set('banos', filters.banos);
    if (filters.orden !== 'price_desc') params.set('orden', filters.orden);
    
    // Agregar coordenadas si existen
    if (searchCoordinates) {
      params.set('lat', searchCoordinates.lat.toString());
      params.set('lng', searchCoordinates.lng.toString());
    }

    // Preserve propiedad parameter
    const propiedad = searchParams.get('propiedad');
    if (propiedad) {
      params.set('propiedad', propiedad);
    }

    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      setSearchParams(params, { replace: true });
    }
  }, [filters, searchCoordinates, searchParams, setSearchParams]);

  useEffect(() => {
    if (filters.estado) {
      setMunicipios(mexicoMunicipalities[filters.estado] || []);
    } else {
      setMunicipios([]);
      setFilters(prev => ({ ...prev, municipio: '' }));
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

  // Mantener flag de isFiltering basado en isFetching
  useEffect(() => {
    setIsFiltering(isFetching);
  }, [isFetching]);

  const handlePropertyHover = (property: Property) => {
    setHoveredProperty(property);
  };

  const handleMarkerClick = (propertyId: string) => {
    handlePropertyClick(propertyId);
  };

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
      // Verificar si ya está en favoritos
      const { data: existing } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('property_id', propertyId)
        .maybeSingle();

      if (existing) {
        // Eliminar de favoritos
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
        // Agregar a favoritos
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
    } catch (error: any) {
      console.error('Error managing favorite:', error);
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
    // Solo limpiar si el input está realmente vacío
    if (!value || value.trim() === '') {
      setFilters(prev => {
        // Si ya están vacíos, no hacer nada
        if (!prev.estado && !prev.municipio) return prev;
        
        return {
          ...prev,
          estado: '',
          municipio: ''
        };
      });
      setSearchCoordinates(null); // Limpiar coordenadas
    }
  };

  const handlePlaceSelect = (location: { address: string; municipality: string; state: string; lat?: number; lng?: number; }) => {
    setFilters(prev => ({
      ...prev,
      estado: location.state || prev.estado,
      municipio: location.municipality || prev.municipio,
    }));

    // Guardar coordenadas de la búsqueda
    if (location.lat && location.lng) {
      setSearchCoordinates({ lat: location.lat, lng: location.lng });
    }

    toast({
      title: 'Ubicación seleccionada',
      description: `${location.municipality}, ${location.state}`,
    });
  };

  const mapMarkers = filteredProperties
    .filter(p => typeof p.lat === 'number' && typeof p.lng === 'number')
    .map(p => ({ 
      id: p.id, 
      lat: p.lat as number, 
      lng: p.lng as number,
      title: p.title,
      price: p.price,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      images: p.images,
      listing_type: p.listing_type as "venta" | "renta",
      address: p.address,
    }));

  // Detectar si hay algún filtro activo
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

  // Calcular centro del mapa con prioridades:
  // 1. Coordenadas de búsqueda (si existen)
  // 2. Propiedad en hover (si existe)
  // 3. Vista completa de México (si no hay filtros)
  // 4. Centro de México por defecto
  const mapCenter = searchCoordinates
    ? searchCoordinates
    : (hoveredProperty && hoveredProperty.lat && hoveredProperty.lng
        ? { lat: hoveredProperty.lat, lng: hoveredProperty.lng }
        : (hasActiveFilters && mapMarkers.length > 0
            ? { lat: mapMarkers[0].lat, lng: mapMarkers[0].lng }
            : { lat: 23.6345, lng: -102.5528 })); // Centro geográfico de México

  // Calcular zoom del mapa:
  // - Sin filtros: zoom alejado para ver todo México (zoom 5)
  // - Con búsqueda específica: zoom cercano (zoom 12)
  // - Con hover: zoom medio-cercano (zoom 14)
  const mapZoom = searchCoordinates 
    ? 12 
    : (hoveredProperty 
        ? 14 
        : (hasActiveFilters 
            ? 12 
            : 5)); // Vista completa de México

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-screen">
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

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        canonical="/buscar"
        structuredData={listStructuredData}
      />
      <Navbar />
      
      <div className="pt-16">
        {/* Barra de búsqueda y filtros compacta estilo Zillow */}
        <div className="border-b bg-background sticky top-16 z-30">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Búsqueda de ubicación */}
              <div className="min-w-[240px] flex-1 lg:flex-initial relative">
                <PlaceAutocomplete
                  key={`location-${locationDisplayValue || 'empty'}`}
                  onPlaceSelect={handlePlaceSelect}
                  onInputChange={handleSearchInputChange as (value: string) => void}
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
                          value={priceRange}
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
                        <RadioGroup value={filters.orden} onValueChange={(value: any) => setFilters(prev => ({ ...prev, orden: value }))}>
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

              {/* Filtros Desktop - Popovers (ocultos en móvil) */}
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
                      value={priceRange}
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
                      onValueChange={(value: any) => setFilters(prev => ({ ...prev, orden: value }))}
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
                    setFilters({
                      estado: '',
                      municipio: '',
                      precioMin: '',
                      precioMax: '',
                      tipo: '',
                      listingType: '',
                      recamaras: '',
                      banos: '',
                      orden: 'price_desc',
                    });
                    setSearchCoordinates(null);
                    setPriceRange([SALE_MIN_PRICE, SALE_MAX_PRICE]);
                  }}
                >
                  Limpiar todo
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Layout estilo Zillow: Mapa a la izquierda, lista a la derecha */}
        <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)]">
          {/* Toggle móvil para cambiar entre mapa y lista */}
          <div className="lg:hidden sticky top-0 z-20 bg-background border-b p-2">
            <div className="flex gap-2">
              <Button
                variant={mobileView === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMobileView('list')}
                className="flex-1"
              >
                <ListIcon className="h-4 w-4 mr-2" />
                Lista ({filteredProperties.length})
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

          {/* Mapa a la izquierda - 50% width en desktop, condicional en móvil */}
          <div className={`relative ${mobileView === 'map' ? 'block' : 'hidden'} lg:block lg:w-1/2 h-[calc(100vh-200px)] lg:h-full`}>
            {/* Contador de resultados sobre el mapa */}
            <div className="absolute top-4 left-4 z-10 bg-background/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border">
              <p className="text-sm font-medium">
                <span className="font-bold text-lg">{filteredProperties.length}</span>
                <span className="text-muted-foreground ml-1">
                  {filteredProperties.length === 1 ? 'propiedad' : 'propiedades'}
                </span>
              </p>
            </div>

            <BasicGoogleMap
              center={mapCenter}
              zoom={mapZoom}
              markers={mapMarkers}
              height="100%"
              className="h-full w-full"
              onMarkerClick={handleMarkerClick}
              onFavoriteClick={handleFavoriteClick}
              disableAutoFit={!hasActiveFilters || !!searchCoordinates}
              hoveredMarkerId={hoveredProperty?.id || null}
              onMarkerHover={(markerId) => {
                if (markerId) {
                  hoverFromMap.current = true;
                  const property = filteredProperties.find(p => p.id === markerId) as Property | undefined;
                  setHoveredProperty(property || null);
                } else {
                  setHoveredProperty(null);
                }
              }}
            />
          </div>

          {/* Lista de propiedades a la derecha - 50% width con scroll */}
          <div className={`w-full lg:w-1/2 overflow-y-auto ${mobileView === 'list' ? 'block' : 'hidden'} lg:block`}>
            <div className="p-4 space-y-4">
              {/* Stats */}
              <PropertyStats properties={filteredProperties} listingType={filters.listingType} />

              {/* Búsquedas guardadas - compacto */}
              {user && savedSearches.length > 0 && (
                <Card>
                  <CardContent className="p-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between"
                      onClick={() => {
                        const element = document.getElementById('saved-searches');
                        element?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          {savedSearches.length} búsqueda{savedSearches.length !== 1 ? 's' : ''} guardada{savedSearches.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              )}

              {isFiltering ? (
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
              ) : filteredProperties.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No encontramos propiedades con estos filtros.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(() => {
                      const startIndex = (currentPage - 1) * PROPERTIES_PER_PAGE;
                      const endIndex = startIndex + PROPERTIES_PER_PAGE;
                      const paginatedProperties = filteredProperties.slice(startIndex, endIndex);
                      
                      const elements: JSX.Element[] = [];
                      let lastWasFeatured = false;
                      
                      paginatedProperties.forEach((property, index) => {
                        // Detectar cambio de destacada a regular
                        const isFeatured = !!property.is_featured;
                        const isFirstRegular = index > 0 && lastWasFeatured && !isFeatured;
                        
                        // Insertar separador cuando cambia de destacadas a regulares
                        if (isFirstRegular) {
                          elements.push(
                            <div key="separator" className="col-span-1 md:col-span-2">
                              <div className="flex items-center gap-3 py-4">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Star className="h-4 w-4" />
                                  <span>Más propiedades</span>
                                </div>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                              </div>
                            </div>
                          );
                        }
                        
                        // Agregar la card de propiedad
                        elements.push(
                          <div
                            key={property.id}
                            ref={(el) => {
                              if (el) {
                                propertyCardRefs.current.set(property.id, el);
                              } else {
                                propertyCardRefs.current.delete(property.id);
                              }
                            }}
                            onMouseEnter={() => {
                              hoverFromMap.current = false;
                              setHoveredProperty(property as Property);
                            }}
                            onMouseLeave={() => setHoveredProperty(null)}
                          >
                            <PropertyCard
                              id={property.id}
                              title={property.title}
                              price={property.price}
                              type={property.type}
                              listingType={property.listing_type}
                              address={property.address}
                              municipality={property.municipality}
                              state={property.state}
                              bedrooms={property.bedrooms || undefined}
                              bathrooms={property.bathrooms || undefined}
                              parking={property.parking || undefined}
                              sqft={property.sqft || undefined}
                              imageUrl={property.images?.[0]?.url}
                              images={property.images}
                              isHovered={hoveredProperty?.id === property.id}
                              agentId={property.agent_id}
                              isFeatured={property.is_featured}
                              createdAt={property.created_at || undefined}
                              onCardClick={handlePropertyClick}
                            />
                          </div>
                        );
                        
                        lastWasFeatured = isFeatured;
                      });
                      
                      return elements;
                    })()}
                  </div>

                  {/* Paginación */}
                  {filteredProperties.length > PROPERTIES_PER_PAGE && (
                    <div className="flex items-center justify-center gap-2 py-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCurrentPage(prev => Math.max(1, prev - 1));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        disabled={currentPage === 1}
                      >
                        <ChevronDown className="h-4 w-4 rotate-90" />
                        Anterior
                      </Button>
                      
                      <div className="flex items-center gap-1">
                        {(() => {
                          const totalPages = Math.ceil(filteredProperties.length / PROPERTIES_PER_PAGE);
                          const pages = [];
                          
                          // Mostrar siempre primera página
                          pages.push(1);
                          
                          // Páginas alrededor de la actual
                          if (currentPage > 3) pages.push('...');
                          
                          for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                            pages.push(i);
                          }
                          
                          // Mostrar siempre última página
                          if (currentPage < totalPages - 2) pages.push('...');
                          if (totalPages > 1) pages.push(totalPages);
                          
                          return pages.map((page, idx) => 
                            page === '...' ? (
                              <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">...</span>
                            ) : (
                              <Button
                                key={page}
                                variant={currentPage === page ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => {
                                  setCurrentPage(page as number);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="min-w-[2.5rem]"
                              >
                                {page}
                              </Button>
                            )
                          );
                        })()}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCurrentPage(prev => Math.min(Math.ceil(filteredProperties.length / PROPERTIES_PER_PAGE), prev + 1));
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        disabled={currentPage === Math.ceil(filteredProperties.length / PROPERTIES_PER_PAGE)}
                      >
                        Siguiente
                        <ChevronDown className="h-4 w-4 -rotate-90" />
                      </Button>
                    </div>
                  )}
                </>
              )}

              {/* Búsquedas guardadas expandido */}
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
                        <Select value={savedSearchSort} onValueChange={(v: 'date' | 'name') => setSavedSearchSort(v)}>
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
        </div>
      </div>
      
      {/* Property Detail Sheet */}
      <PropertyDetailSheet 
        propertyId={selectedPropertyId}
        open={sheetOpen}
        onClose={handleCloseSheet}
      />
    </div>
  );
};

export default Buscar;
