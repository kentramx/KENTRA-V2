/// <reference types="google.maps" />
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Home as HomeIcon, Building2, TreePine, ArrowRight, SlidersHorizontal, Briefcase, Store, Warehouse, Building, Tractor, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import heroBackground from "@/assets/hero-background.jpg";
import { SearchBar } from "@/components/SearchBar";
import { VirtualizedPropertyGrid } from '@/components/VirtualizedPropertyGrid';
import { PropertyDetailSheet } from "@/components/PropertyDetailSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { NewsletterForm } from "@/components/NewsletterForm";
import { SEOHead } from "@/components/SEOHead";
import { generateWebsiteStructuredData, generateOrganizationStructuredData } from "@/utils/structuredData";
import { useHomeProperties } from "@/hooks/useHomeProperties";
import type { PropertySummary } from '@/types/property';
import StatsCounter from '@/components/home/StatsCounter';
import Testimonials from '@/components/home/Testimonials';
import TrustedBy from '@/components/home/TrustedBy';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Footer } from "@/components/Footer";
import { PROPERTY_TYPES, PROPERTY_CATEGORIES, PropertyCategory } from "@/config/propertyTypes";

const Home = () => {
  const [listingType, setListingType] = useState<"venta" | "renta">("venta");
  const [propertyType, setPropertyType] = useState<string>("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    address: string;
    municipality: string;
    state: string;
    lat?: number;
    lng?: number;
  } | null>(null);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [bedrooms, setBedrooms] = useState("all");
  const [bathrooms, setBathrooms] = useState("all");
  const [parking, setParking] = useState("all");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const navigate = useNavigate();

  const { featuredProperties, recentProperties, isLoading: isLoadingProperties } = useHomeProperties();

  const handleSearch = () => {
    const params = new URLSearchParams();
    const hasLocation = selectedLocation?.state || selectedLocation?.municipality;
    const hasPropertyType = propertyType && propertyType !== 'all';
    const hasAdvancedFilters = priceMin || priceMax || (bedrooms && bedrooms !== 'all') || (bathrooms && bathrooms !== 'all') || (parking && parking !== 'all');
    const hasAnyFilter = hasLocation || hasPropertyType || hasAdvancedFilters;

    if (hasAnyFilter) params.set('listingType', listingType);
    if (propertyType && propertyType !== 'all') params.set('tipo', propertyType);
    if (selectedLocation) {
      if (selectedLocation.state) params.set('estado', selectedLocation.state);
      if (selectedLocation.municipality) params.set('municipio', selectedLocation.municipality);
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

    const queryString = params.toString();
    navigate(queryString ? `/buscar?${queryString}` : '/buscar');
  };

  const handlePlaceSelect = (place: { address: string; municipality: string; state: string; lat?: number; lng?: number; }) => {
    setSelectedLocation(place);
  };

  const handlePropertyClick = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setSheetOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="Kentra - Encuentra tu Propiedad Ideal en México | Venta y Renta" 
        description="El marketplace inmobiliario de México. Propiedades residenciales, comerciales e industriales. Contacta agentes certificados." 
        canonical="/"
        structuredData={[generateWebsiteStructuredData(), generateOrganizationStructuredData()]} 
      />
      <Navbar />

      {/* ULTRA COMPACT Hero Section - properties visible above fold */}
      <section className="relative min-h-[38vh] md:min-h-[42vh] flex items-start overflow-hidden">
        {/* Background mesh gradient */}
        <div className="absolute inset-0 gradient-mesh-olive" />
        
        {/* Background image with refined overlay */}
        <div className="absolute inset-0">
          <img src={heroBackground} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/80 via-foreground/65 to-foreground/50" />
        </div>

        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        <div className="container relative z-10 text-center text-white px-4 pt-20 md:pt-24 pb-6">
          {/* Trust badge - compact */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-xs font-medium mb-3 animate-fade-in-up shadow-lg">
            <Sparkles className="w-3 h-3 text-amber-300" />
            Plataforma inmobiliaria #1 en México
          </div>
          
          {/* Compact heading */}
          <h1 
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white text-balance max-w-3xl mx-auto mb-2 animate-fade-in-up drop-shadow-lg" 
            style={{ animationDelay: '100ms', letterSpacing: '-0.025em' }}
          >
            Tu próximo inmueble,
            <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent"> a un clic</span>
          </h1>
          
          {/* Short subtitle - hidden on mobile */}
          <p className="hidden sm:block text-base md:text-lg text-white/85 max-w-xl mx-auto mb-3 animate-fade-in-up font-medium" style={{ animationDelay: '200ms' }}>
            Miles de propiedades verificadas en todo México
          </p>
          
          {/* Compact Glass Search Card */}
          <div className="max-w-2xl mx-auto animate-scale-in" style={{ animationDelay: '300ms' }}>
            <div className="bg-white/25 backdrop-blur-lg rounded-2xl shadow-xl border border-white/30 p-3 md:p-4">
              {/* Listing Type Toggle - compact */}
              <div className="inline-flex p-1 bg-black/30 rounded-xl mb-3 backdrop-blur-sm">
                <Button 
                  type="button" 
                  variant={listingType === "venta" ? "default" : "ghost"} 
                  onClick={() => setListingType("venta")}
                  className={`px-5 py-2 rounded-lg font-semibold text-sm transition-all ${listingType !== "venta" ? "text-white/90 hover:text-white hover:bg-white/20" : "bg-white text-gray-900 shadow-md"}`}
                >
                  Venta
                </Button>
                <Button 
                  type="button" 
                  variant={listingType === "renta" ? "default" : "ghost"} 
                  onClick={() => setListingType("renta")}
                  className={`px-5 py-2 rounded-lg font-semibold text-sm transition-all ${listingType !== "renta" ? "text-white/90 hover:text-white hover:bg-white/20" : "bg-white text-gray-900 shadow-md"}`}
                >
                  Renta
                </Button>
              </div>

              {/* Property Type - compact */}
              <div className="flex justify-center mb-2">
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger className="w-full max-w-xs h-10 bg-white/25 border border-white/40 text-white font-medium [&>span]:text-white rounded-xl text-sm">
                    <SelectValue placeholder="Tipo de propiedad" className="text-white" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    {(['residencial', 'comercial', 'industrial', 'terrenos', 'desarrollos'] as PropertyCategory[]).map(category => (
                      <SelectGroup key={category}>
                        <SelectLabel className="text-xs font-semibold text-muted-foreground px-2">{PROPERTY_CATEGORIES[category]}</SelectLabel>
                        {PROPERTY_TYPES
                          .filter(t => t.category === category)
                          .map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))
                        }
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Advanced Filters - compact */}
              <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="mx-auto mb-2 text-white/75 hover:text-white hover:bg-white/15 font-medium text-xs h-7">
                    <SlidersHorizontal className="mr-1.5 h-3 w-3" />
                    Más filtros
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mb-2">
                  <div className="bg-white/15 rounded-xl p-3 space-y-3 text-left border border-white/20 backdrop-blur-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="priceMin" className="text-xs font-semibold text-white">Precio Mínimo</Label>
                        <Input id="priceMin" type="number" placeholder="$0" value={priceMin} onChange={e => setPriceMin(e.target.value)} className="h-9 bg-white/25 border border-white/40 text-white placeholder:text-white/60 rounded-lg font-medium text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="priceMax" className="text-xs font-semibold text-white">Precio Máximo</Label>
                        <Input id="priceMax" type="number" placeholder="Sin límite" value={priceMax} onChange={e => setPriceMax(e.target.value)} className="h-9 bg-white/25 border border-white/40 text-white placeholder:text-white/60 rounded-lg font-medium text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Select value={bedrooms} onValueChange={setBedrooms}>
                        <SelectTrigger className="h-9 bg-white/25 border border-white/40 text-white [&>span]:text-white rounded-lg font-medium text-sm"><SelectValue placeholder="Recámaras" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Cualquiera</SelectItem>
                          <SelectItem value="1">1+</SelectItem>
                          <SelectItem value="2">2+</SelectItem>
                          <SelectItem value="3">3+</SelectItem>
                          <SelectItem value="4">4+</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={bathrooms} onValueChange={setBathrooms}>
                        <SelectTrigger className="h-9 bg-white/25 border border-white/40 text-white [&>span]:text-white rounded-lg font-medium text-sm"><SelectValue placeholder="Baños" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Cualquiera</SelectItem>
                          <SelectItem value="1">1+</SelectItem>
                          <SelectItem value="2">2+</SelectItem>
                          <SelectItem value="3">3+</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={parking} onValueChange={setParking}>
                        <SelectTrigger className="h-9 bg-white/25 border border-white/40 text-white [&>span]:text-white rounded-lg font-medium text-sm"><SelectValue placeholder="Parking" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Cualquiera</SelectItem>
                          <SelectItem value="1">1+</SelectItem>
                          <SelectItem value="2">2+</SelectItem>
                          <SelectItem value="3">3+</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Search Bar */}
              <SearchBar onPlaceSelect={handlePlaceSelect} onSearch={handleSearch} placeholder="Ciudad, colonia o código postal" />
            </div>
          </div>
        </div>
      </section>

      {/* QUICK PROPERTIES - Immediately visible after hero */}
      <section className="py-6 md:py-8 bg-background border-b border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-bold tracking-tight">Propiedades Destacadas</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/buscar")} className="text-primary text-sm">
              Ver todas <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          
          {isLoadingProperties ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-5 w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <VirtualizedPropertyGrid 
              properties={(featuredProperties.length > 0 ? featuredProperties : recentProperties).slice(0, 6)} 
              onPropertyClick={handlePropertyClick} 
            />
          )}
        </div>
      </section>

      {/* Trust Indicators - MOVED after quick properties */}
      <TrustedBy />

      {/* Stats Counter - MOVED after TrustedBy */}
      <StatsCounter />

      {/* TIER S: Featured Properties - Full section (if has featured) */}
      {featuredProperties.length > 0 && (
        <section className="py-12 md:py-16 lg:py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="decorative-line" />
              <span className="section-badge">Destacadas</span>
            </div>
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight" style={{ letterSpacing: '-0.02em' }}>Propiedades Destacadas</h2>
                <p className="mt-2 text-base text-muted-foreground max-w-xl">
                  Selección curada de las mejores propiedades del mercado
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate("/buscar")} className="hidden md:flex group">
                Ver Todas
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>

            {isLoadingProperties ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-8 w-1/2" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <VirtualizedPropertyGrid properties={featuredProperties.slice(0, 6)} onPropertyClick={handlePropertyClick} />
                <div className="mt-8 text-center md:hidden">
                  <Button variant="outline" size="lg" onClick={() => navigate("/buscar")}>
                    Ver Todas las Propiedades <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* TIER S: Recent Properties */}
      <section className="py-12 md:py-16 lg:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="decorative-line" />
            <span className="section-badge">Recientes</span>
          </div>
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight" style={{ letterSpacing: '-0.02em' }}>Propiedades Recientes</h2>
              <p className="mt-2 text-base text-muted-foreground max-w-xl">
                Últimas propiedades agregadas a la plataforma
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/buscar")} className="hidden md:flex group">
              Ver Todas
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>

          {isLoadingProperties ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-8 w-1/2" />
                </div>
              ))}
            </div>
          ) : recentProperties.length > 0 ? (
            <>
              <VirtualizedPropertyGrid properties={recentProperties.slice(0, 8)} onPropertyClick={handlePropertyClick} />
              <div className="mt-8 text-center md:hidden">
                <Button variant="outline" onClick={() => navigate("/buscar")}>
                  Ver Todas <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No hay propiedades recientes disponibles</p>
            </div>
          )}
        </div>
      </section>

      {/* TIER S: Property Types */}
      <section className="py-12 md:py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-2">
              <div className="decorative-line" />
            </div>
            <h2 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Explora por Tipo de Propiedad</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[
              { icon: HomeIcon, label: "Casas", desc: "Encuentra tu casa perfecta", type: "casa" },
              { icon: Building2, label: "Departamentos", desc: "Vida urbana moderna", type: "departamento" },
              { icon: TreePine, label: "Terrenos", desc: "Construye tu proyecto", type: "terreno" },
              { icon: Briefcase, label: "Oficinas", desc: "Espacios profesionales", type: "oficina" },
              { icon: Store, label: "Locales", desc: "Comercios y negocios", type: "local" },
              { icon: Warehouse, label: "Bodegas", desc: "Almacenamiento e industria", type: "bodega" },
              { icon: Building, label: "Edificios", desc: "Inversión comercial", type: "edificio" },
              { icon: Tractor, label: "Ranchos", desc: "Vida campestre", type: "rancho" },
            ].map((item) => (
              <button 
                key={item.type}
                onClick={() => navigate(`/buscar?tipo_listado=${listingType}&tipo=${item.type}`)} 
                className="group flex flex-col items-center rounded-xl border border-border bg-background p-4 md:p-6 transition-all duration-300 hover:border-primary hover:shadow-lg hover:-translate-y-1"
              >
                <div className="mb-3 p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <item.icon className="h-6 w-6 md:h-8 md:w-8 text-primary transition-transform duration-300 group-hover:scale-110" />
                </div>
                <h3 className="text-sm md:text-base font-semibold">{item.label}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground text-center hidden md:block">{item.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* TIER S: CTA Section */}
      <section className="relative py-12 md:py-16 overflow-hidden">
        <div className="absolute inset-0 gradient-hero-olive" />
        <div className="absolute inset-0 opacity-10" style={{ 
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }} />
        
        <div className="container relative z-10 text-center text-white mx-auto px-4">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-3">¿Listo para vender tu propiedad?</h2>
          <p className="text-base md:text-lg text-white/80 max-w-2xl mx-auto mb-6">
            Únete a miles de agentes que ya confían en Kentra para conectar con compradores calificados
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={() => navigate("/publicar")} className="bg-white text-primary hover:bg-white/90 px-6">
              Publicar Gratis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="ghost" onClick={() => navigate("/pricing-agente")} className="border border-white/30 text-white hover:bg-white/10 px-6">
              Ver Planes
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <Testimonials />

      {/* Newsletter Section */}
      <section className="py-12 md:py-16 bg-primary/5">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-xl md:text-2xl lg:text-3xl font-bold mb-3">Suscríbete a Nuestro Newsletter</h2>
            <p className="mb-6 text-base text-muted-foreground">
              Recibe las últimas novedades del mercado inmobiliario, consejos y propiedades destacadas
            </p>
            <div className="flex justify-center">
              <NewsletterForm />
            </div>
          </div>
        </div>
      </section>


      {/* Property Detail Sheet */}
      <PropertyDetailSheet propertyId={selectedPropertyId} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
};

export default Home;
