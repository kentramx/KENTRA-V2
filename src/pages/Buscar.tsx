import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PlaceAutocomplete } from '@/components/PlaceAutocomplete';
import BasicGoogleMap from '@/components/BasicGoogleMap';
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
import { MapPin, Bed, Bath, Car, Search, AlertCircle, Save, Star, Trash2, X, Tag, TrendingUp, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { mexicoStates, mexicoMunicipalities } from '@/data/mexicoLocations';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { PropertyStats } from '@/components/PropertyStats';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  
  const MIN_PRICE = 0;
  const MAX_PRICE = 100;
  const [priceRange, setPriceRange] = useState<[number, number]>([MIN_PRICE, MAX_PRICE]);
  
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [savedSearchQuery, setSavedSearchQuery] = useState('');
  const [savedSearchSort, setSavedSearchSort] = useState<'date' | 'name'>('date');
  
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
  const [hoveredProperty, setHoveredProperty] = useState<Property | null>(null);

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
    const minFromUrl = filters.precioMin ? parseFloat(filters.precioMin) / 1000000 : MIN_PRICE;
    const maxFromUrl = filters.precioMax ? parseFloat(filters.precioMax) / 1000000 : MAX_PRICE;
    setPriceRange([minFromUrl, maxFromUrl]);
  }, []);

  const handlePriceRangeChange = (values: number[]) => {
    setPriceRange(values as [number, number]);
    
    setFilters(prev => ({
      ...prev,
      precioMin: values[0] === MIN_PRICE ? '' : (values[0] * 1000000).toString(),
      precioMax: values[1] === MAX_PRICE ? '' : (values[1] * 1000000).toString(),
    }));
  };

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

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const { data, error } = await supabase
          .from('properties')
          .select(`
            id, title, price, bedrooms, bathrooms, parking, 
            lat, lng, address, state, municipality, type, listing_type,
            images (url, position)
          `)
          .eq('status', 'activa')
          .order('position', { foreignTable: 'images', ascending: true })
          .limit(1000);

        if (error) throw error;

        const propertiesWithSortedImages = data?.map(property => ({
          ...property,
          type: property.type === 'local_comercial' ? 'local' : property.type,
          images: (property.images || []).sort((a: any, b: any) => a.position - b.position)
        })) as Property[] || [];

        setProperties(propertiesWithSortedImages);
        setFilteredProperties(propertiesWithSortedImages);
      } catch (error) {
        console.error('Error fetching properties:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, []);

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
      [filterKey]: filterKey === 'orden' ? 'desc' : ''
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

  const moreFiltersCount = [
    filters.estado,
    filters.municipio,
    filters.orden !== 'desc' ? filters.orden : null
  ].filter(Boolean).length;

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

    filtered.sort((a, b) => 
      filters.orden === 'asc' ? a.price - b.price : b.price - a.price
    );

    setFilteredProperties(filtered);
  }, [filters, properties]);

  const handlePropertyClick = (property: Property) => {
    console.log('Clicked property:', property.id);
  };

  const handleMarkerClick = (propertyId: string) => {
    window.location.href = `/property/${propertyId}`;
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

  const handlePlaceSelect = (location: { address: string; municipality: string; state: string; lat?: number; lng?: number; }) => {
    setFilters(prev => ({
      ...prev,
      estado: location.state || prev.estado,
      municipio: location.municipality || prev.municipio,
    }));

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
      listing_type: p.listing_type,
      address: p.address,
    }));

  const mapCenter = hoveredProperty && hoveredProperty.lat && hoveredProperty.lng
    ? { lat: hoveredProperty.lat, lng: hoveredProperty.lng }
    : (mapMarkers.length > 0
        ? { lat: mapMarkers[0].lat, lng: mapMarkers[0].lng }
        : { lat: 19.4326, lng: -99.1332 });

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-20 pb-8">
        {/* Barra de búsqueda estilo Zillow */}
        <Card className="mb-4 shadow-sm border-border/40">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap">
              {/* 1. Búsqueda de ubicación */}
              <div className="flex items-center gap-2 min-w-[250px] flex-1 lg:flex-initial">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <PlaceAutocomplete
                  onPlaceSelect={handlePlaceSelect}
                  placeholder="Ciudad, código postal o dirección..."
                />
              </div>

              <Separator orientation="vertical" className="h-8 hidden lg:block" />

              {/* 2. Operación (Venta/Renta) */}
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

              {/* 3. Precio */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    {priceRange[0] === MIN_PRICE && priceRange[1] === MAX_PRICE 
                      ? 'Precio' 
                      : `${formatPriceDisplay(priceRange[0])} - ${formatPriceDisplay(priceRange[1])}`}
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm">Rango de precio</h4>
                    <Slider
                      min={MIN_PRICE}
                      max={MAX_PRICE}
                      step={0.5}
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

              {/* 4. Beds & Baths */}
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

              {/* 5. Home Type */}
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

              {/* 6. More (Estado, Municipio, Orden) */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    Más {moreFiltersCount > 0 && `(${moreFiltersCount})`}
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96" align="start">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Ubicación</h4>
                      <div className="space-y-2">
                        <Combobox
                          options={estados.map(e => ({ value: e, label: e }))}
                          value={filters.estado}
                          onValueChange={(value) => setFilters(prev => ({ ...prev, estado: value }))}
                          placeholder="Estado"
                          searchPlaceholder="Buscar estado..."
                        />
                        {filters.estado && (
                          <Combobox
                            options={municipios.map(m => ({ value: m, label: m }))}
                            value={filters.municipio}
                            onValueChange={(value) => setFilters(prev => ({ ...prev, municipio: value }))}
                            placeholder="Municipio"
                            searchPlaceholder="Buscar municipio..."
                          />
                        )}
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-medium text-sm mb-2">Ordenar por</h4>
                      <RadioGroup value={filters.orden} onValueChange={(value: 'asc' | 'desc') => setFilters(prev => ({ ...prev, orden: value }))}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="desc" id="desc" />
                          <Label htmlFor="desc">Precio: Mayor a menor</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="asc" id="asc" />
                          <Label htmlFor="asc">Precio: Menor a mayor</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Espaciador */}
              <div className="flex-1 hidden lg:block" />

              {/* 7. Save search button */}
              {user && (
                <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="default" size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      Guardar
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

            {/* Chips de filtros activos - solo si hay filtros */}
            {activeFiltersCount > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-3 mt-3 border-t border-border/40">
                {getActiveFilterChips().map(chip => (
                  <Badge 
                    key={chip.key} 
                    variant="secondary" 
                    className="gap-1 text-xs py-0 h-6 px-2 hover:bg-secondary/80 transition-colors"
                  >
                    {chip.label}
                    <X className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors" onClick={chip.removeFilter} />
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
                      orden: 'desc',
                    });
                    setPriceRange([MIN_PRICE, MAX_PRICE]);
                  }}
                >
                  Limpiar todo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Layout de dos columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel izquierdo: Lista */}
          <div>
            {/* Búsquedas guardadas */}
            {user && savedSearches.length > 0 && (
              <Card className="mb-6">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4" />
                      <Label className="font-semibold">Búsquedas guardadas</Label>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <Input
                      placeholder="Buscar búsqueda..."
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
              <AnimatedCounter 
                value={filteredProperties.length} 
                label={filteredProperties.length === 1 ? 'propiedad' : 'propiedades'}
              />

              <PropertyStats properties={filteredProperties} />

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
                  {filteredProperties.map((property, index) => (
                    <Link
                      key={property.id}
                      to={`/propiedad/${property.id}`}
                      id={`property-${property.id}`}
                    >
                      <Card
                        className="cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] animate-fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => handlePropertyClick(property)}
                        onMouseEnter={() => setHoveredProperty(property)}
                        onMouseLeave={() => setHoveredProperty(null)}
                      >
                        <CardContent className="p-4">
                          <div className="mb-4 relative">
                            <PropertyImageGallery
                              images={property.images || []}
                              title={property.title}
                              type={property.type}
                            />
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

                          <div className="space-y-3">
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h3 className="font-semibold text-lg hover:text-primary transition-colors line-clamp-1 flex-1">
                                  {property.title}
                                </h3>
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
          <div className="lg:sticky lg:top-20">
            <BasicGoogleMap
              center={mapCenter}
              zoom={12}
              markers={mapMarkers}
              height="calc(100vh - 8rem)"
              className="rounded-lg overflow-hidden shadow-lg"
              onMarkerClick={handleMarkerClick}
              onFavoriteClick={handleFavoriteClick}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Buscar;
