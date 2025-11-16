/// <reference types="google.maps" />
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Home as HomeIcon, Building2, TreePine, ArrowRight, SlidersHorizontal, Briefcase, Store, Warehouse, Building, Tractor, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import heroBackground from "@/assets/hero-background.jpg";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { SearchBar } from "@/components/SearchBar";
import { VirtualizedPropertyGrid } from '@/components/VirtualizedPropertyGrid';
import { PropertyDetailSheet } from "@/components/PropertyDetailSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { NewsletterForm } from "@/components/NewsletterForm";
import { SEOHead } from "@/components/SEOHead";
import { generateWebsiteStructuredData, generateOrganizationStructuredData } from "@/utils/structuredData";
import { usePropertiesInfinite } from "@/hooks/usePropertiesInfinite";
import { InfiniteScrollContainer } from "@/components/InfiniteScrollContainer";
import { LazyImage } from "@/components/LazyImage";
import type { PropertySummary } from '@/types/property';
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

const Home = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [listingType, setListingType] = useState<"venta" | "renta">("venta");
  const [propertyType, setPropertyType] = useState<string>("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Usar infinite scroll para propiedades destacadas y recientes
  const { 
    data: featuredData, 
    fetchNextPage: fetchNextFeatured,
    hasNextPage: hasNextFeatured,
    isFetchingNextPage: isFetchingNextFeatured,
    isLoading: isLoadingFeatured
  } = usePropertiesInfinite({ 
    status: ['activa'],
    // Filtrar solo featured en el futuro, por ahora mostramos activas
  });

  const { 
    data: recentData, 
    fetchNextPage: fetchNextRecent,
    hasNextPage: hasNextRecent,
    isFetchingNextPage: isFetchingNextRecent,
    isLoading: isLoadingRecent
  } = usePropertiesInfinite({ 
    status: ['activa'],
  });

  const featuredProperties = featuredData?.pages.flatMap(page => page.properties) || [] as PropertySummary[];
  const recentProperties = recentData?.pages.flatMap(page => page.properties) || [] as PropertySummary[];
  const isLoadingProperties = isLoadingFeatured || isLoadingRecent;
  
  // Estado para almacenar la ubicación seleccionada del autocomplete
  const [selectedLocation, setSelectedLocation] = useState<{
    address: string;
    municipality: string;
    state: string;
    lat?: number;
    lng?: number;
  } | null>(null);
  
  // Advanced filters
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [bedrooms, setBedrooms] = useState("all");
  const [bathrooms, setBathrooms] = useState("all");
  const [parking, setParking] = useState("all");
  
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  
  const navigate = useNavigate();

  const handleSearch = () => {
    const params = new URLSearchParams();
    const hasLocation = selectedLocation?.state || selectedLocation?.municipality;
    const hasPropertyType = propertyType && propertyType !== 'all';
    const hasAdvancedFilters = priceMin || priceMax || 
                               (bedrooms && bedrooms !== 'all') || 
                               (bathrooms && bathrooms !== 'all') || 
                               (parking && parking !== 'all');
    
    const hasAnyFilter = hasLocation || hasPropertyType || hasAdvancedFilters;
    
    // Solo agregar listingType si hay filtros activos
    if (hasAnyFilter) {
      params.set('listingType', listingType);
    }
    
    if (propertyType && propertyType !== 'all') params.set('tipo', propertyType);
    
    // Usar la ubicación seleccionada del autocomplete si existe
    if (selectedLocation) {
      if (selectedLocation.state) params.set('estado', selectedLocation.state);
      if (selectedLocation.municipality) params.set('municipio', selectedLocation.municipality);
      
      // Pasar coordenadas para centrar el mapa
      if (selectedLocation.lat && selectedLocation.lng) {
        params.set('lat', selectedLocation.lat.toString());
        params.set('lng', selectedLocation.lng.toString());
      }
    }
    
    if (priceMin) params.set('precioMin', priceMin);
    if (priceMax) params.set('precioMax', priceMax);
    if (bedrooms && bedrooms !== 'all') params.set('recamaras', bedrooms);
    if (bathrooms && bathrooms !== 'all') params.set('banos', bathrooms);
    if (parking && parking !== 'all') params.set('estacionamiento', parking);
    
    // Navegar con o sin parámetros
    const queryString = params.toString();
    navigate(queryString ? `/buscar?${queryString}` : '/buscar');
  };

  const handlePlaceSelect = (place: {
    address: string;
    municipality: string;
    state: string;
    lat?: number;
    lng?: number;
  }) => {
    setSelectedLocation(place);
  };

  const handlePropertyClick = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setSheetOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Kentra - Encuentra tu Propiedad Ideal en México | Casas, Departamentos y más"
        description="Plataforma inmobiliaria líder en México. Miles de propiedades en venta y renta: casas, departamentos, terrenos, oficinas. Contacta directamente con agentes certificados."
        canonical="/"
        structuredData={[
          generateWebsiteStructuredData(),
          generateOrganizationStructuredData(),
        ]}
      />
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

              {/* Barra de búsqueda */}
              <SearchBar
                onPlaceSelect={handlePlaceSelect}
                onSearch={handleSearch}
                placeholder="Ciudad, colonia o código postal"
                defaultValue={searchQuery}
              />
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
                Las mejores propiedades seleccionadas para ti
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/buscar")}
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
              <VirtualizedPropertyGrid properties={featuredProperties.slice(0, 6)} />
              <div className="mt-8 text-center">
                <Button variant="outline" size="lg" onClick={() => navigate("/buscar")}>
                  Ver Todas las Propiedades <ArrowRight className="ml-2 h-4 w-4" />
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

      {/* Recent Properties */}
      <section className="py-16 bg-muted">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold">Propiedades Recientes</h2>
              <p className="mt-2 text-muted-foreground">
                Últimas propiedades agregadas a la plataforma
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/buscar")}
              className="hidden md:flex items-center gap-2"
            >
              Ver Todas
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {isLoadingProperties ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[4/3] w-full rounded-lg" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-8 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : recentProperties.length > 0 ? (
            <>
              <VirtualizedPropertyGrid properties={recentProperties.slice(0, 8)} />
              <div className="mt-8 text-center">
                <Button variant="outline" onClick={() => navigate("/buscar")}>
                  Ver Todas <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">
                No hay propiedades recientes disponibles
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Property Types */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-3xl font-bold">
            Explora por Tipo de Propiedad
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <button
              onClick={() => navigate(`/buscar?tipo_listado=${listingType}&tipo=casa`)}
              className="group flex flex-col items-center rounded-xl border border-border bg-background p-8 transition-all hover:border-primary hover:shadow-lg"
            >
              <HomeIcon className="mb-4 h-16 w-16 text-primary transition-transform group-hover:scale-110" />
              <h3 className="text-xl font-semibold">Casas</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Encuentra tu casa perfecta
              </p>
            </button>

            <button
              onClick={() => navigate(`/buscar?tipo_listado=${listingType}&tipo=departamento`)}
              className="group flex flex-col items-center rounded-xl border border-border bg-background p-8 transition-all hover:border-primary hover:shadow-lg"
            >
              <Building2 className="mb-4 h-16 w-16 text-primary transition-transform group-hover:scale-110" />
              <h3 className="text-xl font-semibold">Departamentos</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Vida urbana moderna
              </p>
            </button>

            <button
              onClick={() => navigate(`/buscar?tipo_listado=${listingType}&tipo=terreno`)}
              className="group flex flex-col items-center rounded-xl border border-border bg-background p-8 transition-all hover:border-primary hover:shadow-lg"
            >
              <TreePine className="mb-4 h-16 w-16 text-primary transition-transform group-hover:scale-110" />
              <h3 className="text-xl font-semibold">Terrenos</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Construye tu proyecto
              </p>
            </button>

            <button
              onClick={() => navigate(`/buscar?tipo_listado=${listingType}&tipo=oficina`)}
              className="group flex flex-col items-center rounded-xl border border-border bg-background p-8 transition-all hover:border-primary hover:shadow-lg"
            >
              <Briefcase className="mb-4 h-16 w-16 text-primary transition-transform group-hover:scale-110" />
              <h3 className="text-xl font-semibold">Oficinas</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Espacios profesionales
              </p>
            </button>

            <button
              onClick={() => navigate(`/buscar?tipo_listado=${listingType}&tipo=local`)}
              className="group flex flex-col items-center rounded-xl border border-border bg-background p-8 transition-all hover:border-primary hover:shadow-lg"
            >
              <Store className="mb-4 h-16 w-16 text-primary transition-transform group-hover:scale-110" />
              <h3 className="text-xl font-semibold">Locales</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Comercios y negocios
              </p>
            </button>

            <button
              onClick={() => navigate(`/buscar?tipo_listado=${listingType}&tipo=bodega`)}
              className="group flex flex-col items-center rounded-xl border border-border bg-background p-8 transition-all hover:border-primary hover:shadow-lg"
            >
              <Warehouse className="mb-4 h-16 w-16 text-primary transition-transform group-hover:scale-110" />
              <h3 className="text-xl font-semibold">Bodegas</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Almacenamiento e industria
              </p>
            </button>

            <button
              onClick={() => navigate(`/buscar?tipo_listado=${listingType}&tipo=edificio`)}
              className="group flex flex-col items-center rounded-xl border border-border bg-background p-8 transition-all hover:border-primary hover:shadow-lg"
            >
              <Building className="mb-4 h-16 w-16 text-primary transition-transform group-hover:scale-110" />
              <h3 className="text-xl font-semibold">Edificios</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Inversión comercial
              </p>
            </button>

            <button
              onClick={() => navigate(`/buscar?tipo_listado=${listingType}&tipo=rancho`)}
              className="group flex flex-col items-center rounded-xl border border-border bg-background p-8 transition-all hover:border-primary hover:shadow-lg"
            >
              <Tractor className="mb-4 h-16 w-16 text-primary transition-transform group-hover:scale-110" />
              <h3 className="text-xl font-semibold">Ranchos</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Vida campestre
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
              Suscríbete a Nuestro Newsletter
            </h2>
            <p className="mb-8 text-lg text-muted-foreground">
              Recibe las últimas novedades del mercado inmobiliario, consejos y propiedades destacadas directamente en tu email
            </p>
            <div className="flex justify-center">
              <NewsletterForm />
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
