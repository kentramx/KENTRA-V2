import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Home as HomeIcon, Building2, TreePine, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import heroBackground from "@/assets/hero-background.jpg";
import { usePlacesAutocomplete } from "@/hooks/usePlacesAutocomplete";
import { supabase } from "@/integrations/supabase/client";
import PropertyCard from "@/components/PropertyCard";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [featuredProperties, setFeaturedProperties] = useState<Property[]>([]);
  const [isLoadingProperties, setIsLoadingProperties] = useState(true);
  const navigate = useNavigate();

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
    if (estado) params.set('estado', estado);
    if (municipio) params.set('municipio', municipio);
    
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
    if (searchQuery) params.set('busqueda', encodeURIComponent(searchQuery));
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
              onClick={() => navigate("/propiedades?tipo=casa")}
              className="group flex flex-col items-center rounded-xl border border-border p-8 transition-all hover:border-primary hover:shadow-lg"
            >
              <HomeIcon className="mb-4 h-16 w-16 text-primary transition-transform group-hover:scale-110" />
              <h3 className="text-xl font-semibold">Casas</h3>
              <p className="mt-2 text-muted-foreground">
                Encuentra tu casa perfecta
              </p>
            </button>

            <button
              onClick={() => navigate("/propiedades?tipo=departamento")}
              className="group flex flex-col items-center rounded-xl border border-border p-8 transition-all hover:border-primary hover:shadow-lg"
            >
              <Building2 className="mb-4 h-16 w-16 text-primary transition-transform group-hover:scale-110" />
              <h3 className="text-xl font-semibold">Departamentos</h3>
              <p className="mt-2 text-muted-foreground">
                Vida urbana moderna
              </p>
            </button>

            <button
              onClick={() => navigate("/propiedades?tipo=terreno")}
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
