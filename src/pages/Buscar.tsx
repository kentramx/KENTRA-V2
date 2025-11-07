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
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { MapPin, Bed, Bath, Car, Home as HomeIcon, Search, AlertCircle, Save, Star, Trash2, X, Loader2, Tag, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

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

  const [estados, setEstados] = useState<string[]>([]);
  const [municipios, setMunicipios] = useState<string[]>([]);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const markerClustererRef = useRef<MarkerClusterer | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const markerMapRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const renderingRef = useRef<boolean>(false);
  const boundsListenerRef = useRef<google.maps.MapsEventListener | null>(null);

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

  // Cargar propiedades desde Supabase
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const { data, error } = await supabase
          .from('properties')
          .select(`
            id, 
            title, 
            price, 
            bedrooms, 
            bathrooms, 
            parking, 
            lat, 
            lng, 
            address, 
            state, 
            municipality, 
            type,
            listing_type,
            images (
              url,
              position
            )
          `)
          .eq('status', 'activa')
          .order('position', { foreignTable: 'images', ascending: true });

        if (error) throw error;

        // Ordenar imágenes por posición y convertir tipos antiguos
        const propertiesWithSortedImages = data?.map(property => ({
          ...property,
          type: property.type === 'local_comercial' ? 'local' : property.type,
          images: (property.images || []).sort((a: any, b: any) => a.position - b.position)
        })) as Property[] || [];

        setProperties(propertiesWithSortedImages);
        setFilteredProperties(propertiesWithSortedImages);

        // Extraer estados únicos
        const uniqueEstados = [...new Set(data?.map(p => p.state) || [])].filter(Boolean);
        setEstados(uniqueEstados.sort());
      } catch (error) {
        console.error('Error fetching properties:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []);

  // Actualizar municipios cuando cambia el estado
  useEffect(() => {
    if (filters.estado) {
      const municipiosDelEstado = [...new Set(
        properties
          .filter(p => p.state === filters.estado)
          .map(p => p.municipality)
      )].filter(Boolean).sort();
      setMunicipios(municipiosDelEstado);
    } else {
      setMunicipios([]);
      setFilters(prev => ({ ...prev, municipio: '' }));
    }
  }, [filters.estado, properties]);

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

  // Inicializar mapa
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    let progressInterval: NodeJS.Timeout;
    
    const initMap = async () => {
      try {
        setIsMapLoading(true);
        setMapLoadingProgress(0);
        
        // Simular progreso de carga inicial (0-30%)
        progressInterval = setInterval(() => {
          setMapLoadingProgress(prev => {
            if (prev < 30) return prev + 5;
            return prev;
          });
        }, 100);
        
        await loadGoogleMaps();
        
        // Progreso después de cargar API (30-50%)
        setMapLoadingProgress(50);
        
        if (!isMounted || !mapRef.current) return;

        // Pequeño delay para asegurar que el DOM está listo
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!mapRef.current) return;

        // Progreso después de verificar DOM (50-70%)
        setMapLoadingProgress(70);

        // Crear mapa centrado en CDMX
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center: { lat: 19.4326, lng: -99.1332 },
          zoom: 12,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeId: mapType,
        });

        // Progreso después de crear instancia (70-85%)
        setMapLoadingProgress(85);

        let mapReadySet = false;
        
        const setMapReadyOnce = () => {
          if (!mapReadySet && isMounted) {
            mapReadySet = true;
            console.log('[Mapa] Listo para renderizar marcadores');
            setMapLoadingProgress(100);
            
            // Esperar un momento antes de ocultar el loader
            setTimeout(() => {
              if (isMounted) {
                setMapReady(true);
                setIsMapLoading(false);
              }
            }, 300);
            
            if (timeoutId) clearTimeout(timeoutId);
            if (progressInterval) clearInterval(progressInterval);
          }
        };

        // Múltiples listeners para asegurar que el mapa se marca como listo
        mapInstanceRef.current.addListener('tilesloaded', setMapReadyOnce);
        mapInstanceRef.current.addListener('idle', setMapReadyOnce);
        
        // Listener para viewport changes
        mapInstanceRef.current.addListener('idle', () => {
          if (!isMounted || !mapReadySet) return;
          
          // Activar filtro de viewport cuando el mapa se detiene
          if (mapFilterActive) {
            throttledViewportFilter();
          }
        });

        // Timeout de seguridad: marcar como listo después de 3 segundos
        timeoutId = setTimeout(() => {
          if (isMounted && !mapReadySet) {
            console.log('[Mapa] Timeout alcanzado - forzando estado listo');
            setMapReadyOnce();
          }
        }, 3000);

      } catch (err: any) {
        console.error('Error loading map:', err);
        if (isMounted) {
          setMapError(err.message || 'Error al cargar el mapa');
          setIsMapLoading(false);
          setMapLoadingProgress(0);
        }
        if (progressInterval) clearInterval(progressInterval);
      }
    };

    initMap();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [mapType, mapFilterActive]);

  // Actualizar marcadores cuando cambian las propiedades filtradas
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady || renderingRef.current) {
      console.log('[Marcadores] Mapa no inicializado o no listo aún', { map: !!mapInstanceRef.current, mapReady, rendering: renderingRef.current });
      return;
    }

    renderingRef.current = true;
    setIsLoadingMarkers(true);
    setMarkersLoadingProgress(0);
    console.log('[Marcadores] Actualizando marcadores. Propiedades filtradas:', filteredProperties.length);

    // Limpiar marcadores anteriores
    if (markerClustererRef.current) {
      markerClustererRef.current.clearMarkers();
      markerClustererRef.current = null;
    }
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    markerMapRef.current.clear();

    // Cerrar info window si existe
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }

    // Función para obtener color según rango de precio
    const getPriceColor = (price: number): string => {
      if (price < 1000000) return '#10B981'; // Verde - económico
      if (price < 3000000) return '#3B82F6'; // Azul - medio
      if (price < 5000000) return '#F59E0B'; // Naranja - alto
      return '#EF4444'; // Rojo - premium
    };

    // Función para crear SVG del icono según tipo de propiedad
    const getPropertyIcon = (type: string, color: string): string => {
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
      
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="11" fill="${color}" opacity="0.9"/>
          <g transform="scale(0.7) translate(4.2, 4.2)">
            ${iconPath}
          </g>
        </svg>
      `;
    };

    // Función para crear etiqueta de precio
    const createPriceLabel = (price: number, color: string): string => {
      const formattedPrice = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(price);
      
      return `
        <div style="
          background: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 11px;
          color: ${color};
          border: 2px solid ${color};
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          white-space: nowrap;
          position: relative;
          margin-top: -8px;
        ">
          ${formattedPrice}
        </div>
      `;
    };

    // Crear nuevos marcadores con renderizado incremental
    const propertiesWithCoords = filteredProperties.filter(p => p.lat && p.lng);
    console.log('[Marcadores] Propiedades con coordenadas:', propertiesWithCoords.length);

    // Función para crear un marcador individual
    const createMarker = (property: Property) => {
      const priceColor = getPriceColor(property.price);
      const iconSvg = getPropertyIcon(property.type, priceColor);
      
      // Convertir SVG a data URL
      const svgBlob = new Blob([iconSvg], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(svgBlob);
      
      const marker = new google.maps.Marker({
        position: { lat: Number(property.lat), lng: Number(property.lng) },
        title: property.title,
        map: null, // No añadir al mapa inmediatamente
        icon: {
          url: svgUrl,
          scaledSize: new google.maps.Size(40, 40),
          anchor: new google.maps.Point(20, 40),
        },
        label: {
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
        },
        optimized: false,
      });

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

    // Renderizado incremental por lotes
    const BATCH_SIZE = 15; // Procesar 15 marcadores por lote
    let currentBatch = 0;
    const newMarkers: google.maps.Marker[] = [];
    
    const renderBatch = () => {
      const start = currentBatch * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, propertiesWithCoords.length);
      
      // Crear marcadores del lote actual
      for (let i = start; i < end; i++) {
        const property = propertiesWithCoords[i];
        const marker = createMarker(property);
        marker.setMap(mapInstanceRef.current);
        marker.setOpacity(0); // Iniciar invisible
        newMarkers.push(marker);
        markerMapRef.current.set(property.id, marker);
      }
      
      // Actualizar progreso
      const progress = Math.round((end / propertiesWithCoords.length) * 100);
      setMarkersLoadingProgress(progress);
      
      console.log(`[Marcadores] Renderizado lote ${currentBatch + 1}: ${start}-${end} de ${propertiesWithCoords.length}`);
      
      currentBatch++;
      
      // Si hay más marcadores por renderizar, continuar en el siguiente frame
      if (end < propertiesWithCoords.length) {
        requestAnimationFrame(renderBatch);
      } else {
        // Finalización del renderizado
        markersRef.current = newMarkers;
        console.log('[Marcadores] Todos los marcadores creados:', newMarkers.length);

        // Animación de entrada suave y escalonada para todos los marcadores
        newMarkers.forEach((marker, index) => {
          const delay = index * 20; // 20ms entre cada marcador
          setTimeout(() => {
            if (marker.getMap()) {
              let opacity = 0;
              const fadeIn = setInterval(() => {
                opacity += 0.15;
                marker.setOpacity(Math.min(opacity, 1));
                if (opacity >= 1) {
                  clearInterval(fadeIn);
                  marker.setOpacity(1);
                }
              }, 25);
            }
          }, delay);
        });

        setIsLoadingMarkers(false);
        setMarkersLoadingProgress(100);

        // Agregar clustering con renderizado personalizado y animaciones
        if (newMarkers.length > 0) {
          // Función para obtener color y tamaño según densidad de cluster
          const getClusterStyle = (count: number): { color: string; size: number; label: string } => {
            if (count < 5) return { color: '#10B981', size: 50, label: 'Baja densidad' };
            if (count < 10) return { color: '#3B82F6', size: 55, label: 'Media densidad' };
            if (count < 20) return { color: '#F59E0B', size: 60, label: 'Alta densidad' };
            if (count < 50) return { color: '#EF4444', size: 65, label: 'Muy alta densidad' };
            return { color: '#DC2626', size: 70, label: 'Densidad extrema' };
          };

          // Crear renderer personalizado para clusters con diseño mejorado
          const renderer = {
            render: (cluster: any) => {
              const count = cluster.count;
              const position = cluster.position;
              const style = getClusterStyle(count);
              
              // Crear SVG del cluster con estilo moderno y animaciones
              const svg = `
                <svg xmlns="http://www.w3.org/2000/svg" width="${style.size + 20}" height="${style.size + 20}" viewBox="0 0 ${style.size + 20} ${style.size + 20}">
                  <defs>
                    <filter id="shadow-${count}" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
                      <feOffset dx="0" dy="3" result="offsetblur"/>
                      <feComponentTransfer>
                        <feFuncA type="linear" slope="0.4"/>
                      </feComponentTransfer>
                      <feMerge>
                        <feMergeNode/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                    <radialGradient id="grad-${count}">
                      <stop offset="0%" style="stop-color:${style.color};stop-opacity:1" />
                      <stop offset="70%" style="stop-color:${style.color};stop-opacity:0.95" />
                      <stop offset="100%" style="stop-color:${style.color};stop-opacity:0.85" />
                    </radialGradient>
                    <radialGradient id="pulse-${count}">
                      <stop offset="0%" style="stop-color:${style.color};stop-opacity:0" />
                      <stop offset="100%" style="stop-color:${style.color};stop-opacity:0.3" />
                    </radialGradient>
                  </defs>
                  
                  <!-- Anillo pulsante exterior -->
                  <circle cx="${(style.size + 20) / 2}" cy="${(style.size + 20) / 2}" r="${style.size / 2 + 8}" 
                          fill="url(#pulse-${count})" opacity="0.6">
                    <animate attributeName="r" 
                             from="${style.size / 2 + 5}" 
                             to="${style.size / 2 + 12}" 
                             dur="2s" 
                             repeatCount="indefinite"/>
                    <animate attributeName="opacity" 
                             from="0.6" 
                             to="0" 
                             dur="2s" 
                             repeatCount="indefinite"/>
                  </circle>
                  
                  <!-- Círculo principal con gradiente -->
                  <circle cx="${(style.size + 20) / 2}" cy="${(style.size + 20) / 2}" r="${style.size / 2 - 2}" 
                          fill="url(#grad-${count})" 
                          filter="url(#shadow-${count})" 
                          stroke="white" 
                          stroke-width="4"
                          opacity="0.95"/>
                  
                  <!-- Círculo interior decorativo -->
                  <circle cx="${(style.size + 20) / 2}" cy="${(style.size + 20) / 2}" r="${style.size / 2 - 8}" 
                          fill="none" 
                          stroke="white" 
                          stroke-width="2"
                          opacity="0.3"/>
                  
                  <!-- Texto del número -->
                  <text x="${(style.size + 20) / 2}" y="${(style.size + 20) / 2}" 
                        text-anchor="middle" 
                        dominant-baseline="central" 
                        font-family="system-ui, -apple-system, sans-serif" 
                        font-size="${count > 99 ? '16' : '20'}" 
                        font-weight="800" 
                        fill="white"
                        letter-spacing="0.5">
                    ${count}
                  </text>
                  
                  <!-- Icono de propiedades debajo del número -->
                  <text x="${(style.size + 20) / 2}" y="${(style.size + 20) / 2 + 14}" 
                        text-anchor="middle" 
                        font-size="8" 
                        fill="white"
                        opacity="0.8"
                        font-weight="600">
                    PROPS
                  </text>
                </svg>
              `;
              
              // Convertir SVG a data URL
              const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
              const svgUrl = URL.createObjectURL(svgBlob);
              
              const clusterMarker = new google.maps.Marker({
                position,
                icon: {
                  url: svgUrl,
                  scaledSize: new google.maps.Size(style.size + 20, style.size + 20),
                  anchor: new google.maps.Point((style.size + 20) / 2, (style.size + 20) / 2),
                },
                zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
                title: `${count} propiedades en esta zona`,
              });

              // Animación inicial de aparición
              clusterMarker.setOpacity(0);
              setTimeout(() => {
                let opacity = 0;
                const fadeIn = setInterval(() => {
                  opacity += 0.2;
                  clusterMarker.setOpacity(Math.min(opacity, 1));
                  if (opacity >= 1) {
                    clearInterval(fadeIn);
                  }
                }, 30);
              }, 100);

              // Hover effect en cluster
              clusterMarker.addListener('mouseover', () => {
                clusterMarker.setZIndex(Number(google.maps.Marker.MAX_ZINDEX) + count + 1000);
              });

              clusterMarker.addListener('mouseout', () => {
                clusterMarker.setZIndex(Number(google.maps.Marker.MAX_ZINDEX) + count);
              });
              
              return clusterMarker;
            },
          };

          markerClustererRef.current = new MarkerClusterer({
            map: mapInstanceRef.current,
            markers: newMarkers,
            renderer,
            onClusterClick: (event, cluster, map) => {
              // Animación suave al hacer clic en cluster
              const bounds = cluster.bounds as google.maps.LatLngBounds;
              
              // Zoom con animación smooth
              map.fitBounds(bounds, {
                bottom: 150,
                left: 150,
                right: 150,
                top: 150,
              });
              
              // Incrementar zoom levemente para mejor visualización
              setTimeout(() => {
                const currentZoom = map.getZoom() || 12;
                if (currentZoom < 18) {
                  map.setZoom(currentZoom + 1);
                }
              }, 400);
              
              const style = getClusterStyle(cluster.count);
              toast({
                title: `🏘️ ${cluster.count} Propiedades`,
                description: `${style.label} - Expandiendo área`,
              });
            },
          });

          // Ajustar bounds para mostrar todos los marcadores con throttling
          const bounds = new google.maps.LatLngBounds();
          newMarkers.forEach(marker => {
            const position = marker.getPosition();
            if (position) bounds.extend(position);
          });
          
          // Throttled bounds update
          const updateBounds = throttle(() => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.fitBounds(bounds);
            }
          }, 300);
          
          updateBounds();
        }

        // Actualizar contador de propiedades visibles
        setVisiblePropertiesCount(propertiesWithCoords.length);
        
        // Liberar flag de renderizado
        renderingRef.current = false;
      }
    };

    // Iniciar renderizado por lotes
    renderBatch();
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
                    <Select value={filters.estado || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, estado: v === "all" ? "" : v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {estados.map(estado => (
                          <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Municipio</Label>
                    <Select 
                      value={filters.municipio || "all"} 
                      onValueChange={(v) => setFilters(prev => ({ ...prev, municipio: v === "all" ? "" : v }))}
                      disabled={!filters.estado}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {municipios.map(municipio => (
                          <SelectItem key={municipio} value={municipio}>{municipio}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  {mapFilterActive 
                    ? `${propertiesToDisplay.length} ${propertiesToDisplay.length === 1 ? 'propiedad' : 'propiedades'} en el área visible`
                    : `${filteredProperties.length} ${filteredProperties.length === 1 ? 'Propiedad' : 'Propiedades'}`
                  }
                </h2>
              </div>

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
                        size="icon"
                        onClick={centerOnResults}
                        disabled={visiblePropertiesCount === 0}
                        className="w-full rounded-none border-b border-border hover:bg-accent transition-all hover:scale-105"
                        title="Centrar en resultados"
                      >
                        <MapPin className="h-5 w-5" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMapType(prev => prev === 'roadmap' ? 'satellite' : 'roadmap')}
                        className="w-full rounded-none border-b border-border hover:bg-accent transition-all hover:scale-105"
                        title={mapType === 'roadmap' ? 'Vista satélite' : 'Vista mapa'}
                      >
                        {mapType === 'roadmap' ? (
                          <svg className="h-5 w-5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                          </svg>
                        ) : (
                          <svg className="h-5 w-5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>
                          </svg>
                        )}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={centerOnMyLocation}
                        className="w-full rounded-none hover:bg-accent transition-all hover:scale-105"
                        title="Mi ubicación"
                      >
                        <svg className="h-5 w-5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                      size="icon"
                      onClick={() => setMapFilterActive(!mapFilterActive)}
                      className="w-full transition-all hover:scale-105 animate-fade-in shadow-lg"
                      title={mapFilterActive ? "Desactivar filtro de mapa" : "Filtrar por área visible"}
                    >
                      <svg 
                        className={`h-5 w-5 transition-transform ${mapFilterActive ? 'scale-110' : ''}`}
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
