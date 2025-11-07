/// <reference types="google.maps" />
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Home as HomeIcon, Building2, TreePine, ArrowRight, SlidersHorizontal, Map } from "lucide-react";
import Navbar from "@/components/Navbar";
import heroBackground from "@/assets/hero-background.jpg";
import { usePlacesAutocomplete } from "@/hooks/usePlacesAutocomplete";
import { supabase } from "@/integrations/supabase/client";
import PropertyCard from "@/components/PropertyCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { NewsletterForm } from "@/components/NewsletterForm";
import { InteractiveMapSearch } from "@/components/InteractiveMapSearch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [bedrooms, setBedrooms] = useState("all");
  const [bathrooms, setBathrooms] = useState("all");
  const [parking, setParking] = useState("all");
  
  const navigate = useNavigate();

  const { inputRef, isLoaded, error } = usePlacesAutocomplete({
    onPlaceSelect: (place) => {
      if (place.formatted_address) setSearchQuery(place.formatted_address);
    }
  });

  const handlePlaceSelect = (location: {
    address: string;
    municipality: string;
    state: string;
    lat?: number;
    lng?: number;
  }) => {
    const params = new URLSearchParams();
    
    params.set('tipo_listado', listingType);
    if (propertyType && propertyType !== 'all') params.set('tipo', propertyType);
    if (location.state) params.set('estado', location.state);
    if (location.municipality) params.set('municipio', location.municipality);
    if (priceMin) params.set('precioMin', priceMin);
    if (priceMax) params.set('precioMax', priceMax);
    if (bedrooms && bedrooms !== 'all') params.set('recamaras', bedrooms);
    if (bathrooms && bathrooms !== 'all') params.set('banos', bathrooms);
    if (parking && parking !== 'all') params.set('estacionamiento', parking);
    
    if (!location.state && !location.municipality && location.address) {
      params.set('busqueda', location.address);
    }

    navigate(`/propiedades?${params.toString()}`);
  };

  const handleMapLocationSelect = (location: {
    address: string;
    municipality: string;
    state: string;
    lat: number;
    lng: number;
  }) => {
    handlePlaceSelect(location);
  };
  const handleSearch = () => {
    const params = new URLSearchParams();
    params.set('tipo_listado', listingType);
    if (propertyType && propertyType !== 'all') params.set('tipo', propertyType);
    if (searchQuery) params.set('busqueda', encodeURIComponent(searchQuery));
    if (priceMin) params.set('precioMin', priceMin);
    if (priceMax) params.set('precioMax', priceMax);
    if (bedrooms && bedrooms !== 'all') params.set('recamaras', bedrooms);
    if (bathrooms && bathrooms !== 'all') params.set('banos', bathrooms);
    if (parking && parking !== 'all') params.set('estacionamiento', parking);
    navigate(`/propiedades?${params.toString()}`);
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
                            <SelectItem value="all">Cualquiera</SelectItem>
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
                            <SelectItem value="all">Cualquiera</SelectItem>
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
                            <SelectItem value="all">Cualquiera</SelectItem>
                            <SelectItem value="1">1+</SelectItem>
                            <SelectItem value="2">2+</SelectItem>
                            <SelectItem value="3">3+</SelectItem>
                            <SelectItem value="4">4+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Clear Filters Button */}
                    {(priceMin || priceMax || (bedrooms && bedrooms !== 'all') || (bathrooms && bathrooms !== 'all') || (parking && parking !== 'all')) && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setPriceMin("");
                          setPriceMax("");
                          setBedrooms("all");
                          setBathrooms("all");
                          setParking("all");
                        }}
                        className="w-full"
                      >
                        Limpiar Filtros
                      </Button>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Tabs para búsqueda por texto o mapa */}
              <Tabs defaultValue="search" className="w-full">
                <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-white/95">
                  <TabsTrigger value="search" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Search className="mr-2 h-4 w-4" />
                    Buscar
                  </TabsTrigger>
                  <TabsTrigger value="map" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Map className="mr-2 h-4 w-4" />
                    Mapa
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="search" className="mt-4">
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
                </TabsContent>
                
                <TabsContent value="map" className="mt-4">
                  <InteractiveMapSearch
                    onLocationSelect={handleMapLocationSelect}
                    height="450px"
                    defaultZoom={6}
                  />
                </TabsContent>
              </Tabs>
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

      {/* Newsletter Section */}
      <section className="bg-primary/5 py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold">
              Recibe Alertas de Nuevas Propiedades
            </h2>
            <p className="mb-8 text-lg text-muted-foreground">
              Suscríbete y te notificaremos cuando haya propiedades que coincidan con
              tus preferencias
            </p>
            <div className="flex justify-center">
              <NewsletterForm />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
            <div>
              <h3 className="font-semibold text-lg mb-3">Kentra</h3>
              <p className="text-muted-foreground text-sm">
                Tu plataforma de confianza para encontrar la propiedad perfecta en
                México.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-3">Enlaces Rápidos</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <button
                    onClick={() => navigate("/propiedades")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Buscar Propiedades
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate("/publicar")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Publicar Propiedad
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-3">Mantente Informado</h3>
              <p className="text-muted-foreground text-sm mb-3">
                Recibe las últimas propiedades directamente en tu correo
              </p>
              <NewsletterForm />
            </div>
          </div>
          <div className="text-center text-muted-foreground text-sm pt-6 border-t border-border">
            <p>© 2025 Kentra. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
