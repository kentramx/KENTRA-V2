/// <reference types="google.maps" />
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PlaceAutocomplete } from '@/components/PlaceAutocomplete';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import Navbar from '@/components/Navbar';
import { PropertyImageGallery } from '@/components/PropertyImageGallery';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { MapPin, Bed, Bath, Car, Home as HomeIcon, Search, AlertCircle, Save, Star, Trash2, X, Loader2, Tag, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { mexicoStates, mexicoMunicipalities } from '@/data/mexicoLocations';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { PropertyStats } from '@/components/PropertyStats';

// Función throttle para optimizar rendimiento
const throttle = <T extends (...args: any[]) => void>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastRan = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastRan >= delay) {
      func(...args);
      lastRan = now;
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func(...args);
        lastRan = Date.now();
      }, delay - (now - lastRan));
    }
  };
};

// Función debounce para optimizar hover
const debounce = <T extends (...args: any[]) => void>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

// Cache de iconos de marcadores a nivel módulo
const iconCache = new Map<string, string>();

// Contadores de cache para telemetría
let iconCacheHits = 0;
let iconCacheMisses = 0;

// Función para obtener bucket de precio
const getPriceBucket = (price: number): string => {
  if (price < 1000000) return 'economic';
  if (price < 3000000) return 'medium';
  if (price < 5000000) return 'high';
  return 'premium';
};

// Función para obtener icono cacheado
const getCachedIcon = (type: string, bucket: string): string => {
  const key = `${type}-${bucket}`;
  
  if (iconCache.has(key)) {
    iconCacheHits++;
    return iconCache.get(key)!;
  }
  
  iconCacheMisses++;
  
  // Mapeo de colores por bucket
  const colorMap: Record<string, string> = {
    economic: '#10B981',
    medium: '#3B82F6',
    high: '#F59E0B',
    premium: '#EF4444'
  };
  
  const color = colorMap[bucket] || colorMap.medium;
  
  // Mapeo de iconos por tipo
  const icons: Record<string, string> = {
    casa: `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>`,
    departamento: `<rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line>`,
    terreno: `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>`,
    oficina: `<rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line>`,
    local: `<path d="M3 3h18v18H3z"></path><path d="M3 9h18"></path><path d="M9 21V9"></path>`,
    bodega: `<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path>`,
    edificio: `<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path><path d="M10 6h4"></path><path d="M10 10h4"></path><path d="M10 14h4"></path><path d="M10 18h4"></path>`,
    rancho: `<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>`,
  };
  
  const iconPath = icons[type] || icons['casa'];
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="11" fill="${color}" opacity="0.9"/>
      <g transform="scale(0.7) translate(4.2, 4.2)">
        ${iconPath}
      </g>
    </svg>
  `;
  
  // Encodear y cachear
  const encodedSvg = btoa(unescape(encodeURIComponent(svg)));
  const dataUri = `data:image/svg+xml;base64,${encodedSvg}`;
  
  iconCache.set(key, dataUri);
  return dataUri;
};

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
  listing_type: 'venta' | 'renta';
  images: { url: string; position: number }[];
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
  orden: 'asc' | 'desc';
}

const Buscar = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoadingProgress, setMapLoadingProgress] = useState(0);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [visiblePropertiesCount, setVisiblePropertiesCount] = useState(0);
  const [mapFilterActive, setMapFilterActive] = useState(false);
  const [propertiesInViewport, setPropertiesInViewport] = useState<Property[]>([]);
  const [markersLoadingProgress, setMarkersLoadingProgress] = useState(0);
  const [isLoadingMarkers, setIsLoadingMarkers] = useState(false);
  const [viewportBounds, setViewportBounds] = useState<google.maps.LatLngBounds | null>(null);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [isLoadingViewport, setIsLoadingViewport] = useState(false);
  
  // Ref para debounced function
  const debouncedFetchByViewportRef = useRef<((bounds: google.maps.LatLngBounds) => void) | null>(null);
  
  // Crear función debounced para hover (150ms de delay)
  const debouncedSetHoveredProperty = useCallback(
    debounce((propertyId: string | null) => {
      setHoveredPropertyId(propertyId);
    }, 150),
    []
  );
  
  // Estado para el slider de precios (en millones)
  const MIN_PRICE = 0;
  const MAX_PRICE = 100; // 100 millones
  const [priceRange, setPriceRange] = useState<[number, number]>([MIN_PRICE, MAX_PRICE]);
  
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [savedSearchQuery, setSavedSearchQuery] = useState('');
  const [savedSearchSort, setSavedSearchSort] = useState<'date' | 'name'>('date');
  
  // Inicializar filtros desde URL
  const [filters, setFilters] = useState<Filters>({
    estado: searchParams.get('estado') || '',
    municipio: searchParams.get('municipio') || '',
    precioMin: searchParams.get('precioMin') || '',
    precioMax: searchParams.get('precioMax') || '',
    tipo: searchParams.get('tipo') || '',
    listingType: searchParams.get('listingType') || '',
    recamaras: searchParams.get('recamaras') || '',
    banos: searchParams.get('banos') || '',
    orden: (searchParams.get('orden') as 'asc' | 'desc') || 'desc',
  });

  const [estados] = useState<string[]>(mexicoStates);
  const [municipios, setMunicipios] = useState<string[]>([]);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const markerClustererRef = useRef<MarkerClusterer | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const markerMapRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const renderingRef = useRef<boolean>(false);
  const boundsListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Filtrar y ordenar búsquedas guardadas
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

  // Propiedades a mostrar según el filtro de viewport
  const propertiesToDisplay = mapFilterActive ? propertiesInViewport : filteredProperties;

  // Cargar búsquedas guardadas del usuario
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

  // Inicializar slider de precios desde filtros URL
  useEffect(() => {
    const minFromUrl = filters.precioMin ? parseFloat(filters.precioMin) / 1000000 : MIN_PRICE;
    const maxFromUrl = filters.precioMax ? parseFloat(filters.precioMax) / 1000000 : MAX_PRICE;
    setPriceRange([minFromUrl, maxFromUrl]);
  }, []);

  // Sincronizar slider con filtros
  const handlePriceRangeChange = (values: number[]) => {
    setPriceRange(values as [number, number]);
    
    // Actualizar filtros (convertir millones a pesos)
    setFilters(prev => ({
      ...prev,
      precioMin: values[0] === MIN_PRICE ? '' : (values[0] * 1000000).toString(),
      precioMax: values[1] === MAX_PRICE ? '' : (values[1] * 1000000).toString(),
    }));
  };

  // Formatear precio para mostrar
  const formatPriceDisplay = (millions: number) => {
    if (millions === 0) return '$0';
    if (millions === MAX_PRICE) return 'Sin límite';
    
    if (millions >= 1) {
      return `$${millions.toFixed(1)}M`;
    } else {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(millions * 1000000);
    }
  };

  // Actualizar URL cuando cambien los filtros
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (filters.estado) params.set('estado', filters.estado);
    if (filters.municipio) params.set('municipio', filters.municipio);
    if (filters.precioMin) params.set('precioMin', filters.precioMin);
    if (filters.precioMax) params.set('precioMax', filters.precioMax);
    if (filters.tipo) params.set('tipo', filters.tipo);
    if (filters.listingType) params.set('listingType', filters.listingType);
    if (filters.recamaras) params.set('recamaras', filters.recamaras);
    if (filters.banos) params.set('banos', filters.banos);
    if (filters.orden !== 'desc') params.set('orden', filters.orden);

    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  // Fetch inicial de propiedades (limitado a viewport inicial - CDMX)
  useEffect(() => {
    const fetchProperties = async () => {
      console.time('[Fetch] Carga inicial de propiedades');
      
      try {
        // Cargar solo propiedades en área inicial (CDMX aproximado)
        const { data, error } = await supabase
          .from('properties')
          .select(`
            id, title, price, bedrooms, bathrooms, parking, 
            lat, lng, address, state, municipality, type, listing_type,
            images (url, position)
          `)
          .eq('status', 'activa')
          .gte('lat', 19.2)
          .lte('lat', 19.6)
          .gte('lng', -99.3)
          .lte('lng', -98.9)
          .order('position', { foreignTable: 'images', ascending: true })
          .limit(500);

        if (error) throw error;

        const propertiesWithSortedImages = data?.map(property => ({
          ...property,
          type: property.type === 'local_comercial' ? 'local' : property.type,
          images: (property.images || []).sort((a: any, b: any) => a.position - b.position)
        })) as Property[] || [];

        setProperties(propertiesWithSortedImages);
        setFilteredProperties(propertiesWithSortedImages);
        setHasMoreResults(data?.length === 500);
        
        console.timeEnd('[Fetch] Carga inicial de propiedades');
      } catch (error) {
        console.error('Error fetching properties:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []);

  // Función para fetch por viewport
  const fetchPropertiesByViewport = async (bounds: google.maps.LatLngBounds) => {
    if (isLoadingViewport) return;
    
    setIsLoadingViewport(true);
    console.time('[Fetch] Propiedades por viewport');
    
    try {
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      
      let query = supabase
        .from('properties')
        .select(`
          id, title, price, bedrooms, bathrooms, parking, 
          lat, lng, address, state, municipality, type, listing_type,
          images (url, position)
        `)
        .eq('status', 'activa')
        .gte('lat', sw.lat())
        .lte('lat', ne.lat())
        .gte('lng', sw.lng())
        .lte('lng', ne.lng());
      
      // Aplicar filtros activos
      if (filters.estado) query = query.eq('state', filters.estado);
      if (filters.municipio) query = query.eq('municipality', filters.municipio);
      if (filters.tipo) query = query.eq('type', filters.tipo as any);
      if (filters.listingType) query = query.eq('listing_type', filters.listingType);
      if (filters.precioMin) query = query.gte('price', parseFloat(filters.precioMin));
      if (filters.precioMax) query = query.lte('price', parseFloat(filters.precioMax));
      
      query = query.order('position', { foreignTable: 'images', ascending: true })
                   .limit(500);
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const propertiesWithSortedImages = data?.map(property => ({
        ...property,
        type: property.type === 'local_comercial' ? 'local' : property.type,
        images: (property.images || []).sort((a: any, b: any) => a.position - b.position)
      })) as Property[] || [];
      
      setProperties(propertiesWithSortedImages);
      setFilteredProperties(propertiesWithSortedImages);
      setHasMoreResults(data?.length === 500);
      
      if (data?.length === 500) {
        toast({
          title: "Hay más resultados disponibles",
          description: "Acerca el zoom o ajusta los filtros para ver todas las propiedades",
          duration: 4000,
        });
      }
      
      console.timeEnd('[Fetch] Propiedades por viewport');
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setIsLoadingViewport(false);
    }
  };

  // Create debounced version of fetchPropertiesByViewport
  useEffect(() => {
    debouncedFetchByViewportRef.current = debounce(
      (bounds: google.maps.LatLngBounds) => fetchPropertiesByViewport(bounds),
      400
    );
  }, [filters]);

  // Actualizar municipios cuando cambia el estado
  useEffect(() => {
    if (filters.estado) {
      setMunicipios(mexicoMunicipalities[filters.estado] || []);
    } else {
      setMunicipios([]);
      setFilters(prev => ({ ...prev, municipio: '' }));
    }
  }, [filters.estado]);

  // Función para remover filtro individual
  const removeFilter = (filterKey: keyof Filters) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: filterKey === 'orden' ? 'desc' : ''
    }));
  };

  // Función para generar chips de filtros activos
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

  // Contar filtros activos
  const activeFiltersCount = [
    filters.estado,
    filters.municipio,
    filters.precioMin,
    filters.precioMax,
    filters.tipo,
    filters.listingType,
    filters.recamaras,
    filters.banos,
  ].filter(Boolean).length;

  // Aplicar filtros
  useEffect(() => {
    let filtered = [...properties];

    if (filters.estado) {
      filtered = filtered.filter(p => p.state === filters.estado);
    }

    if (filters.municipio) {
      filtered = filtered.filter(p => p.municipality === filters.municipio);
    }

    if (filters.precioMin) {
      filtered = filtered.filter(p => p.price >= Number(filters.precioMin));
    }

    if (filters.precioMax) {
      filtered = filtered.filter(p => p.price <= Number(filters.precioMax));
    }

    if (filters.tipo) {
      filtered = filtered.filter(p => p.type === filters.tipo);
    }

    if (filters.listingType) {
      filtered = filtered.filter(p => p.listing_type === filters.listingType);
    }

    if (filters.recamaras) {
      filtered = filtered.filter(p => (p.bedrooms || 0) >= Number(filters.recamaras));
    }

    if (filters.banos) {
      filtered = filtered.filter(p => (p.bathrooms || 0) >= Number(filters.banos));
    }

    // Ordenar por precio
    filtered.sort((a, b) => 
      filters.orden === 'asc' ? a.price - b.price : b.price - a.price
    );

    setFilteredProperties(filtered);
  }, [filters, properties]);

  // Centrar mapa cuando cambien los filtros de ubicación
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady || filteredProperties.length === 0) return;

    // Calcular el centro y los bounds de las propiedades filtradas
    const propertiesWithCoords = filteredProperties.filter(p => p.lat && p.lng);
    
    if (propertiesWithCoords.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    propertiesWithCoords.forEach(property => {
      bounds.extend(new google.maps.LatLng(Number(property.lat), Number(property.lng)));
    });

    // Ajustar el mapa a los bounds con transición suave
    mapInstanceRef.current.fitBounds(bounds, 50);

    // Ajustar zoom según el contexto después del fitBounds
    setTimeout(() => {
      if (!mapInstanceRef.current) return;
      
      if (propertiesWithCoords.length === 1) {
        // Una sola propiedad: zoom cercano
        mapInstanceRef.current.setZoom(14);
      } else if (propertiesWithCoords.length <= 3) {
        // Pocas propiedades: zoom medio
        const currentZoom = mapInstanceRef.current.getZoom() || 12;
        if (currentZoom > 13) {
          mapInstanceRef.current.setZoom(13);
        }
      }
    }, 600);
  }, [filters.estado, filters.municipio, filteredProperties, mapReady]);

  // Geocodificar selección de estado/municipio cuando no hay propiedades coincidentes
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    if (!filters.estado && !filters.municipio) return;

    // Si ya hay propiedades para mostrar, no geocodificar
    if (filteredProperties.length > 0) return;

    const geocoder = new google.maps.Geocoder();
    const address = filters.municipio
      ? `${filters.municipio}, ${filters.estado}, México`
      : `${filters.estado}, México`;

    console.log('[Geocoder] Geocodificando:', address);

    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const geometry = results[0].geometry;
        const targetZoom = filters.municipio ? 12 : 7;
        
        if ((geometry as any).viewport) {
          // Usar viewport con transición suave
          mapInstanceRef.current?.fitBounds((geometry as any).viewport);
          setTimeout(() => {
            const currentZoom = mapInstanceRef.current?.getZoom() || 10;
            // Ajustar zoom solo si está fuera del rango deseado
            if (Math.abs(currentZoom - targetZoom) > 2) {
              mapInstanceRef.current?.setZoom(targetZoom);
            }
          }, 500);
        } else if (geometry.location) {
          // Transición suave al centro
          mapInstanceRef.current?.panTo(geometry.location);
          setTimeout(() => {
            mapInstanceRef.current?.setZoom(targetZoom);
          }, 400);
        }
        
        toast({
          title: '📍 Ubicación encontrada',
          description: `Mostrando ${filters.municipio || filters.estado}`,
        });
      } else {
        console.warn('[Geocoder] No se pudo geocodificar:', address, status);
        toast({
          title: '⚠️ Ubicación no encontrada',
          description: 'No se pudo centrar el mapa en esta ubicación',
          variant: 'destructive',
        });
      }
    });
  }, [filters.estado, filters.municipio, filteredProperties.length, mapReady, toast]);

  // Animación de bounce en marcador cuando se hace hover sobre la tarjeta
  // y scroll a tarjeta cuando se hace hover sobre el marcador (bidireccional)
  useEffect(() => {
    if (!hoveredPropertyId || !mapReady || !mapInstanceRef.current) return;

    const marker = markerMapRef.current.get(hoveredPropertyId);
    if (marker) {
      // Aplicar animación de bounce
      marker.setAnimation(google.maps.Animation.BOUNCE);
      
      // Centrar mapa suavemente en el marcador
      const position = marker.getPosition();
      if (position) {
        mapInstanceRef.current.panTo(position);
        
        // Zoom suave si está muy alejado
        const currentZoom = mapInstanceRef.current.getZoom() || 12;
        if (currentZoom < 14) {
          mapInstanceRef.current.setZoom(15);
        }
      }
      
      // Scroll suave a la tarjeta correspondiente (hover bidireccional)
      const element = document.getElementById(`property-${hoveredPropertyId}`);
      if (element) {
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest'
        });
      }
      
      // Detener la animación cuando se deje de hacer hover
      return () => {
        marker.setAnimation(null);
      };
    }
  }, [hoveredPropertyId, mapReady]);

  // Espera a que un elemento tenga ancho/alto > 0 antes de continuar
  const waitForNonZeroSize = async (el: HTMLElement, tries = 60, delayMs = 50) => {
    for (let i = 0; i < tries; i++) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return;
      await new Promise(r => setTimeout(r, delayMs));
    }
    // No cortar: aunque no crezca, seguimos para no colgarnos
  };

  // Inicializar mapa
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const initMap = async () => {
      try {
        setIsMapLoading(true);
        setMapLoadingProgress(10);
        
        await loadGoogleMaps();
        setMapLoadingProgress(40);
        
        if (!isMounted || !mapRef.current) return;

        // NUEVO: esperar a que el contenedor tenga tamaño real
        await waitForNonZeroSize(mapRef.current, 60, 50); // ~3s máx
        setMapLoadingProgress(60);

        // Crear mapa SOLO ahora que el contenedor tiene tamaño
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center: { lat: 19.4326, lng: -99.1332 },
          zoom: 12,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeId: mapType,
        });

        // Forzar reflow/resize del mapa por si el contenedor aún ajusta altura
        setTimeout(() => {
          if (!mapInstanceRef.current) return;
          // Forzar recalculo de tamaño y re-centrado
          ((google.maps as any).event)?.trigger(mapInstanceRef.current, 'resize');
          const center = mapInstanceRef.current.getCenter();
          if (center) mapInstanceRef.current.setCenter(center);
        }, 200);

        setMapLoadingProgress(85);

        let mapReadySet = false;
        
        const setMapReadyOnce = () => {
          if (!mapReadySet && isMounted) {
            mapReadySet = true;
            console.log('[Mapa] Listo para renderizar marcadores');
            setMapLoadingProgress(100);
            
            if (isMounted) {
              setMapReady(true);
              setIsMapLoading(false);
            }
            
            if (timeoutId) clearTimeout(timeoutId);
          }
        };

        // CONSOLIDAR en un solo listener idle con lógica dual
        mapInstanceRef.current.addListener('idle', () => {
          // Primero marcar como listo si no lo está
          if (!mapReadySet && isMounted) {
            setMapReadyOnce();
          }
          
          // Luego manejar viewport filter
          if (mapReadySet && isMounted && mapFilterActive) {
            const currentBounds = mapInstanceRef.current?.getBounds();
            if (currentBounds && debouncedFetchByViewportRef.current) {
              setViewportBounds(currentBounds);
              debouncedFetchByViewportRef.current(currentBounds);
            }
          }
        });

        // Listeners adicionales para casos edge
        mapInstanceRef.current.addListener('tilesloaded', setMapReadyOnce);
        mapInstanceRef.current.addListener('projection_changed', setMapReadyOnce);

        // Forzar reflow/resize del mapa por si el contenedor aún ajusta altura y marcar listo
        setTimeout(() => {
          if (!mapInstanceRef.current || !mapRef.current) return;
          ((google.maps as any).event)?.trigger(mapInstanceRef.current, 'resize');
          const center = mapInstanceRef.current.getCenter();
          if (center) mapInstanceRef.current.setCenter(center);

          // Inicializar ResizeObserver para futuros cambios de tamaño
          if (!resizeObserverRef.current) {
            resizeObserverRef.current = new ResizeObserver(() => {
              if (!mapInstanceRef.current) return;
              ((google.maps as any).event)?.trigger(mapInstanceRef.current, 'resize');
            });
            resizeObserverRef.current.observe(mapRef.current);
          }

          // Marcar listo si aún no lo está
          if (!mapReadySet) setMapReadyOnce();
        }, 200);

        // Timeout de seguridad más agresivo: 1.5s
        timeoutId = setTimeout(() => {
          if (isMounted && !mapReadySet) {
            console.log('[Mapa] Timeout - forzando estado listo');
            setMapReadyOnce();
          }
        }, 1500);

      } catch (err: any) {
        console.error('Error loading map:', err);
        if (isMounted) {
          setMapError(err.message || 'Error al cargar el mapa');
          setIsMapLoading(false);
          setMapLoadingProgress(0);
        }
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && mapInstanceRef.current) {
        // Forzar re-layout cuando el tab vuelve a ser visible
        (google.maps as any).event?.trigger(mapInstanceRef.current, 'resize');
        const c = mapInstanceRef.current.getCenter();
        if (c) mapInstanceRef.current.setCenter(c);
      }
    };

    initMap();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibility);
      // Limpiar observer
      if (resizeObserverRef.current && mapRef.current) {
        resizeObserverRef.current.unobserve(mapRef.current);
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, []);

  // Actualizar marcadores cuando cambian las propiedades filtradas
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady || renderingRef.current) {
      console.log('[Marcadores] Mapa no inicializado o no listo aún', { map: !!mapInstanceRef.current, mapReady, rendering: renderingRef.current });
      return;
    }

    console.time('[Marcadores] Render total');
    console.time('[Marcadores] Diffing');
    
    renderingRef.current = true;
    setIsLoadingMarkers(true);
    setMarkersLoadingProgress(0);
    console.log('[Marcadores] Actualizando marcadores. Propiedades filtradas:', filteredProperties.length);

    // Cerrar info window si existe
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }

    // Función para obtener color según rango de precio
    const getPriceColor = (price: number): string => {
      if (price < 1000000) return '#10B981';
      if (price < 3000000) return '#3B82F6';
      if (price < 5000000) return '#F59E0B';
      return '#EF4444';
    };

    // Crear nuevos marcadores con renderizado incremental y diffing
    const propertiesWithCoords = filteredProperties.filter(p => p.lat && p.lng);
    console.log('[Marcadores] Propiedades con coordenadas:', propertiesWithCoords.length);

    // Performance: obtener los IDs actuales y nuevos
    const currentIds = new Set(Array.from(markerMapRef.current.keys()));
    const newIds = new Set(propertiesWithCoords.map(p => p.id));
    
    // Calcular diferencias
    const idsToRemove = Array.from(currentIds).filter(id => !newIds.has(id));
    const idsToAdd = propertiesWithCoords.filter(p => !currentIds.has(p.id));
    
    console.log('[Marcadores] Diff - Agregar:', idsToAdd.length, 'Eliminar:', idsToRemove.length, 'Mantener:', currentIds.size - idsToRemove.length);
    console.timeEnd('[Marcadores] Diffing');
    console.time('[Marcadores] Limpieza');

    // Eliminar marcadores que ya no están
    idsToRemove.forEach(id => {
      const marker = markerMapRef.current.get(id);
      if (marker) {
        marker.setMap(null);
        markerMapRef.current.delete(id);
        const index = markersRef.current.indexOf(marker);
        if (index > -1) {
          markersRef.current.splice(index, 1);
        }
      }
    });
    
    console.timeEnd('[Marcadores] Limpieza');
    console.time('[Marcadores] Creación');

    // Limpiar clusterer solo si hay cambios
    if (markerClustererRef.current && (idsToRemove.length > 0 || idsToAdd.length > 0)) {
      markerClustererRef.current.clearMarkers();
      markerClustererRef.current = null;
    }

    // Determinar si mostrar labels (solo si hay menos de 300 propiedades)
    const showLabels = propertiesWithCoords.length < 300;
    console.log('[Marcadores] Labels:', showLabels ? 'activados' : 'desactivados', `(${propertiesWithCoords.length} propiedades)`);

    // Función para crear un marcador individual (optimizada con cache)
    const createMarker = (property: Property) => {
      const bucket = getPriceBucket(property.price);
      const priceColor = getPriceColor(property.price);
      
      // Usar icono cacheado
      const dataUri = getCachedIcon(property.type, bucket);
      
      const markerOptions: google.maps.MarkerOptions = {
        position: { lat: Number(property.lat), lng: Number(property.lng) },
        title: property.title,
        map: null,
        icon: {
          url: dataUri,
          scaledSize: new google.maps.Size(40, 40),
          anchor: new google.maps.Point(20, 40),
        },
        optimized: true,
      };

      // Solo agregar label si hay pocas propiedades
      if (showLabels) {
        markerOptions.label = {
          text: new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
            notation: 'compact',
            compactDisplay: 'short'
          }).format(property.price).replace('MXN', '').trim(),
          color: priceColor,
          fontSize: '11px',
          fontWeight: 'bold',
          className: 'marker-price-label'
        };
      }
      
      const marker = new google.maps.Marker(markerOptions);

      // Crear contenido del info window
      const createInfoWindowContent = (prop: Property) => {
        const imageUrl = prop.images && prop.images.length > 0 
          ? prop.images[0].url 
          : '/src/assets/property-placeholder.jpg';
        
        const features = [];
        if (prop.bedrooms) features.push(`${prop.bedrooms} rec`);
        if (prop.bathrooms) features.push(`${prop.bathrooms} baños`);
        if (prop.parking) features.push(`${prop.parking} est`);

        // Configuración del badge según tipo de operación
        const isVenta = prop.listing_type === 'venta';
        const badgeColor = isVenta ? '#10b981' : '#3b82f6'; // emerald-500 : blue-500
        const badgeBgColor = isVenta ? 'rgba(16, 185, 129, 0.9)' : 'rgba(59, 130, 246, 0.9)';
        const badgeIcon = isVenta ? '🏷️' : '📈';
        const badgeText = isVenta ? 'En Venta' : 'En Renta';

        return `
          <div style="min-width: 280px; max-width: 320px; font-family: system-ui, -apple-system, sans-serif;">
            <div style="position: relative;">
              <img 
                src="${imageUrl}" 
                alt="${prop.title}"
                style="width: 100%; height: 160px; object-fit: cover; border-radius: 8px 8px 0 0; margin: -16px -16px 12px -16px;"
              />
              <div style="
                position: absolute;
                top: -4px;
                left: -4px;
                background: ${badgeBgColor};
                color: white;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 600;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                backdrop-filter: blur(4px);
                border: 2px solid rgba(255,255,255,0.3);
                display: inline-flex;
                align-items: center;
                gap: 4px;
              ">
                <span>${badgeIcon}</span>
                <span>${badgeText}</span>
              </div>
            </div>
            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1a1a1a; line-height: 1.3;">
              ${prop.title}
            </h3>
            <p style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #0EA5E9;">
              ${formatPrice(prop.price)}
            </p>
            ${features.length > 0 ? `
              <div style="display: flex; gap: 12px; margin: 0 0 12px 0; font-size: 14px; color: #666;">
                ${features.join(' · ')}
              </div>
            ` : ''}
            <p style="margin: 0 0 12px 0; font-size: 13px; color: #666; display: flex; align-items: center; gap: 4px;">
              <span style="color: #0EA5E9;">📍</span>
              ${prop.municipality}, ${prop.state}
            </p>
            <a 
              href="/propiedad/${prop.id}"
              style="display: block; width: 100%; padding: 10px 16px; background: #0EA5E9; color: white; text-align: center; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; transition: background 0.2s;"
              onmouseover="this.style.background='#0284C7'"
              onmouseout="this.style.background='#0EA5E9'"
            >
              Ver detalles
            </a>
          </div>
        `;
      };

      marker.addListener('click', () => {
        setHighlightedId(property.id);
        
        // Animar el marcador con bounce
        marker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(() => marker.setAnimation(null), 2100);
        
        // Cerrar info window anterior si existe
        if (infoWindowRef.current) {
          infoWindowRef.current.close();
        }

        // Crear nuevo info window
        infoWindowRef.current = new google.maps.InfoWindow({
          content: createInfoWindowContent(property),
          maxWidth: 320,
        });

        infoWindowRef.current.open(mapInstanceRef.current, marker);

        // Scroll suave al item en la lista con highlight
        const element = document.getElementById(`property-${property.id}`);
        if (element) {
          element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center'
          });
          
          // Flash effect en la tarjeta
          setTimeout(() => {
            setHighlightedId(property.id);
            setTimeout(() => setHighlightedId(null), 3000);
          }, 500);
        }
      });

      // Event listeners para hover bidireccional (marcador → tarjeta)
      marker.addListener('mouseover', () => {
        debouncedSetHoveredProperty(property.id);
      });

      marker.addListener('mouseout', () => {
        debouncedSetHoveredProperty(null);
      });

      return marker;
    };

    // Crear solo los marcadores nuevos (incremental)
    const newMarkersToAdd: google.maps.Marker[] = [];
    
    idsToAdd.forEach(property => {
      const marker = createMarker(property);
      marker.setMap(mapInstanceRef.current);
      newMarkersToAdd.push(marker);
      markerMapRef.current.set(property.id, marker);
      markersRef.current.push(marker);
    });

    console.log('[Marcadores] Nuevos marcadores agregados:', newMarkersToAdd.length);
    console.log('[Marcadores] Total de marcadores activos:', markersRef.current.length);
    console.timeEnd('[Marcadores] Creación');
    console.timeEnd('[Marcadores] Render total');
    console.log(`[Cache] ${iconCacheHits} hits, ${iconCacheMisses} misses, ratio: ${iconCacheHits > 0 ? (iconCacheHits / (iconCacheHits + iconCacheMisses) * 100).toFixed(1) : 0}%`);
    
    setIsLoadingMarkers(false);
    setMarkersLoadingProgress(100);

    // Actualizar clusterer de forma eficiente
    const allMarkers = Array.from(markerMapRef.current.values());
    
    if (markerClustererRef.current) {
      // Si hay cambios significativos (>30%), recrear clusterer
      const changePercentage = (idsToAdd.length + idsToRemove.length) / Math.max(currentIds.size, 1);
      
      if (changePercentage > 0.3) {
        console.log('[Clusterer] Cambio significativo detectado, recreando clusterer');
        markerClustererRef.current.clearMarkers();
        markerClustererRef.current = new MarkerClusterer({
          map: mapInstanceRef.current,
          markers: allMarkers,
          algorithmOptions: {
            maxZoom: 15,
          },
        });
      } else {
        // Cambios menores: actualizar incrementalmente
        console.log('[Clusterer] Actualizando marcadores incrementalmente');
        if (idsToRemove.length > 0) {
          markerClustererRef.current.clearMarkers();
          markerClustererRef.current.addMarkers(allMarkers);
        } else if (newMarkersToAdd.length > 0) {
          markerClustererRef.current.addMarkers(newMarkersToAdd);
        }
      }
    } else if (allMarkers.length > 0) {
      // Crear clusterer inicial
      markerClustererRef.current = new MarkerClusterer({
        map: mapInstanceRef.current,
        markers: allMarkers,
        algorithmOptions: {
          maxZoom: 15,
        },
      });
    }

    // Solo ajustar bounds si hay cambios significativos
    if (idsToAdd.length > 0 || (idsToRemove.length > 0 && allMarkers.length > 0)) {
      const bounds = new google.maps.LatLngBounds();
      allMarkers.forEach(marker => {
        const position = marker.getPosition();
        if (position) bounds.extend(position);
      });
      
      if (mapInstanceRef.current && !bounds.isEmpty()) {
        mapInstanceRef.current.fitBounds(bounds);
      }
    }

    // Actualizar contador de propiedades visibles
    setVisiblePropertiesCount(propertiesWithCoords.length);
    
    // Liberar flag de renderizado
    renderingRef.current = false;
  }, [filteredProperties, mapReady]);

  // Efecto para animar marcador cuando se hace hover sobre una tarjeta
  useEffect(() => {
    if (!hoveredPropertyId || !mapInstanceRef.current) return;

    const marker = markerMapRef.current.get(hoveredPropertyId);
    if (!marker) return;

    // Animar el marcador con bounce
    marker.setAnimation(google.maps.Animation.BOUNCE);
    
    // Detener la animación después de 1.5 segundos
    const timer = setTimeout(() => {
      marker.setAnimation(null);
    }, 1500);

    return () => {
      clearTimeout(timer);
      marker.setAnimation(null);
    };
  }, [hoveredPropertyId]);

  // Actualizar tipo de mapa cuando cambia el estado
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setMapTypeId(mapType);
    }
  }, [mapType]);

  // Función para centrar mapa en resultados
  const centerOnResults = () => {
    if (!mapInstanceRef.current || !markersRef.current.length) return;

    const bounds = new google.maps.LatLngBounds();
    markersRef.current.forEach(marker => {
      const position = marker.getPosition();
      if (position) bounds.extend(position);
    });
    
    mapInstanceRef.current.fitBounds(bounds);
    
    toast({
      title: 'Mapa centrado',
      description: `Mostrando ${visiblePropertiesCount} propiedades`,
    });
  };

  // Función para obtener ubicación actual
  const centerOnMyLocation = () => {
    if (!mapInstanceRef.current) return;

    if (navigator.geolocation) {
      toast({
        title: 'Obteniendo ubicación...',
        description: 'Buscando tu ubicación actual',
      });

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          // Movimiento suave al centro
          mapInstanceRef.current?.panTo(pos);
          setTimeout(() => {
            mapInstanceRef.current?.setZoom(14);
          }, 500);

          // Añadir marcador temporal con animación
          const myLocationMarker = new google.maps.Marker({
            position: pos,
            map: mapInstanceRef.current,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#4285F4',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2,
            },
            title: 'Tu ubicación',
            animation: google.maps.Animation.DROP,
          });

          toast({
            title: 'Ubicación encontrada',
            description: 'Mapa centrado en tu ubicación',
          });
        },
        () => {
          toast({
            title: 'Error',
            description: 'No se pudo obtener tu ubicación',
            variant: 'destructive',
          });
        }
      );
    } else {
      toast({
        title: 'No disponible',
        description: 'Tu navegador no soporta geolocalización',
        variant: 'destructive',
      });
    }
  };

  // Hook de autocompletado de lugares
  const handlePlaceSelect = useCallback((location: {
    address: string;
    municipality: string;
    state: string;
    lat?: number;
    lng?: number;
  }) => {
    if (location.lat && location.lng && mapInstanceRef.current) {
      // Movimiento suave con panTo
      mapInstanceRef.current.panTo({ lat: Number(location.lat), lng: Number(location.lng) });
      setTimeout(() => {
        mapInstanceRef.current?.setZoom(14);
      }, 500);
    }
  }, []);


  // Filtrar propiedades por área visible del mapa
  const filterPropertiesByViewport = useCallback(() => {
    if (!mapInstanceRef.current) return;
    
    const bounds = mapInstanceRef.current.getBounds();
    if (!bounds) return;

    const propertiesInBounds = filteredProperties.filter(property => {
      if (!property.lat || !property.lng) return false;
      
      const position = new google.maps.LatLng(
        Number(property.lat),
        Number(property.lng)
      );
      
      return bounds.contains(position);
    });

    setPropertiesInViewport(propertiesInBounds);
  }, [filteredProperties]);

  // Versión throttled del filtro de viewport
  const throttledViewportFilter = useCallback(
    throttle(filterPropertiesByViewport, 500),
    [filterPropertiesByViewport]
  );

  // Ejecutar filtro cuando se activa/desactiva
  useEffect(() => {
    if (mapFilterActive) {
      filterPropertiesByViewport();
      toast({
        title: 'Filtro de mapa activado',
        description: 'Mostrando propiedades del área visible',
      });
    } else {
      setPropertiesInViewport([]);
    }
  }, [mapFilterActive, filterPropertiesByViewport, toast]);

  const handlePropertyClick = (property: Property) => {
    setHighlightedId(property.id);
    if (property.lat && property.lng && mapInstanceRef.current) {
      // Movimiento suave con panTo
      mapInstanceRef.current.panTo({ lat: Number(property.lat), lng: Number(property.lng) });
      setTimeout(() => {
        mapInstanceRef.current?.setZoom(16);
      }, 500);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getPropertyIcon = (type: string) => {
    switch (type) {
      case 'casa': return <HomeIcon className="h-4 w-4" />;
      case 'departamento': return <HomeIcon className="h-4 w-4" />;
      default: return <HomeIcon className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <p className="text-muted-foreground">Cargando propiedades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-6">
        {/* Buscador de lugares */}
        <div className="mb-6">
          <div className="max-w-2xl mx-auto">
            <PlaceAutocomplete
              onPlaceSelect={handlePlaceSelect}
              placeholder="Buscar por ciudad, colonia o dirección"
              label=""
              id="buscar-place-autocomplete"
            />
          </div>
        </div>

        {/* Layout de dos columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel izquierdo: Filtros + Lista */}
          <div className="space-y-6">
            {/* Filtros */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Filtros
                  </h2>
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="ml-2 animate-scale-in">
                      {activeFiltersCount} {activeFiltersCount === 1 ? 'activo' : 'activos'}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Filtro de Venta/Renta - DESTACADO */}
                  <div className="col-span-2 space-y-2">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <HomeIcon className="h-4 w-4 text-primary" />
                      Tipo de operación
                    </Label>
                    <Select value={filters.listingType || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, listingType: v === "all" ? "" : v }))}>
                      <SelectTrigger className="h-11 border-2">
                        <SelectValue placeholder="Todas las opciones" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las opciones</SelectItem>
                        <SelectItem value="venta">En venta</SelectItem>
                        <SelectItem value="renta">En renta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Combobox
                      options={[
                        { value: "", label: "Todos los estados" },
                        ...estados.map(estado => ({ value: estado, label: estado }))
                      ]}
                      value={filters.estado}
                      onValueChange={(v) => setFilters(prev => ({ ...prev, estado: v }))}
                      placeholder="Seleccionar estado"
                      searchPlaceholder="Buscar estado..."
                      emptyText="No se encontró el estado"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Municipio</Label>
                    <Combobox
                      options={[
                        { value: "", label: filters.estado ? "Todos los municipios" : "Selecciona un estado primero" },
                        ...municipios.map(municipio => ({ value: municipio, label: municipio }))
                      ]}
                      value={filters.municipio}
                      onValueChange={(v) => setFilters(prev => ({ ...prev, municipio: v }))}
                      placeholder={filters.estado ? "Seleccionar municipio" : "Selecciona un estado primero"}
                      searchPlaceholder="Buscar municipio..."
                      emptyText="No se encontró el municipio"
                      className={!filters.estado ? "opacity-50 cursor-not-allowed" : ""}
                    />
                  </div>

                  {/* Filtro de rango de precios con slider dual */}
                  <div className="col-span-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Rango de precio</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPriceRange([MIN_PRICE, MAX_PRICE]);
                          setFilters(prev => ({ ...prev, precioMin: '', precioMax: '' }));
                        }}
                        className="h-6 px-2 text-xs hover:text-primary transition-colors"
                      >
                        Restablecer
                      </Button>
                    </div>
                    
                    <div className="pt-2 pb-1">
                      <Slider
                        min={MIN_PRICE}
                        max={MAX_PRICE}
                        step={0.5}
                        value={priceRange}
                        onValueChange={handlePriceRangeChange}
                        className="cursor-pointer"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between gap-4 pt-1">
                      <div className="flex-1 px-3 py-2 bg-muted/50 rounded-md border border-border transition-all hover:border-primary/50">
                        <div className="text-xs text-muted-foreground mb-0.5">Mínimo</div>
                        <div className="text-sm font-semibold text-foreground">
                          {formatPriceDisplay(priceRange[0])}
                        </div>
                      </div>
                      
                      <div className="text-muted-foreground">—</div>
                      
                      <div className="flex-1 px-3 py-2 bg-muted/50 rounded-md border border-border transition-all hover:border-primary/50">
                        <div className="text-xs text-muted-foreground mb-0.5">Máximo</div>
                        <div className="text-sm font-semibold text-foreground">
                          {formatPriceDisplay(priceRange[1])}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de propiedad</Label>
                    <Select value={filters.tipo || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, tipo: v === "all" ? "" : v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
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

                  <div className="space-y-2">
                    <Label>Recámaras mínimas</Label>
                    <Select value={filters.recamaras || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, recamaras: v === "all" ? "" : v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="1">1+</SelectItem>
                        <SelectItem value="2">2+</SelectItem>
                        <SelectItem value="3">3+</SelectItem>
                        <SelectItem value="4">4+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Baños mínimos</Label>
                    <Select value={filters.banos || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, banos: v === "all" ? "" : v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="1">1+</SelectItem>
                        <SelectItem value="2">2+</SelectItem>
                        <SelectItem value="3">3+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Ordenar por precio</Label>
                    <Select value={filters.orden} onValueChange={(v) => setFilters(prev => ({ ...prev, orden: v as 'asc' | 'desc' }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desc">Mayor a menor</SelectItem>
                        <SelectItem value="asc">Menor a mayor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Chips de filtros activos */}
                {activeFiltersCount > 0 && (
                  <div className="flex flex-wrap gap-2 animate-fade-in">
                    {getActiveFilterChips().map((chip) => (
                      <Badge
                        key={chip.key}
                        variant="secondary"
                        className="pl-3 pr-2 py-1.5 flex items-center gap-2 animate-scale-in hover:bg-secondary/80 transition-colors"
                      >
                        <span className="text-sm">{chip.label}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0 hover:bg-transparent"
                          onClick={(e) => {
                            e.preventDefault();
                            chip.removeFilter();
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}

                {activeFiltersCount > 0 && (
                  <Button
                    variant="outline" 
                    className="w-full animate-fade-in"
                    onClick={() => setFilters({
                      estado: '', municipio: '', precioMin: '', precioMax: '',
                      tipo: '', listingType: '', recamaras: '', banos: '', orden: 'desc'
                    })}
                  >
                    Limpiar {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro' : 'filtros'}
                  </Button>
                )}

                {/* Botón guardar búsqueda */}
                {user && activeFiltersCount > 0 && (
                  <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="default" className="w-full animate-fade-in">
                        <Save className="mr-2 h-4 w-4" />
                        Guardar búsqueda
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Guardar búsqueda</DialogTitle>
                        <DialogDescription>
                          Dale un nombre a esta búsqueda para encontrarla fácilmente después.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="search-name">Nombre de la búsqueda</Label>
                          <Input
                            id="search-name"
                            placeholder="Ej: Casas en Guadalajara"
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveSearch()}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleSaveSearch}>
                          Guardar
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </CardContent>
            </Card>

            {/* Búsquedas guardadas */}
            {user && savedSearches.length > 0 && (
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Star className="h-5 w-5" />
                      Búsquedas guardadas
                    </h2>
                    <Badge variant="secondary">
                      {filteredSavedSearches.length}
                    </Badge>
                  </div>

                  {/* Búsqueda y ordenamiento */}
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar búsquedas guardadas..."
                        value={savedSearchQuery}
                        onChange={(e) => setSavedSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground">Ordenar por:</Label>
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
                  </div>

                  {/* Lista de búsquedas */}
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
                          className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors animate-fade-in"
                        >
                          <button
                            onClick={() => handleLoadSearch(search.filters)}
                            className="flex-1 text-left"
                          >
                            <p className="font-medium">{search.name}</p>
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
            )}

            {/* Lista de propiedades */}
            <div className="space-y-4">
              {/* Contador animado */}
              <AnimatedCounter 
                value={propertiesToDisplay.length} 
                label={propertiesToDisplay.length === 1 ? 'propiedad' : 'propiedades'}
              />

              {/* Estadísticas de precios */}
              <PropertyStats properties={propertiesToDisplay} />

              {propertiesToDisplay.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No encontramos propiedades con estos filtros.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
                  {propertiesToDisplay.map((property, index) => (
                    <Link
                      key={property.id}
                      to={`/propiedad/${property.id}`}
                      id={`property-${property.id}`}
                    >
                      <Card
                        className={`cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] animate-fade-in ${
                          highlightedId === property.id ? 'ring-2 ring-primary shadow-xl scale-[1.01]' : ''
                        } ${
                          hoveredPropertyId === property.id ? 'ring-2 ring-primary/70 shadow-lg scale-[1.01] bg-accent/30' : ''
                        }`}
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => handlePropertyClick(property)}
                        onMouseEnter={() => debouncedSetHoveredProperty(property.id)}
                        onMouseLeave={() => debouncedSetHoveredProperty(null)}
                      >
                        <CardContent className="p-4">
                          {/* Galería de imágenes con badge superpuesto */}
                          <div className="mb-4 relative">
                            <PropertyImageGallery
                              images={property.images || []}
                              title={property.title}
                              type={property.type}
                            />
                            {/* Badge de Venta/Renta sobre la imagen */}
                            <div className="absolute top-3 left-3 z-10">
                              <Badge 
                                variant={property.listing_type === 'venta' ? 'default' : 'secondary'}
                                className={`
                                  font-semibold text-sm px-3 py-1.5 shadow-lg backdrop-blur-sm
                                  ${property.listing_type === 'venta' 
                                    ? 'bg-emerald-500/90 hover:bg-emerald-600/90 text-white border-emerald-400' 
                                    : 'bg-blue-500/90 hover:bg-blue-600/90 text-white border-blue-400'
                                  }
                                  transition-all hover:scale-105 animate-fade-in
                                `}
                              >
                                {property.listing_type === 'venta' ? (
                                  <>
                                    <Tag className="h-3.5 w-3.5 mr-1" />
                                    En Venta
                                  </>
                                ) : (
                                  <>
                                    <TrendingUp className="h-3.5 w-3.5 mr-1" />
                                    En Renta
                                  </>
                                )}
                              </Badge>
                            </div>
                          </div>

                          {/* Información de la propiedad */}
                          <div className="space-y-3">
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h3 className="font-semibold text-lg hover:text-primary transition-colors line-clamp-1 flex-1">
                                  {property.title}
                                </h3>
                                {/* Badge pequeño adicional en el título */}
                                <Badge 
                                  variant="outline"
                                  className={`
                                    text-xs px-2 py-0.5 flex-shrink-0
                                    ${property.listing_type === 'venta' 
                                      ? 'border-emerald-500 text-emerald-600 bg-emerald-50' 
                                      : 'border-blue-500 text-blue-600 bg-blue-50'
                                    }
                                  `}
                                >
                                  {property.listing_type === 'venta' ? 'Venta' : 'Renta'}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <MapPin className="h-3 w-3 flex-shrink-0" />
                                <span className="line-clamp-1">
                                  {property.municipality}, {property.state}
                                </span>
                              </p>
                            </div>

                            <p className="text-2xl font-bold text-primary">
                              {formatPrice(property.price)}
                            </p>

                            <div className="flex gap-4 text-sm text-muted-foreground">
                              {property.bedrooms && (
                                <span className="flex items-center gap-1">
                                  <Bed className="h-4 w-4" />
                                  {property.bedrooms}
                                </span>
                              )}
                              {property.bathrooms && (
                                <span className="flex items-center gap-1">
                                  <Bath className="h-4 w-4" />
                                  {property.bathrooms}
                                </span>
                              )}
                              {property.parking && (
                                <span className="flex items-center gap-1">
                                  <Car className="h-4 w-4" />
                                  {property.parking}
                                </span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Panel derecho: Mapa */}
          <div className="lg:sticky lg:top-20 h-[600px] lg:h-[calc(100vh-8rem)]">
            {mapError ? (
              <Card className="h-full">
                <CardContent className="h-full flex items-center justify-center p-6">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{mapError}</AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full overflow-hidden relative">
                <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: '400px' }} />
                
                {/* Indicador de carga con progreso */}
                {isMapLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/95 backdrop-blur-sm z-10">
                    <div className="text-center space-y-4 w-full max-w-xs px-6">
                      <div className="relative">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">
                            {Math.round(mapLoadingProgress)}%
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Cargando mapa interactivo</p>
                        
                        {/* Barra de progreso */}
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${mapLoadingProgress}%` }}
                          />
                        </div>
                        
                        <p className="text-xs text-muted-foreground">
                          {mapLoadingProgress < 30 && 'Inicializando Google Maps...'}
                          {mapLoadingProgress >= 30 && mapLoadingProgress < 70 && 'Preparando interfaz...'}
                          {mapLoadingProgress >= 70 && mapLoadingProgress < 100 && 'Cargando tiles del mapa...'}
                          {mapLoadingProgress === 100 && 'Completado'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Indicador de progreso de marcadores */}
                {isLoadingMarkers && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 animate-fade-in">
                    <div className="bg-background border-2 border-border rounded-lg shadow-lg px-6 py-3">
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Cargando marcadores</p>
                          <div className="flex items-center gap-2">
                            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary transition-all duration-300"
                                style={{ width: `${markersLoadingProgress}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-primary">{markersLoadingProgress}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Controles personalizados del mapa */}
                 {!isMapLoading && mapReady && (
                  <div className="absolute top-4 right-4 z-10 space-y-2">
                    {/* Contador de propiedades */}
                    <div className="bg-background border-2 border-border rounded-lg shadow-lg px-4 py-2 animate-fade-in transition-all hover:shadow-xl hover:scale-105">
                      <div className="flex items-center gap-2">
                        <HomeIcon className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">
                          {visiblePropertiesCount} {visiblePropertiesCount === 1 ? 'propiedad' : 'propiedades'}
                        </span>
                      </div>
                    </div>

                    {/* Grupo de botones de control */}
                    <div className="bg-background border-2 border-border rounded-lg shadow-lg overflow-hidden animate-fade-in">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMapType(prev => prev === 'roadmap' ? 'satellite' : 'roadmap')}
                        className="h-8 w-8 p-0 rounded-none border-b border-border hover:bg-accent"
                        title={mapType === 'roadmap' ? 'Vista satélite' : 'Vista mapa'}
                      >
                        {mapType === 'roadmap' ? (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>
                          </svg>
                        )}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={centerOnMyLocation}
                        className="h-8 w-8 p-0 rounded-none hover:bg-accent"
                        title="Mi ubicación"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="3"/>
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="12" y1="2" x2="12" y2="4"/>
                          <line x1="12" y1="20" x2="12" y2="22"/>
                          <line x1="2" y1="12" x2="4" y2="12"/>
                          <line x1="20" y1="12" x2="22" y2="12"/>
                        </svg>
                      </Button>
                    </div>

                    {/* Botón de filtro por viewport */}
                    <Button
                      variant={mapFilterActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMapFilterActive(!mapFilterActive)}
                      className="h-8 w-8 p-0 shadow-lg"
                      title={mapFilterActive ? "Desactivar filtro de mapa" : "Filtrar por área visible"}
                    >
                      <svg 
                        className={`h-4 w-4 ${mapFilterActive ? 'scale-110' : ''}`}
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
                      </svg>
                    </Button>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Buscar;
