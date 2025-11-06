import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlacesAutocomplete } from '@/hooks/usePlacesAutocomplete';
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
import { MapPin, Bed, Bath, Car, Home as HomeIcon, Search, AlertCircle, Save, Star, Trash2, X } from 'lucide-react';
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
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
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
    loadGoogleMaps()
      .then(() => {
        if (!mapRef.current) return;

        // Crear mapa centrado en CDMX
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center: { lat: 19.4326, lng: -99.1332 },
          zoom: 12,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
        });
      })
      .catch((err) => {
        console.error('Error loading map:', err);
        setMapError(err.message);
      });
  }, []);

  // Actualizar marcadores cuando cambian las propiedades filtradas
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Limpiar marcadores anteriores
    if (markerClustererRef.current) {
      markerClustererRef.current.clearMarkers();
    }
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Crear nuevos marcadores
    const newMarkers = filteredProperties
      .filter(p => p.lat && p.lng)
      .map(property => {
        const marker = new google.maps.Marker({
          position: { lat: Number(property.lat), lng: Number(property.lng) },
          title: property.title,
          map: mapInstanceRef.current,
        });

        marker.addListener('click', () => {
          setHighlightedId(property.id);
          // Scroll al item en la lista
          document.getElementById(`property-${property.id}`)?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest' 
          });
        });

        return marker;
      });

    markersRef.current = newMarkers;

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
  }, [filteredProperties]);

  // Hook de autocompletado de lugares
  const handlePlaceSelect = useCallback((place: google.maps.places.PlaceResult) => {
    if (place.geometry?.location && mapInstanceRef.current) {
      mapInstanceRef.current.setCenter(place.geometry.location);
      mapInstanceRef.current.setZoom(14);
    }
  }, []);

  const { inputRef, isLoaded: autocompleteLoaded, error: autocompleteError } = usePlacesAutocomplete({
    onPlaceSelect: handlePlaceSelect,
  });

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
          <div className="relative max-w-2xl mx-auto">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Buscar por ciudad, colonia o dirección"
              className="pl-10"
              disabled={!autocompleteLoaded}
            />
            {autocompleteError && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{autocompleteError}</AlertDescription>
              </Alert>
            )}
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
                        className={`cursor-pointer transition-all hover:shadow-lg animate-fade-in ${
                          highlightedId === property.id ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => handlePropertyClick(property)}
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
              <Card className="h-full overflow-hidden">
                <div ref={mapRef} className="w-full h-full" />
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Buscar;
