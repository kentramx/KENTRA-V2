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
import { MapPin, Bed, Bath, Car, Home as HomeIcon, Search, AlertCircle, Save, Star, Trash2, X, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

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
  images: { url: string; position: number }[];
}

interface Filters {
  estado: string;
  municipio: string;
  precioMin: string;
  precioMax: string;
  tipo: string;
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
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
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

  // Actualizar URL cuando cambien los filtros
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (filters.estado) params.set('estado', filters.estado);
    if (filters.municipio) params.set('municipio', filters.municipio);
    if (filters.precioMin) params.set('precioMin', filters.precioMin);
    if (filters.precioMax) params.set('precioMax', filters.precioMax);
    if (filters.tipo) params.set('tipo', filters.tipo);
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

  // Inicializar mapa
  useEffect(() => {
    let isMounted = true;
    
    const initMap = async () => {
      try {
        setIsMapLoading(true);
        await loadGoogleMaps();
        
        if (!isMounted || !mapRef.current) return;

        // Pequeño delay para asegurar que el DOM está listo
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!mapRef.current) return;

        // Crear mapa centrado en CDMX
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center: { lat: 19.4326, lng: -99.1332 },
          zoom: 12,
          zoomControl: true,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
        });

        // Esperar a que el mapa esté listo para pintar marcadores
        mapInstanceRef.current.addListener('idle', () => {
          if (!isMounted) return;
          console.log('[Mapa] idle - listo para renderizar marcadores');
          setMapReady(true);
        });


        if (isMounted) {
          setIsMapLoading(false);
        }
      } catch (err: any) {
        console.error('Error loading map:', err);
        if (isMounted) {
          setMapError(err.message || 'Error al cargar el mapa');
          setIsMapLoading(false);
        }
      }
    };

    initMap();

    return () => {
      isMounted = false;
    };
  }, []);

  // Actualizar marcadores cuando cambian las propiedades filtradas
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) {
      console.log('[Marcadores] Mapa no inicializado o no listo aún', { map: !!mapInstanceRef.current, mapReady });
      return;
    }

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

    // Crear nuevos marcadores
    const propertiesWithCoords = filteredProperties.filter(p => p.lat && p.lng);
    console.log('[Marcadores] Propiedades con coordenadas:', propertiesWithCoords.length);

    const newMarkers = propertiesWithCoords.map(property => {
      const priceColor = getPriceColor(property.price);
      const iconSvg = getPropertyIcon(property.type, priceColor);
      const priceLabel = createPriceLabel(property.price, priceColor);
      
      // Crear un elemento HTML personalizado para el marcador
      const markerContent = `
        <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          ${iconSvg}
          ${priceLabel}
        </div>
      `;
      
      // Convertir SVG a data URL
      const svgBlob = new Blob([iconSvg], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(svgBlob);
      
      const marker = new google.maps.Marker({
        position: { lat: Number(property.lat), lng: Number(property.lng) },
        title: property.title,
        map: mapInstanceRef.current,
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

        return `
          <div style="min-width: 280px; max-width: 320px; font-family: system-ui, -apple-system, sans-serif;">
            <img 
              src="${imageUrl}" 
              alt="${prop.title}"
              style="width: 100%; height: 160px; object-fit: cover; border-radius: 8px 8px 0 0; margin: -16px -16px 12px -16px;"
            />
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

      return marker;
    });

    console.log('[Marcadores] Marcadores creados:', newMarkers.length);
    markersRef.current = newMarkers;

    // Guardar referencia de cada marcador por property id
    propertiesWithCoords.forEach((property, index) => {
      markerMapRef.current.set(property.id, newMarkers[index]);
    });


    // Agregar clustering
    if (newMarkers.length > 0) {
      markerClustererRef.current = new MarkerClusterer({
        map: mapInstanceRef.current,
        markers: newMarkers,
      });

      // Ajustar bounds para mostrar todos los marcadores
      const bounds = new google.maps.LatLngBounds();
      newMarkers.forEach(marker => {
        const position = marker.getPosition();
        if (position) bounds.extend(position);
      });
      mapInstanceRef.current.fitBounds(bounds);
    }
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

  // Hook de autocompletado de lugares
  const handlePlaceSelect = useCallback((location: {
    address: string;
    municipality: string;
    state: string;
    lat?: number;
    lng?: number;
  }) => {
    if (location.lat && location.lng && mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ lat: Number(location.lat), lng: Number(location.lng) });
      mapInstanceRef.current.setZoom(14);
    }
  }, []);


  const handlePropertyClick = (property: Property) => {
    setHighlightedId(property.id);
    if (property.lat && property.lng && mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({ lat: Number(property.lat), lng: Number(property.lng) });
      mapInstanceRef.current.setZoom(16);
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

                  <div className="space-y-2">
                    <Label>Precio mínimo</Label>
                    <Input
                      type="number"
                      placeholder="$0"
                      value={filters.precioMin}
                      onChange={(e) => setFilters(prev => ({ ...prev, precioMin: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Precio máximo</Label>
                    <Input
                      type="number"
                      placeholder="Sin límite"
                      value={filters.precioMax}
                      onChange={(e) => setFilters(prev => ({ ...prev, precioMax: e.target.value }))}
                    />
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
                      tipo: '', recamaras: '', banos: '', orden: 'desc'
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
                  {filteredProperties.length} {filteredProperties.length === 1 ? 'Propiedad' : 'Propiedades'}
                </h2>
              </div>

              {filteredProperties.length === 0 ? (
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
                  {filteredProperties.map((property) => (
                    <Link
                      key={property.id}
                      to={`/propiedad/${property.id}`}
                      id={`property-${property.id}`}
                    >
                      <Card
                        className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] animate-fade-in ${
                          highlightedId === property.id ? 'ring-2 ring-primary shadow-xl' : ''
                        }`}
                        onClick={() => handlePropertyClick(property)}
                        onMouseEnter={() => setHoveredPropertyId(property.id)}
                        onMouseLeave={() => setHoveredPropertyId(null)}
                      >
                        <CardContent className="p-4">
                          {/* Galería de imágenes */}
                          <div className="mb-4">
                            <PropertyImageGallery
                              images={property.images || []}
                              title={property.title}
                              type={property.type}
                            />
                          </div>

                          {/* Información de la propiedad */}
                          <div className="space-y-3">
                            <div>
                              <h3 className="font-semibold text-lg hover:text-primary transition-colors line-clamp-1">
                                {property.title}
                              </h3>
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
                
                {/* Indicador de carga */}
                {isMapLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
                    <div className="text-center space-y-2">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      <p className="text-sm text-muted-foreground">Cargando mapa...</p>
                    </div>
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
