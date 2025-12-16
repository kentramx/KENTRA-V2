import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SearchMap } from '@/components/maps/SearchMap';
import { SearchResultsList } from '@/components/SearchResultsList';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMapData } from '@/hooks/useMapData';
import { PlaceAutocomplete } from '@/components/PlaceAutocomplete';
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
import type { MapProperty, HoveredProperty } from '@/types/property';
import type { MapViewport, MapFilters, PropertyMarker } from '@/types/map';
import { GOOGLE_MAPS_CONFIG } from '@/config/googleMaps';

const MIN_ZOOM_FOR_TILES = GOOGLE_MAPS_CONFIG.zoom.showPropertiesAt;

interface Filters {
  estado: string;
  municipio: string;
  colonia: string; // ✅ Agregado para búsqueda por colonia
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
  
  // ✅ Estado para sincronizar clic en mapa con tarjeta de lista
  const [selectedPropertyFromMap, setSelectedPropertyFromMap] = useState<string | null>(null);
  
  // 🎯 AUTO-ZOOM TO RESULTS - Flag para activar fitBounds después de búsqueda
  const [pendingAutoZoom, setPendingAutoZoom] = useState(false);
  
  // 🗺️ Estados del mapa movidos al nuevo SearchMap
  // (viewportBounds ahora se deriva de mapViewport)
  
// Rangos predefinidos para VENTA (en pesos MXN)
const SALE_PRICE_RANGES = [
  { label: 'Cualquier precio', min: '', max: '' },
  { label: 'Hasta $1M', min: '', max: '1000000' },
  { label: '$1M - $2M', min: '1000000', max: '2000000' },
  { label: '$2M - $3M', min: '2000000', max: '3000000' },
  { label: '$3M - $5M', min: '3000000', max: '5000000' },
  { label: '$5M - $10M', min: '5000000', max: '10000000' },
  { label: '$10M - $20M', min: '10000000', max: '20000000' },
  { label: '$20M - $50M', min: '20000000', max: '50000000' },
  { label: '$50M+', min: '50000000', max: '' },
];

// Rangos predefinidos para RENTA (mensual en pesos MXN)
const RENT_PRICE_RANGES = [
  { label: 'Cualquier precio', min: '', max: '' },
  { label: 'Hasta $5,000', min: '', max: '5000' },
  { label: '$5,000 - $10,000', min: '5000', max: '10000' },
  { label: '$10,000 - $15,000', min: '10000', max: '15000' },
  { label: '$15,000 - $25,000', min: '15000', max: '25000' },
  { label: '$25,000 - $40,000', min: '25000', max: '40000' },
  { label: '$40,000 - $60,000', min: '40000', max: '60000' },
  { label: '$60,000 - $100,000', min: '60000', max: '100000' },
  { label: '$100,000+', min: '100000', max: '' },
];

// Helper para obtener rangos según tipo de operación
const getPriceRanges = (listingType: string) => {
  return listingType === 'renta' ? RENT_PRICE_RANGES : SALE_PRICE_RANGES;
};

// Helper para obtener el label del rango actual
const getCurrentPriceRangeLabel = (precioMin: string, precioMax: string, listingType: string) => {
  const ranges = getPriceRanges(listingType);
  const found = ranges.find(r => r.min === precioMin && r.max === precioMax);
  return found?.label || 'Precio';
};
  
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [savedSearchQuery, setSavedSearchQuery] = useState('');
  const [savedSearchSort, setSavedSearchSort] = useState<'date' | 'name'>('date');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  
  // Valores por defecto para filtros
  const DEFAULT_FILTERS: Filters = {
    estado: '',
    municipio: '',
    colonia: '', // ✅ Agregado
    precioMin: '',
    precioMax: '',
    tipo: '',
    listingType: 'venta',
    recamaras: '',
    banos: '',
    orden: 'price_desc',
  };

  const [filters, setFilters] = useState<Filters>({
    estado: searchParams.get('estado') || '',
    municipio: searchParams.get('municipio') || '',
    colonia: searchParams.get('colonia') || '', // ✅ Agregado
    precioMin: searchParams.get('precioMin') || '',
    precioMax: searchParams.get('precioMax') || '',
    tipo: searchParams.get('tipo') || '',
    listingType: searchParams.get('listingType') || 'venta',
    recamaras: searchParams.get('recamaras') || '',
    banos: searchParams.get('banos') || '',
    orden: (searchParams.get('orden') as any) || 'price_desc',
  });
  
  // ✅ DEBUG: Logs temporales para rastrear cambios de listingType
  useEffect(() => {
    console.log('[Buscar Debug] filters.listingType changed to:', filters.listingType);
  }, [filters.listingType]);

  useEffect(() => {
    console.log('[Buscar Debug] URL listingType changed to:', searchParams.get('listingType'));
  }, [searchParams]);
  
  // ✅ ELIMINADO: Efecto duplicado que causaba loops infinitos
  // Este efecto está ahora consolidado en las líneas 543-579
  
  // ✅ Construir filtros de manera unificada
  // 🗺️ Convertir filtros a formato MapFilters (FUENTE ÚNICA)
  const mapFilters: MapFilters = useMemo(() => ({
    listing_type: filters.listingType as 'venta' | 'renta' | undefined,
    property_type: filters.tipo || undefined,
    min_price: filters.precioMin ? Number(filters.precioMin) : undefined,
    max_price: filters.precioMax ? Number(filters.precioMax) : undefined,
    min_bedrooms: filters.recamaras ? Number(filters.recamaras) : undefined,
    min_bathrooms: filters.banos ? Number(filters.banos) : undefined,
    state: filters.estado || undefined,
    municipality: filters.municipio || undefined,
    colonia: filters.colonia || undefined,
  }), [filters]);

  // 🗺️ Estado del mapa
  // Viewport por defecto: México completo (para lista sin mapa visible)
  const DEFAULT_MEXICO_VIEWPORT: MapViewport = {
    center: { lat: 23.6345, lng: -102.5528 },
    zoom: 5,
    bounds: {
      north: 32.7187,  // Frontera norte
      south: 14.5345,  // Frontera sur  
      east: -86.7104,  // Este (Cancún)
      west: -118.3644, // Oeste (Tijuana)
    }
  };

  // ✅ Inicializar viewport desde URL si hay coordenadas, sino usar default de México
  const [mapViewport, setMapViewport] = useState<MapViewport>(() => {
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    if (lat && lng) {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      const DELTA_LAT = 0.15;
      const DELTA_LNG = 0.2;
      return {
        center: { lat: latNum, lng: lngNum },
        zoom: 12,
        bounds: {
          north: latNum + DELTA_LAT,
          south: latNum - DELTA_LAT,
          east: lngNum + DELTA_LNG,
          west: lngNum - DELTA_LNG,
        }
      };
    }
    // ✅ Sin coordenadas: usar viewport de México para que la lista cargue
    return DEFAULT_MEXICO_VIEWPORT;
  });
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);

  // ✅ FUENTE ÚNICA DE DATOS: useMapData alimenta MAPA y LISTA
  const {
    data: mapData,
    isLoading: loading,
    isFetching,
    isPending: isViewportPending, // Viewport esperando debounce
    isIdle: mapIsIdle, // Query deshabilitado (esperando viewport válido)
    error: mapError,
  } = useMapData({
    viewport: mapViewport,
    filters: mapFilters,
    enabled: !!mapViewport,
  });

  // Extraer datos de la fuente única
  const properties = mapData?.properties || [];
  const clusters = mapData?.clusters || [];
  const totalCount = mapData?.total_in_viewport || 0;
  const isClustered = mapData?.is_clustered || false;
  const searchError = mapError;

  // Variables para compatibilidad con código existente
  const hasNextPage = false; // Ya no hay paginación infinita - todo viene del viewport
  const fetchNextPage = () => {}; // No-op
  const hasTooManyResults = isClustered;
  const actualTotal = totalCount;

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
  const listProperties = sortedProperties;
  
  // Estado para guardar coordenadas de la ubicación buscada
  // ✅ Inicializar desde URL inmediatamente para evitar flash
  const [searchCoordinates, setSearchCoordinates] = useState<{ lat: number; lng: number } | null>(() => {
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    if (lat && lng) {
      return { lat: parseFloat(lat), lng: parseFloat(lng) };
    }
    return null;
  });
  
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
  
  // ✅ Sincronizar filters con searchParams cuando la URL cambia
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
      colonia: searchParams.get('colonia') || '', // ✅ Agregado
      precioMin: searchParams.get('precioMin') || '',
      precioMax: searchParams.get('precioMax') || '',
      tipo: searchParams.get('tipo') || '',
      listingType: searchParams.get('listingType') || 'venta', // ✅ Siempre default a 'venta'
      recamaras: searchParams.get('recamaras') || '',
      banos: searchParams.get('banos') || '',
      orden: (searchParams.get('orden') as any) || 'price_desc',
    };
    
    // Solo actualizar si hay cambios reales para evitar loops infinitos
    if (JSON.stringify(newFilters) !== JSON.stringify(filters)) {
      setFilters(newFilters);
    }
    
    // ✅ Liberar flag en microtask para garantizar que el otro efecto lo vea
    Promise.resolve().then(() => {
      syncingFromUrl.current = false;
    });
  }, [searchParams]); // ✅ Remover 'filters' de dependencias para evitar loops
  
  // Construir el valor de visualización para el input de ubicación
  const locationDisplayValue = filters.municipio && filters.estado
    ? `${filters.municipio}, ${filters.estado}`
    : filters.estado || '';

  const [estados] = useState<string[]>(mexicoStates);
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [hoveredProperty, setHoveredProperty] = useState<MapProperty | null>(null);
  const hoverFromMap = useRef(false);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('list');
  const [mapDisplayError, setMapDisplayError] = useState<string | null>(null);

  // Flag de viewport activo
  const isViewportActive = !!mapViewport;
  
  // Flag para evitar mostrar "No encontramos propiedades" antes de que el mapa reporte viewport
  // ✅ Siempre hay viewport inicial (DEFAULT_MEXICO_VIEWPORT), nunca esperamos
  const isWaitingForViewport = false;


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
  
  // ✅ Callback para manejar hover de propiedades desde el mapa
  const handlePropertyHoverFromMap = useCallback((property: MapProperty | null) => {
    hoverFromMap.current = true;
    setHoveredProperty(property);
  }, []);

  // ✅ Reiniciar precio al cambiar tipo de operación
  useEffect(() => {
    // Limpiar precios cuando cambia venta ↔ renta ya que los rangos son diferentes
    setFilters((prev) => ({
      ...prev,
      precioMin: '',
      precioMax: '',
    }));
  }, [filters.listingType]);

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


  // ✅ Sincronización filters → URL (optimizado para evitar loops infinitos)
  useEffect(() => {
    // 🚫 Si estamos sincronizando desde URL, no sobrescribir
    if (syncingFromUrl.current) {
      console.log('[Buscar] Sincronización bloqueada: syncingFromUrl activo');
      return;
    }
    
    const params = new URLSearchParams();
    
    if (filters.estado) params.set('estado', filters.estado);
    if (filters.municipio) params.set('municipio', filters.municipio);
    if (filters.colonia) params.set('colonia', filters.colonia); // ✅ Agregado
    if (filters.precioMin) params.set('precioMin', filters.precioMin);
    if (filters.precioMax) params.set('precioMax', filters.precioMax);
    if (filters.tipo) params.set('tipo', filters.tipo);
    
    // ✅ CRÍTICO: Siempre persistir listingType (no condicional)
    params.set('listingType', filters.listingType || 'venta');
    
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

    // ✅ Solo actualizar si el string de parámetros cambió realmente
    const next = params.toString();
    const current = searchParams.toString();
    
    if (next !== current) {
      console.log('[Buscar] Actualizando URL:', { next, current });
      setSearchParams(params, { replace: true });
    } else {
      console.log('[Buscar] URL sin cambios, skip update');
    }
  }, [filters, searchCoordinates]); // ✅ Removidas dependencias circulares searchParams y setSearchParams

  useEffect(() => {
    if (filters.estado) {
      setMunicipios(mexicoMunicipalities[filters.estado] || []);
    } else {
      setMunicipios([]);
      // No modificar filters aquí - dejar que el usuario limpie municipio manualmente
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

    // ✅ Chip para colonia
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

  // Solo mostrar loading completo en carga inicial (sin datos previos)
  useEffect(() => {
    setIsFiltering(isFetching && properties.length === 0);
  }, [isFetching, properties.length]);

  // ✅ Callback para hover de propiedades desde la lista
  const handlePropertyHoverFromList = useCallback((property: HoveredProperty | null) => {
    hoverFromMap.current = false;
    
    // ✅ SYNC BIDIRECCIONAL: Establecer hoveredPropertyId para que el mapa lo use
    setHoveredPropertyId(property?.id || null);
    
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

  // ✅ Handler: cuando se hace clic en un marcador del mapa
  const handleMarkerClick = useCallback((propertyId: string) => {
    monitoring.debug('[Buscar] Click en marcador del mapa', {
      component: 'Buscar',
      action: 'markerClick',
      propertyId,
    });
    
    // 1. Establecer la propiedad seleccionada para scroll + resaltado
    setSelectedPropertyFromMap(propertyId);
    
    // 2. Abrir el Sheet con los detalles de la propiedad
    handlePropertyClick(propertyId);
    
    // 3. Remover el resaltado después de 2 segundos
    setTimeout(() => {
      setSelectedPropertyFromMap(null);
    }, 2000);
    
    // 4. Tracking de evento
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
        if (!prev.estado && !prev.municipio && !prev.colonia) return prev;
        
        return {
          ...prev,
          estado: '',
          municipio: '',
          colonia: ''
        };
      });
      setSearchCoordinates(null); // Limpiar coordenadas
    }
  };

  const handlePlaceSelect = (location: { address: string; municipality: string; state: string; colonia?: string; lat?: number; lng?: number; }) => {
    setFilters(prev => ({
      ...prev,
      estado: location.state || '',
      municipio: location.municipality || '',
      colonia: location.colonia || '',
    }));

    // Guardar coordenadas de la búsqueda y forzar nuevo viewport
    if (location.lat && location.lng) {
      setSearchCoordinates({ lat: location.lat, lng: location.lng });
      
      // 🎯 Forzar viewport centrado en la ubicación buscada
      // Esto asegura que useMapData fetchee datos de la zona correcta
      // antes de ejecutar fitBounds
      const DELTA_LAT = 0.15; // ~16km norte-sur
      const DELTA_LNG = 0.2;  // ~18km este-oeste
      setMapViewport({
        center: { lat: location.lat, lng: location.lng },
        zoom: 12,
        bounds: {
          north: location.lat + DELTA_LAT,
          south: location.lat - DELTA_LAT,
          east: location.lng + DELTA_LNG,
          west: location.lng - DELTA_LNG,
        }
      });
    }

    // 🎯 Activar Auto-zoom para ajustar vista a los resultados
    // Se ejecutará DESPUÉS de que lleguen los datos filtrados
    setPendingAutoZoom(true);

    // ✅ Mostrar colonia en el toast si está disponible
    const description = location.colonia 
      ? `${location.colonia}, ${location.municipality}, ${location.state}`
      : `${location.municipality}, ${location.state}`;

    toast({
      title: 'Ubicación seleccionada',
      description,
    });
  };

  // Memoizar marcadores para evitar recreación innecesaria
  // Ya no se usa - SearchMap maneja su propia carga de propiedades

  // Conteo total de propiedades filtradas
  // ✅ Usar SearchResultsList en lugar de renderizado manual
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

  // Detectar si hay filtros geográficos/específicos (excluye listingType)
  const hasLocationFilters = !!(
    filters.estado || 
    filters.municipio || 
    filters.tipo || 
    filters.precioMin || 
    filters.precioMax || 
    filters.recamaras || 
    filters.banos
  );

  // Map center and zoom are now managed by SearchMap internally
  // Ya no es necesario actualizar el centro y zoom manualmente

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

  // Handlers for form controls (defined outside JSX to avoid type parsing issues)
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
        ogImage={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/og-image?type=search&estado=${encodeURIComponent(filters.estado || '')}&municipio=${encodeURIComponent(filters.municipio || '')}&tipo=${encodeURIComponent(filters.tipo || '')}&listingType=${encodeURIComponent(filters.listingType || '')}`}
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
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Rango de precio</h4>
                        <Select
                          value={getCurrentPriceRangeLabel(filters.precioMin, filters.precioMax, filters.listingType)}
                          onValueChange={(value) => {
                            const ranges = getPriceRanges(filters.listingType);
                            const selected = ranges.find(r => r.label === value);
                            if (selected) {
                              setFilters(prev => ({
                                ...prev,
                                precioMin: selected.min,
                                precioMax: selected.max,
                              }));
                            }
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Cualquier precio" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {getPriceRanges(filters.listingType).map((range) => (
                              <SelectItem key={range.label} value={range.label}>
                                {range.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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

              {/* 4. Precio - Dropdown con rangos predefinidos */}
              <Select
                value={getCurrentPriceRangeLabel(filters.precioMin, filters.precioMax, filters.listingType)}
                onValueChange={(value) => {
                  const ranges = getPriceRanges(filters.listingType);
                  const selected = ranges.find(r => r.label === value);
                  if (selected) {
                    setFilters(prev => ({
                      ...prev,
                      precioMin: selected.min,
                      precioMax: selected.max,
                    }));
                  }
                }}
              >
                <SelectTrigger className="w-auto min-w-[140px] h-9 text-sm">
                  <SelectValue placeholder="Precio" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {getPriceRanges(filters.listingType).map((range) => (
                    <SelectItem key={range.label} value={range.label}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
                    // La URL se limpiará automáticamente por el useEffect de sincronización
                  }}
                >
                  Limpiar filtros
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Layout estilo Zillow: Mapa a la izquierda, lista a la derecha */}
        <div className="flex flex-col lg:flex-row lg:h-full" style={{ height: 'calc(100vh - 140px)' }}>
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

          {/* Mapa a la izquierda - 50% width en desktop, condicional en móvil */}
          <div 
            className={`relative ${mobileView === 'map' ? 'block' : 'hidden'} lg:block lg:w-1/2 lg:h-full`} 
            style={{ 
              height: mobileView === 'map' 
                ? 'calc(100vh - 120px)'  // Más espacio para el mapa en móvil
                : 'calc(100vh - 200px)' 
            }}
          >
            {/* ✅ Mapa con filtros unificados y manejo de errores */}
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
              <SearchMap
                properties={properties}
                clusters={clusters}
                totalCount={totalCount}
                isClustered={isClustered}
                isLoading={loading}
                isIdle={mapIsIdle}
                isFetching={isFetching}
                isPending={isViewportPending}
                initialCenter={searchCoordinates || undefined}
                initialZoom={searchCoordinates ? 12 : 5}
                height="100%"
                selectedPropertyId={selectedPropertyFromMap}
                hoveredPropertyId={hoveredPropertyId}
                fitToBounds={pendingAutoZoom && properties.length > 0}
                onFitComplete={() => setPendingAutoZoom(false)}
                onPropertyClick={handleMarkerClick}
                onPropertyHover={(property) => setHoveredPropertyId(property?.id || null)}
                onViewportChange={setMapViewport}
              />
            )}
          </div>

          {/* ✅ Lista de propiedades con estados mejorados */}
          <div className={`w-full lg:w-1/2 overflow-y-auto ${mobileView === 'list' ? 'block' : 'hidden'} lg:block`}>
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

            {/* Estado: Esperando viewport del mapa (evita flash de "No encontramos") */}
            {!searchError && isWaitingForViewport && (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Cargando mapa y propiedades...</span>
                </div>
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-48 w-full" />
                ))}
              </div>
            )}

            {/* Estado de carga inicial (viewport ya disponible) */}
            {!searchError && !isWaitingForViewport && loading && properties.length === 0 && (
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

            {/* Estado vacío - sin resultados (solo cuando viewport está listo, no hay carga, ni fetching, ni debounce pendiente) */}
            {!searchError && !isWaitingForViewport && !loading && !isFetching && !isViewportPending && listProperties.length === 0 && (
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
                {/* 🔍 Panel de diagnóstico en modo debug */}
                {typeof window !== 'undefined' && (window as any).__KENTRA_MAP_DEBUG__ === true && (
                  <div className="mt-4 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-xs font-mono text-yellow-900 max-w-2xl">
                    <div className="font-bold mb-1">🔍 DEBUG INFO:</div>
                    <div>Zoom: {mapViewport?.zoom?.toFixed(2) || 'N/A'}</div>
                    <div>Estado: {filters.estado || '(ninguno)'}</div>
                    <div>Municipio: {filters.municipio || '(ninguno)'}</div>
                    <div>Colonia: {filters.colonia || '(ninguno)'}</div>
                    <div>Tipo: {filters.tipo || '(todos)'}</div>
                    <div>Operación: {filters.listingType}</div>
                    {mapViewport && (
                      <div>
                        Bounds: {mapViewport.bounds.south.toFixed(4)},{mapViewport.bounds.west.toFixed(4)} →{' '}
                        {mapViewport.bounds.north.toFixed(4)},{mapViewport.bounds.east.toFixed(4)}
                      </div>
                    )}
                    <div>Properties: {properties.length}</div>
                    <div>Clusters: {clusters.length}</div>
                    <div>isViewportActive: {isViewportActive ? 'true' : 'false'}</div>
                    <div>listProperties.length: {listProperties.length}</div>
                  </div>
                )}
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
                  if (!isViewportActive && hasNextPage && !isFetching) {
                    fetchNextPage();
                  }
                }}
                hasMore={!!hasNextPage}
                isLoading={isFetching}
                className="space-y-4"
              >
                {/* Contador de resultados */}
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
                  properties={listProperties}
                  isLoading={loading && properties.length === 0}
                  listingType={filters.listingType}
                  onPropertyClick={handlePropertyClick}
                  onPropertyHover={handlePropertyHoverFromList}
                  savedSearchesCount={user ? savedSearches.length : 0}
                  onScrollToSavedSearches={() => {
                    const element = document.getElementById('saved-searches');
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  highlightedPropertyId={hoveredPropertyId || selectedPropertyFromMap}
                  scrollToPropertyId={selectedPropertyFromMap}
                />

                {/* Botón fallback para cargar más si IntersectionObserver falla */}
                {!isViewportActive && hasNextPage && !isFetching && (
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

            {/* Búsquedas guardadas expandido */}
            {user && savedSearches.length > 0 && (
              <div id="saved-searches" className="pt-8 px-4">
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

