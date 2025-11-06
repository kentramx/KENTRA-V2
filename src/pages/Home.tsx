/// <reference types="@types/google.maps" />
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Home as HomeIcon, Building2, TreePine, ArrowRight, SlidersHorizontal, Save, Star, Trash2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import heroBackground from "@/assets/hero-background.jpg";
import { usePlacesAutocomplete } from "@/hooks/usePlacesAutocomplete";
import { supabase } from "@/integrations/supabase/client";
import PropertyCard from "@/components/PropertyCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Property {
  id: string;
  title: string;
  price: number;
  type: string;
  listing_type: string;
  address: string;
  municipality: string;
  state: string;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  sqft?: number;
  images?: { url: string }[];
}

const Home = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [listingType, setListingType] = useState<"venta" | "renta">("venta");
  const [propertyType, setPropertyType] = useState<string>("all");
  const [featuredProperties, setFeaturedProperties] = useState<Property[]>([]);
  const [isLoadingProperties, setIsLoadingProperties] = useState(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Advanced filters
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [parking, setParking] = useState("");
  
  // Saved searches
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState("");
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const handlePlaceSelect = (place: google.maps.places.PlaceResult) => {
    const addressComponents = place.address_components || [];
    
    let municipio = '';
    let estado = '';
    
    addressComponents.forEach(component => {
      if (component.types.includes('locality') || 
          component.types.includes('sublocality') ||
          component.types.includes('administrative_area_level_2')) {
        municipio = component.long_name;
      }
      if (component.types.includes('administrative_area_level_1')) {
        estado = component.long_name;
      }
    });

    const params = new URLSearchParams();
    
    params.set('tipo_listado', listingType);
    if (propertyType && propertyType !== 'all') params.set('tipo', propertyType);
    if (estado) params.set('estado', estado);
    if (municipio) params.set('municipio', municipio);
    if (priceMin) params.set('precioMin', priceMin);
    if (priceMax) params.set('precioMax', priceMax);
    if (bedrooms) params.set('recamaras', bedrooms);
    if (bathrooms) params.set('banos', bathrooms);
    if (parking) params.set('estacionamiento', parking);
    
    if (!estado && !municipio && place.formatted_address) {
      params.set('busqueda', place.formatted_address);
    }

    navigate(`/propiedades?${params.toString()}`);
  };

  const { inputRef, isLoaded, error } = usePlacesAutocomplete({
    onPlaceSelect: handlePlaceSelect
  });

  const handleSearch = () => {
    const params = new URLSearchParams();
    params.set('tipo_listado', listingType);
    if (propertyType && propertyType !== 'all') params.set('tipo', propertyType);
    if (searchQuery) params.set('busqueda', encodeURIComponent(searchQuery));
    if (priceMin) params.set('precioMin', priceMin);
    if (priceMax) params.set('precioMax', priceMax);
    if (bedrooms) params.set('recamaras', bedrooms);
    if (bathrooms) params.set('banos', bathrooms);
    if (parking) params.set('estacionamiento', parking);
    navigate(`/propiedades?${params.toString()}`);
  };

  // Load saved searches
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
      navigate('/auth');
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

    const filters = {
      tipo_listado: listingType,
      tipo: propertyType !== 'all' ? propertyType : '',
      precioMin: priceMin,
      precioMax: priceMax,
      recamaras: bedrooms,
      banos: bathrooms,
      estacionamiento: parking,
    };

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
    setListingType(savedFilters.tipo_listado || 'venta');
    setPropertyType(savedFilters.tipo || 'all');
    setPriceMin(savedFilters.precioMin || '');
    setPriceMax(savedFilters.precioMax || '');
    setBedrooms(savedFilters.recamaras || '');
    setBathrooms(savedFilters.banos || '');
    setParking(savedFilters.estacionamiento || '');
    
    setLoadDialogOpen(false);
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
    const fetchFeaturedProperties = async () => {
      setIsLoadingProperties(true);
      try {
        const { data, error } = await supabase
          .from('properties')
          .select(`
            id,
            title,
            price,
            type,
            listing_type,
            address,
            municipality,
            state,
            bedrooms,
            bathrooms,
            parking,
            sqft,
            images (url)
          `)
          .eq('status', 'activa')
          .eq('listing_type', listingType)
          .order('created_at', { ascending: false })
          .limit(6);

        if (error) throw error;
        setFeaturedProperties(data || []);
      } catch (error) {
        console.error('Error fetching featured properties:', error);
      } finally {
        setIsLoadingProperties(false);
      }
    };

    fetchFeaturedProperties();
  }, [listingType]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section
        className="relative flex min-h-[600px] items-center justify-center bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBackground})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-black/30" />
        <div className="container relative z-10 mx-auto px-4 text-center text-white">
          <h1 className="mb-4 text-5xl font-bold md:text-6xl">
            Encuentra Tu Hogar Ideal
          </h1>
          <p className="mb-8 text-xl md:text-2xl">
            Miles de propiedades en México esperándote
          </p>

          {/* Search Bar */}
          <div className="mx-auto max-w-3xl">
            <div className="flex flex-col gap-4">
              {/* Listing Type Selector */}
              <div className="flex justify-center gap-2">
                <Button
                  type="button"
                  variant={listingType === "venta" ? "default" : "outline"}
                  size="lg"
                  onClick={() => setListingType("venta")}
                  className={listingType === "venta" ? "" : "bg-white/90 text-foreground hover:bg-white border-white/50"}
                >
                  Venta
                </Button>
                <Button
                  type="button"
                  variant={listingType === "renta" ? "default" : "outline"}
                  size="lg"
                  onClick={() => setListingType("renta")}
                  className={listingType === "renta" ? "" : "bg-white/90 text-foreground hover:bg-white border-white/50"}
                >
                  Renta
                </Button>
              </div>

              {/* Property Type Selector */}
              <div className="flex justify-center">
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger className="w-full max-w-xs bg-white/95 text-foreground border-white/50">
                    <SelectValue placeholder="Todos los tipos de propiedad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    <SelectItem value="casa">Casa</SelectItem>
                    <SelectItem value="departamento">Departamento</SelectItem>
                    <SelectItem value="terreno">Terreno</SelectItem>
                    <SelectItem value="oficina">Oficina</SelectItem>
                    <SelectItem value="local">Local Comercial</SelectItem>
                    <SelectItem value="bodega">Bodega</SelectItem>
                    <SelectItem value="edificio">Edificio</SelectItem>
                    <SelectItem value="rancho">Rancho</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Saved Searches Buttons */}
              <div className="flex justify-center gap-2">
                <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="bg-white/95 text-foreground border-white/50 hover:bg-white"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Guardar Búsqueda
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Guardar Búsqueda</DialogTitle>
                      <DialogDescription>
                        Guarda esta búsqueda para acceder rápidamente después
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="searchName">Nombre de la búsqueda</Label>
                        <Input
                          id="searchName"
                          placeholder="Ej: Casas en CDMX bajo 5M"
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
                        <Save className="mr-2 h-4 w-4" />
                        Guardar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {user && savedSearches.length > 0 && (
                  <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="bg-white/95 text-foreground border-white/50 hover:bg-white"
                      >
                        <Star className="mr-2 h-4 w-4" />
                        Mis Búsquedas ({savedSearches.length})
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Mis Búsquedas Guardadas</DialogTitle>
                        <DialogDescription>
                          Selecciona una búsqueda para cargar sus filtros
                        </DialogDescription>
                      </DialogHeader>
                      <div className="max-h-96 overflow-y-auto space-y-2">
                        {savedSearches.map((search) => (
                          <div
                            key={search.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent"
                          >
                            <button
                              onClick={() => handleLoadSearch(search.filters)}
                              className="flex-1 text-left"
                            >
                              <p className="font-medium">{search.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(search.created_at).toLocaleDateString('es-MX')}
                              </p>
                            </button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteSearch(search.id, search.name)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {/* Advanced Filters */}
              <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full max-w-xs mx-auto bg-white/95 text-foreground border-white/50 hover:bg-white"
                  >
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Filtros Avanzados
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <div className="bg-white/95 rounded-lg p-4 space-y-4 max-w-3xl mx-auto">
                    {/* Price Range */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="priceMin" className="text-sm font-medium text-foreground">
                          Precio Mínimo
                        </Label>
                        <Input
                          id="priceMin"
                          type="number"
                          placeholder="$0"
                          value={priceMin}
                          onChange={(e) => setPriceMin(e.target.value)}
                          className="bg-white text-foreground"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="priceMax" className="text-sm font-medium text-foreground">
                          Precio Máximo
                        </Label>
                        <Input
                          id="priceMax"
                          type="number"
                          placeholder="Sin límite"
                          value={priceMax}
                          onChange={(e) => setPriceMax(e.target.value)}
                          className="bg-white text-foreground"
                        />
                      </div>
                    </div>

                    {/* Bedrooms, Bathrooms, Parking */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bedrooms" className="text-sm font-medium text-foreground">
                          Recámaras
                        </Label>
                        <Select value={bedrooms} onValueChange={setBedrooms}>
                          <SelectTrigger id="bedrooms" className="bg-white text-foreground">
                            <SelectValue placeholder="Cualquiera" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Cualquiera</SelectItem>
                            <SelectItem value="1">1+</SelectItem>
                            <SelectItem value="2">2+</SelectItem>
                            <SelectItem value="3">3+</SelectItem>
                            <SelectItem value="4">4+</SelectItem>
                            <SelectItem value="5">5+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="bathrooms" className="text-sm font-medium text-foreground">
                          Baños
                        </Label>
                        <Select value={bathrooms} onValueChange={setBathrooms}>
                          <SelectTrigger id="bathrooms" className="bg-white text-foreground">
                            <SelectValue placeholder="Cualquiera" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Cualquiera</SelectItem>
                            <SelectItem value="1">1+</SelectItem>
                            <SelectItem value="2">2+</SelectItem>
                            <SelectItem value="3">3+</SelectItem>
                            <SelectItem value="4">4+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="parking" className="text-sm font-medium text-foreground">
                          Estacionamiento
                        </Label>
                        <Select value={parking} onValueChange={setParking}>
                          <SelectTrigger id="parking" className="bg-white text-foreground">
                            <SelectValue placeholder="Cualquiera" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Cualquiera</SelectItem>
                            <SelectItem value="1">1+</SelectItem>
                            <SelectItem value="2">2+</SelectItem>
                            <SelectItem value="3">3+</SelectItem>
                            <SelectItem value="4">4+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Clear Filters Button */}
                    {(priceMin || priceMax || bedrooms || bathrooms || parking) && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setPriceMin("");
                          setPriceMax("");
                          setBedrooms("");
                          setBathrooms("");
                          setParking("");
                        }}
                        className="w-full"
                      >
                        Limpiar Filtros
                      </Button>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="flex gap-2 rounded-lg bg-white p-2 shadow-2xl">
                <div className="flex flex-1 items-center gap-2 px-4">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Ciudad, colonia o código postal"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    disabled={!isLoaded && !error}
                    className="border-0 bg-transparent text-foreground focus-visible:ring-0"
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  size="lg"
                  className="bg-secondary hover:bg-secondary/90"
                >
                  <Search className="mr-2 h-5 w-5" />
                  Buscar
                </Button>
              </div>
              {error && (
                <p className="text-xs text-yellow-400 text-center animate-fade-in">
                  Búsqueda con sugerencias no disponible. Puedes buscar manualmente.
                </p>
              )}
              {!isLoaded && !error && (
                <p className="text-xs text-white/70 text-center animate-fade-in">
                  Cargando sugerencias...
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Properties */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold">Propiedades Destacadas</h2>
              <p className="mt-2 text-muted-foreground">
                Descubre las últimas propiedades agregadas
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/propiedades")}
              className="hidden md:flex items-center gap-2"
            >
              Ver Todas
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {isLoadingProperties ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[4/3] w-full rounded-lg" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-8 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : featuredProperties.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {featuredProperties.map((property, index) => (
                  <div
                    key={property.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${index * 100}ms` }}
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
                      bedrooms={property.bedrooms}
                      bathrooms={property.bathrooms}
                      parking={property.parking}
                      sqft={property.sqft}
                      imageUrl={property.images?.[0]?.url}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-8 text-center md:hidden">
                <Button
                  variant="outline"
                  onClick={() => navigate("/propiedades")}
                  className="w-full sm:w-auto"
                >
                  Ver Todas las Propiedades
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">
                No hay propiedades disponibles en este momento
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Property Types */}
      <section className="py-16 bg-muted">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-3xl font-bold">
            Explora por Tipo de Propiedad
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <button
              onClick={() => navigate(`/propiedades?tipo_listado=${listingType}&tipo=casa`)}
              className="group flex flex-col items-center rounded-xl border border-border p-8 transition-all hover:border-primary hover:shadow-lg"
            >
              <HomeIcon className="mb-4 h-16 w-16 text-primary transition-transform group-hover:scale-110" />
              <h3 className="text-xl font-semibold">Casas</h3>
              <p className="mt-2 text-muted-foreground">
                Encuentra tu casa perfecta
              </p>
            </button>

            <button
              onClick={() => navigate(`/propiedades?tipo_listado=${listingType}&tipo=departamento`)}
              className="group flex flex-col items-center rounded-xl border border-border p-8 transition-all hover:border-primary hover:shadow-lg"
            >
              <Building2 className="mb-4 h-16 w-16 text-primary transition-transform group-hover:scale-110" />
              <h3 className="text-xl font-semibold">Departamentos</h3>
              <p className="mt-2 text-muted-foreground">
                Vida urbana moderna
              </p>
            </button>

            <button
              onClick={() => navigate(`/propiedades?tipo_listado=${listingType}&tipo=terreno`)}
              className="group flex flex-col items-center rounded-xl border border-border p-8 transition-all hover:border-primary hover:shadow-lg"
            >
              <TreePine className="mb-4 h-16 w-16 text-primary transition-transform group-hover:scale-110" />
              <h3 className="text-xl font-semibold">Terrenos</h3>
              <p className="mt-2 text-muted-foreground">
                Construye tu proyecto
              </p>
            </button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-muted py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold">¿Tienes una Propiedad?</h2>
          <p className="mb-8 text-xl text-muted-foreground">
            Publica tu propiedad y llega a miles de compradores potenciales
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/publicar")}
            className="bg-secondary hover:bg-secondary/90"
          >
            Publicar Gratis
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 Kentra. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
