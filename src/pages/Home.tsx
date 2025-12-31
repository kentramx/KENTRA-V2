/// <reference types="google.maps" />
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Home as HomeIcon, Building2, TreePine, ArrowRight, SlidersHorizontal, Briefcase, Store, Warehouse, Building, Tractor, Sparkles, ChevronDown } from "lucide-react";
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
import { usePropertiesInfinite } from "@/hooks/usePropertiesInfinite";
import type { PropertySummary } from '@/types/property';
import StatsCounter from '@/components/home/StatsCounter';
import Testimonials from '@/components/home/Testimonials';
import TrustedBy from '@/components/home/TrustedBy';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Footer } from "@/components/Footer";

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

  const { data: featuredData, isLoading: isLoadingFeatured } = usePropertiesInfinite({ status: ['activa'] });
  const { data: recentData, isLoading: isLoadingRecent } = usePropertiesInfinite({ status: ['activa'] });
  
  const featuredProperties = (featuredData?.pages.flatMap(page => page.properties) || []).filter(p => p.is_featured === true) as PropertySummary[];
  const recentProperties = recentData?.pages.flatMap(page => page.properties) || [] as PropertySummary[];
  const isLoadingProperties = isLoadingFeatured || isLoadingRecent;

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
        title="Kentra - Encuentra tu Propiedad Ideal en México | Casas, Departamentos y más" 
        description="Plataforma inmobiliaria líder en México. Miles de propiedades en venta y renta: casas, departamentos, terrenos, oficinas. Contacta directamente con agentes certificados." 
        canonical="/" 
        structuredData={[generateWebsiteStructuredData(), generateOrganizationStructuredData()]} 
      />
      <Navbar />

      {/* TIER S: Hero Section - Immersive Design */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
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

        <div className="container relative z-10 text-center text-white px-4 pt-24 md:pt-32">
          {/* Trust badge - VISIBLE */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-sm font-medium mb-8 md:mb-10 animate-fade-in-up shadow-lg">
            <Sparkles className="w-4 h-4 text-amber-300" />
            Plataforma inmobiliaria #1 en México
          </div>
          
          {/* TIER S: Display heading - STRIPE STYLE - VISIBLE IMMEDIATELY */}
          <h1 
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white text-balance max-w-4xl mx-auto mb-5 md:mb-6 animate-fade-in-up drop-shadow-lg" 
            style={{ animationDelay: '100ms', letterSpacing: '-0.025em' }}
          >
            Tu próximo hogar,
            <span className="block bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">a un clic</span>
          </h1>
          
          {/* Subtitle - More visible - NO OPACITY-0 */}
          <p className="text-lg md:text-xl lg:text-2xl text-white/90 max-w-2xl mx-auto mb-10 md:mb-14 animate-fade-in-up font-medium" style={{ animationDelay: '200ms' }}>
            Miles de propiedades verificadas en todo México. Compra, vende o renta con confianza.
          </p>
          
          {/* TIER S: Glass Search Card - MUCH MORE VISIBLE - NO OPACITY-0 */}
          <div className="max-w-3xl mx-auto mb-20 md:mb-28 animate-scale-in" style={{ animationDelay: '300ms' }}>
            <div className="bg-white/30 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/30 border-2 border-white/40 p-6 md:p-8">
              {/* Listing Type Toggle - TIER S prominent */}
              <div className="inline-flex p-2 bg-black/40 rounded-2xl mb-6 backdrop-blur-sm">
                <Button 
                  type="button" 
                  variant={listingType === "venta" ? "default" : "ghost"} 
                  onClick={() => setListingType("venta")}
                  className={`px-8 py-3 rounded-xl font-bold text-base transition-all ${listingType !== "venta" ? "text-white/90 hover:text-white hover:bg-white/20" : "bg-white text-gray-900 shadow-lg"}`}
                >
                  Venta
                </Button>
                <Button 
                  type="button" 
                  variant={listingType === "renta" ? "default" : "ghost"} 
                  onClick={() => setListingType("renta")}
                  className={`px-8 py-3 rounded-xl font-bold text-base transition-all ${listingType !== "renta" ? "text-white/90 hover:text-white hover:bg-white/20" : "bg-white text-gray-900 shadow-lg"}`}
                >
                  Renta
                </Button>
              </div>

              {/* Property Type - Glass style with visible text */}
              <div className="flex justify-center mb-5">
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger className="w-full max-w-xs h-12 bg-white/30 border-2 border-white/50 text-white font-medium [&>span]:text-white rounded-xl">
                    <SelectValue placeholder="Tipo de propiedad" className="text-white" />
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
                  <Button type="button" variant="ghost" size="sm" className="mx-auto mb-5 text-white/80 hover:text-white hover:bg-white/15 font-medium">
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Más filtros
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mb-5">
                  <div className="bg-white/20 rounded-2xl p-5 space-y-4 text-left border border-white/30 backdrop-blur-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="priceMin" className="text-sm font-semibold text-white">Precio Mínimo</Label>
                        <Input id="priceMin" type="number" placeholder="$0" value={priceMin} onChange={e => setPriceMin(e.target.value)} className="h-12 bg-white/30 border-2 border-white/50 text-white placeholder:text-white/60 rounded-xl font-medium" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="priceMax" className="text-sm font-semibold text-white">Precio Máximo</Label>
                        <Input id="priceMax" type="number" placeholder="Sin límite" value={priceMax} onChange={e => setPriceMax(e.target.value)} className="h-12 bg-white/30 border-2 border-white/50 text-white placeholder:text-white/60 rounded-xl font-medium" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Select value={bedrooms} onValueChange={setBedrooms}>
                        <SelectTrigger className="h-12 bg-white/30 border-2 border-white/50 text-white [&>span]:text-white rounded-xl font-medium"><SelectValue placeholder="Recámaras" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Cualquiera</SelectItem>
                          <SelectItem value="1">1+</SelectItem>
                          <SelectItem value="2">2+</SelectItem>
                          <SelectItem value="3">3+</SelectItem>
                          <SelectItem value="4">4+</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={bathrooms} onValueChange={setBathrooms}>
                        <SelectTrigger className="h-12 bg-white/30 border-2 border-white/50 text-white [&>span]:text-white rounded-xl font-medium"><SelectValue placeholder="Baños" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Cualquiera</SelectItem>
                          <SelectItem value="1">1+</SelectItem>
                          <SelectItem value="2">2+</SelectItem>
                          <SelectItem value="3">3+</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={parking} onValueChange={setParking}>
                        <SelectTrigger className="h-12 bg-white/30 border-2 border-white/50 text-white [&>span]:text-white rounded-xl font-medium"><SelectValue placeholder="Estacionamiento" /></SelectTrigger>
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
        
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-float">
          <ChevronDown className="w-6 h-6 text-white/50" />
        </div>
      </section>

      {/* Trust Indicators */}
      <TrustedBy />

      {/* Stats Counter */}
      <StatsCounter />

      {/* TIER S: Featured Properties */}
      {featuredProperties.length > 0 && (
        <section className="py-20 md:py-28 lg:py-32 bg-background">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="decorative-line" />
              <span className="section-badge">Destacadas</span>
            </div>
            <div className="flex items-end justify-between mb-12">
              <div>
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight" style={{ letterSpacing: '-0.02em' }}>Propiedades Destacadas</h2>
                <p className="mt-3 text-lg text-muted-foreground max-w-xl">
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
                <div className="mt-10 text-center md:hidden">
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
      <section className="py-20 md:py-28 lg:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="decorative-line" />
            <span className="section-badge">Recientes</span>
          </div>
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight" style={{ letterSpacing: '-0.02em' }}>Propiedades Recientes</h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-xl">
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
              <div className="mt-10 text-center md:hidden">
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
      <section className="section-padding bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <div className="flex justify-center mb-3">
              <div className="decorative-line" />
            </div>
            <h2 className="heading-section">Explora por Tipo de Propiedad</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
                className="group flex flex-col items-center rounded-2xl border border-border bg-background p-5 md:p-8 transition-all duration-300 hover:border-primary hover:shadow-xl hover:-translate-y-2"
              >
                <div className="mb-4 p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <item.icon className="h-8 w-8 md:h-10 md:w-10 text-primary transition-transform duration-300 group-hover:scale-110" />
                </div>
                <h3 className="text-base md:text-lg font-semibold">{item.label}</h3>
                <p className="mt-1 text-xs md:text-sm text-muted-foreground text-center">{item.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* TIER S: CTA Section */}
      <section className="relative section-padding overflow-hidden">
        <div className="absolute inset-0 gradient-hero-olive" />
        <div className="absolute inset-0 opacity-10" style={{ 
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }} />
        
        <div className="container relative z-10 text-center text-white mx-auto px-4">
          <h2 className="heading-section text-white mb-4">¿Listo para vender tu propiedad?</h2>
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10">
            Únete a miles de agentes que ya confían en Kentra para conectar con compradores calificados
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" onClick={() => navigate("/publicar")} className="bg-white text-primary hover:bg-white/90 px-8">
              Publicar Gratis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="ghost" onClick={() => navigate("/pricing-agente")} className="border border-white/30 text-white hover:bg-white/10 px-8">
              Ver Planes
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <Testimonials />

      {/* Newsletter Section */}
      <section className="section-padding bg-primary/5">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="heading-section mb-4">Suscríbete a Nuestro Newsletter</h2>
            <p className="mb-8 text-lg text-muted-foreground">
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
