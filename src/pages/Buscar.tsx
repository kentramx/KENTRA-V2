import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { SearchMap } from "@/components/SearchMap";
import { SearchResultsList } from "@/components/SearchResultsList";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePropertySearch } from "@/hooks/usePropertySearch";
import type { ViewportBounds } from "@/hooks/useTiledMap";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import { buildPropertyFilters } from "@/utils/buildPropertyFilters";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  AlertCircle,
  Save,
  Star,
  Trash2,
  X,
  ChevronDown,
  SlidersHorizontal,
  Loader2,
  Map as MapIcon,
  List as ListIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { mexicoStates, mexicoMunicipalities } from "@/data/mexicoLocations";
import { useTracking } from "@/hooks/useTracking";
import { SEOHead } from "@/components/SEOHead";
import { generateSearchTitle, generateSearchDescription } from "@/utils/seo";
import { generatePropertyListStructuredData } from "@/utils/structuredData";
import { PropertyDetailSheet } from "@/components/PropertyDetailSheet";
import { InfiniteScrollContainer } from "@/components/InfiniteScrollContainer";
import { monitoring } from "@/lib/monitoring";
import type { MapProperty, HoveredProperty } from "@/types/property";
import { Card, CardContent } from "@/components/ui/card";

interface Filters {
  estado: string;
  municipio: string;
  colonia: string;
  precioMin: string;
  precioMax: string;
  tipo: string;
  listingType: string;
  recamaras: string;
  banos: string;
  orden: "price_desc" | "price_asc" | "newest" | "oldest" | "bedrooms_desc" | "sqft_desc";
}

const getTipoLabel = (tipo: string) => {
  const labels: Record<string, string> = {
    casa: "🏠 Casa",
    departamento: "🏢 Depto",
    terreno: "🌳 Terreno",
    oficina: "💼 Oficina",
    local: "🏪 Local",
    bodega: "📦 Bodega",
    edificio: "🏛️ Edificio",
    rancho: "🐎 Rancho",
  };

  // helper para comparar bounds y evitar churn/refetch infinito
  const sameBounds = (a: ViewportBounds | null, b: ViewportBounds | null) => {
    if (!a || !b) return false;
    return a.minLat === b.minLat && a.maxLat === b.maxLat && a.minLng === b.minLng && a.maxLng === b.maxLng;
  };

  return labels[tipo] || tipo;
};

const Buscar = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFiltering, setIsFiltering] = useState(false);
  const { trackGA4Event } = useTracking();

  const syncingFromUrl = useRef(false);

  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedPropertyFromMap, setSelectedPropertyFromMap] = useState<string | null>(null);

  const mapMoveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const SALE_MIN_PRICE = 0;
  const SALE_MAX_PRICE = 100;
  const RENT_MIN_PRICE = 0;
  const RENT_MAX_PRICE = 200;

  const getPriceRangeForListingType = (listingType: string): [number, number] => {
    if (listingType === "renta") {
      return [RENT_MIN_PRICE, RENT_MAX_PRICE];
    }
    return [SALE_MIN_PRICE, SALE_MAX_PRICE];
  };

  const convertSliderValueToPrice = (value: number, listingType: string): number => {
    if (listingType === "renta") {
      return value * 1000;
    }
    return value * 1000000;
  };

  const [priceRange, setPriceRange] = useState<[number, number]>([SALE_MIN_PRICE, SALE_MAX_PRICE]);
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [savedSearchQuery, setSavedSearchQuery] = useState("");
  const [savedSearchSort, setSavedSearchSort] = useState<"date" | "name">("date");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const DEFAULT_FILTERS: Filters = {
    estado: "",
    municipio: "",
    colonia: "",
    precioMin: "",
    precioMax: "",
    tipo: "",
    listingType: "",
    recamaras: "",
    banos: "",
    orden: "price_desc",
  };

  const [filters, setFilters] = useState<Filters>({
    estado: searchParams.get("estado") || "",
    municipio: searchParams.get("municipio") || "",
    colonia: searchParams.get("colonia") || "",
    precioMin: searchParams.get("precioMin") || "",
    precioMax: searchParams.get("precioMax") || "",
    tipo: searchParams.get("tipo") || "",
    listingType: searchParams.get("listingType") || "venta",
    recamaras: searchParams.get("recamaras") || "",
    banos: searchParams.get("banos") || "",
    orden: (searchParams.get("orden") as any) || "price_desc",
  });

  // 🗺️ Bounds actuales del mapa para sincronizar listado con viewport
  const [mapBounds, setMapBounds] = useState<ViewportBounds | null>(null);

  // ✅ Filtros para el MAPA (sin bounds). El mapa usa su propio viewport interno/tiles
  const mapFilters = useMemo(() => buildPropertyFilters(filters), [filters]);

  // ✅ Filtros para la LISTA (con bounds cuando existan)
  const listFilters = useMemo(() => {
    return mapBounds ? { ...mapFilters, bounds: mapBounds } : mapFilters;
  }, [mapFilters, mapBounds]);

  const {
    properties,
    isLoading: loading,
    isFetching,
    error: searchError,
    totalCount,
    hasNextPage,
    fetchNextPage,
    hasTooManyResults,
    actualTotal,
  } = usePropertySearch(listFilters);

  const sortedProperties = useMemo(() => {
    const sorted = [...properties];
    sorted.sort((a, b) => {
      const aFeatured = a.is_featured ? 1 : 0;
      const bFeatured = b.is_featured ? 1 : 0;
      if (aFeatured !== bFeatured) return bFeatured - aFeatured;

      switch (filters.orden) {
        case "price_desc":
          return b.price - a.price;
        case "price_asc":
          return a.price - b.price;
        case "newest":
          return (
            (a.created_at ? new Date(a.created_at).getTime() : 0) -
            (b.created_at ? new Date(b.created_at).getTime() : 0) * -1
          );
        case "oldest":
          return (
            (a.created_at ? new Date(a.created_at).getTime() : 0) -
            (b.created_at ? new Date(b.created_at).getTime() : 0)
          );
        case "bedrooms_desc":
          return (b.bedrooms || 0) - (a.bedrooms || 0);
        case "sqft_desc":
          return (b.sqft || 0) - (a.sqft || 0);
        default:
          return b.price - a.price;
      }
    });
    return sorted;
  }, [properties, filters.orden]);

  const filteredProperties = sortedProperties;

  const [searchCoordinates, setSearchCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  // ✅ Handler estabilizado: Solo loguea el movimiento, NO actualiza coordenadas
  // Esto rompe el loop infinito que causaba el flash y bloqueo
  // ✅ Handler estabilizado: actualiza bounds visibles para sincronizar lista con mapa
  // Debounce 500ms y evita re-render si no cambiaron bounds
  const handleMapPositionChange = useCallback((center: { lat: number; lng: number }, bounds: ViewportBounds) => {
    if (mapMoveTimerRef.current) {
      clearTimeout(mapMoveTimerRef.current);
    }
    mapMoveTimerRef.current = setTimeout(() => {
      console.log("🗺️ Mapa estabilizado en:", { center, bounds });
      setMapBounds((prev) => (sameBounds(prev, bounds) ? prev : bounds));
      // NOTA: No llamamos a setSearchCoordinates aquí para evitar re-renderizados cíclicos
    }, 500);
  }, []);

  useEffect(() => {
    const propertyId = searchParams.get("propiedad");
    if (propertyId) {
      setSelectedPropertyId(propertyId);
      setSheetOpen(true);
    } else {
      setSheetOpen(false);
      setSelectedPropertyId(null);
    }
  }, [searchParams]);

  const handlePropertyClick = useCallback(
    (id: string) => {
      setSelectedPropertyId(id);
      setSheetOpen(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.set("propiedad", id);
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleCloseSheet = () => {
    setSheetOpen(false);
    setSelectedPropertyId(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("propiedad");
    setSearchParams(newParams, { replace: true });
  };

  useEffect(() => {
    syncingFromUrl.current = true;
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    if (lat && lng) {
      setSearchCoordinates({ lat: parseFloat(lat), lng: parseFloat(lng) });
    } else {
      setSearchCoordinates(null);
    }

    const newFilters = {
      estado: searchParams.get("estado") || "",
      municipio: searchParams.get("municipio") || "",
      colonia: searchParams.get("colonia") || "",
      precioMin: searchParams.get("precioMin") || "",
      precioMax: searchParams.get("precioMax") || "",
      tipo: searchParams.get("tipo") || "",
      listingType: searchParams.get("listingType") || "venta",
      recamaras: searchParams.get("recamaras") || "",
      banos: searchParams.get("banos") || "",
      orden: (searchParams.get("orden") as any) || "price_desc",
    };

    if (JSON.stringify(newFilters) !== JSON.stringify(filters)) {
      setFilters(newFilters);
    }

    Promise.resolve().then(() => (syncingFromUrl.current = false));
  }, [searchParams]);

  const locationDisplayValue =
    filters.municipio && filters.estado ? `${filters.municipio}, ${filters.estado}` : filters.estado || "";

  const [hoveredProperty, setHoveredProperty] = useState<MapProperty | null>(null);
  const hoverFromMap = useRef(false);
  const [mobileView, setMobileView] = useState<"map" | "list">("list");
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapVisibleCount, setMapVisibleCount] = useState<number>(0);

  const [minRangeForType, maxRangeForType] = getPriceRangeForListingType(filters.listingType);
  const safePriceRange: [number, number] = [
    Math.max(minRangeForType, Math.min(priceRange[0], maxRangeForType)),
    Math.max(minRangeForType, Math.min(priceRange[1], maxRangeForType)),
  ];

  const filteredSavedSearches = savedSearches
    .filter((search) => search.name.toLowerCase().includes(savedSearchQuery.toLowerCase()))
    .sort((a, b) =>
      savedSearchSort === "name"
        ? a.name.localeCompare(b.name)
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  const handlePropertyHoverFromMap = useCallback((property: MapProperty | null) => {
    hoverFromMap.current = true;
    setHoveredProperty(property);
  }, []);

  useEffect(() => {
    const [minRange, maxRange] = getPriceRangeForListingType(filters.listingType);
    const needsReset =
      priceRange[0] < minRange || priceRange[0] > maxRange || priceRange[1] < minRange || priceRange[1] > maxRange;

    if (needsReset) {
      setPriceRange([minRange, maxRange]);
      setFilters((prev) => ({ ...prev, precioMin: "", precioMax: "" }));
    }
  }, [filters.listingType, priceRange]);

  useEffect(() => {
    if (user) fetchSavedSearches();
  }, [user]);

  const fetchSavedSearches = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("saved_searches")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSavedSearches(data || []);
    } catch (error) {
      console.error("Error fetching saved searches:", error);
    }
  };

  const handleSaveSearch = async () => {
    if (!user) return toast({ title: "Inicia sesión", description: "Debes iniciar sesión", variant: "destructive" });
    if (!searchName.trim()) return toast({ title: "Error", description: "Ingresa un nombre", variant: "destructive" });

    try {
      const { error } = await supabase
        .from("saved_searches")
        .insert([{ user_id: user.id, name: searchName, filters: filters as any }]);
      if (error) throw error;
      toast({ title: "Búsqueda guardada", description: `"${searchName}" guardada` });
      setSearchName("");
      setSaveDialogOpen(false);
      fetchSavedSearches();
    } catch (error: any) {
      toast({ title: "Error", description: "No se pudo guardar", variant: "destructive" });
    }
  };

  const handleLoadSearch = (savedFilters: any) => {
    setFilters(savedFilters);
    toast({ title: "Búsqueda cargada", description: "Filtros aplicados" });
  };

  const handleDeleteSearch = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from("saved_searches").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Eliminada", description: `"${name}" eliminada` });
      fetchSavedSearches();
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

  useEffect(() => {
    const currentListingType = filters.listingType;
    const [minRange, maxRange] = getPriceRangeForListingType(currentListingType);
    const minFromUrl = filters.precioMin
      ? parseFloat(filters.precioMin) / (currentListingType === "renta" ? 1000 : 1000000)
      : minRange;
    const maxFromUrl = filters.precioMax
      ? parseFloat(filters.precioMax) / (currentListingType === "renta" ? 1000 : 1000000)
      : maxRange;
    setPriceRange([minFromUrl, maxFromUrl]);
  }, []);

  const handlePriceRangeChange = (values: number[]) => {
    setPriceRange(values as [number, number]);
    const [minRange, maxRange] = getPriceRangeForListingType(filters.listingType);
    setFilters((prev) => ({
      ...prev,
      precioMin: values[0] === minRange ? "" : convertSliderValueToPrice(values[0], prev.listingType).toString(),
      precioMax: values[1] === maxRange ? "" : convertSliderValueToPrice(values[1], prev.listingType).toString(),
    }));
  };

  const formatPriceDisplay = (value: number, listingType?: string) => {
    const currentListingType = listingType || filters.listingType;
    const [minRange, maxRange] = getPriceRangeForListingType(currentListingType);
    if (value === 0 || value === minRange) return "$0";
    if (value === maxRange) return "Sin límite";

    if (currentListingType === "renta") {
      return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value * 1000);
    } else {
      return value >= 1
        ? `$${value.toFixed(1)}M`
        : new Intl.NumberFormat("es-MX", {
            style: "currency",
            currency: "MXN",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(value * 1000000);
    }
  };

  useEffect(() => {
    if (syncingFromUrl.current) return;
    const params = new URLSearchParams();
    if (filters.estado) params.set("estado", filters.estado);
    if (filters.municipio) params.set("municipio", filters.municipio);
    if (filters.colonia) params.set("colonia", filters.colonia);
    if (filters.precioMin) params.set("precioMin", filters.precioMin);
    if (filters.precioMax) params.set("precioMax", filters.precioMax);
    if (filters.tipo) params.set("tipo", filters.tipo);
    params.set("listingType", filters.listingType || "venta");
    if (filters.recamaras) params.set("recamaras", filters.recamaras);
    if (filters.banos) params.set("banos", filters.banos);
    if (filters.orden !== "price_desc") params.set("orden", filters.orden);

    if (searchCoordinates) {
      params.set("lat", searchCoordinates.lat.toString());
      params.set("lng", searchCoordinates.lng.toString());
    }

    const propiedad = searchParams.get("propiedad");
    if (propiedad) params.set("propiedad", propiedad);

    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) setSearchParams(params, { replace: true });
  }, [filters, searchCoordinates]);

  const removeFilter = (filterKey: keyof Filters) => {
    setFilters((prev) => ({ ...prev, [filterKey]: filterKey === "orden" ? "price_desc" : "" }));
  };

  const getActiveFilterChips = () => {
    const chips: Array<{ key: string; label: string; removeFilter: () => void }> = [];
    if (filters.estado)
      chips.push({ key: "estado", label: `Estado: ${filters.estado}`, removeFilter: () => removeFilter("estado") });
    if (filters.municipio)
      chips.push({
        key: "municipio",
        label: `Municipio: ${filters.municipio}`,
        removeFilter: () => removeFilter("municipio"),
      });
    if (filters.colonia)
      chips.push({ key: "colonia", label: `Colonia: ${filters.colonia}`, removeFilter: () => removeFilter("colonia") });
    if (filters.tipo)
      chips.push({ key: "tipo", label: getTipoLabel(filters.tipo), removeFilter: () => removeFilter("tipo") });
    return chips;
  };

  const activeFiltersCount = [
    filters.precioMin,
    filters.precioMax,
    filters.tipo,
    filters.listingType,
    filters.recamaras,
    filters.banos,
  ].filter(Boolean).length;

  useEffect(() => {
    setIsFiltering(isFetching && properties.length === 0);
  }, [isFetching, properties.length]);

  const handlePropertyHoverFromList = useCallback((property: HoveredProperty | null) => {
    hoverFromMap.current = false;
    if (property && property.lat && property.lng) {
      setHoveredProperty({
        id: property.id,
        title: property.title,
        price: property.price,
        currency: property.currency,
        lat: property.lat,
        lng: property.lng,
      } as MapProperty);
    } else {
      setHoveredProperty(null);
    }
  }, []);

  const hoveredPropertyCoords = useMemo(
    () =>
      hoveredProperty?.lat && hoveredProperty?.lng ? { lat: hoveredProperty.lat, lng: hoveredProperty.lng } : null,
    [hoveredProperty?.lat, hoveredProperty?.lng],
  );

  const handleMarkerClick = useCallback(
    (propertyId: string) => {
      monitoring.debug("[Buscar] Click en marcador", { propertyId });
      setSelectedPropertyFromMap(propertyId);
      handlePropertyClick(propertyId);
      setTimeout(() => setSelectedPropertyFromMap(null), 3000);
    },
    [handlePropertyClick],
  );

  const handleSearchInputChange = (value: string) => {
    if (!value || value.trim() === "") {
      setFilters((prev) => {
        if (!prev.estado && !prev.municipio) return prev;
        return { ...prev, estado: "", municipio: "" };
      });
      setSearchCoordinates(null);
    }
  };

  const handlePlaceSelect = (location: any) => {
    setFilters((prev) => ({
      ...prev,
      estado: location.state || "",
      municipio: location.municipality || "",
      colonia: location.colonia || "",
    }));
    if (location.lat && location.lng) {
      setSearchCoordinates({ lat: location.lat, lng: location.lng });
    }
    toast({ title: "Ubicación seleccionada", description: `${location.municipality}, ${location.state}` });
  };

  const seoTitle = generateSearchTitle(filters);
  const seoDescription = generateSearchDescription({ ...filters, resultCount: filteredProperties.length });
  const listStructuredData = generatePropertyListStructuredData(
    filteredProperties.slice(0, 10).map((p) => ({
      id: p.id,
      title: p.title,
      price: p.price,
      url: `${window.location.origin}/property/${p.id}`,
      image: p.images?.[0]?.url,
    })),
    filters.municipio || filters.estado || "Propiedades en México",
  );

  const handleOrdenChange = (value: string) => setFilters((prev) => ({ ...prev, orden: value as Filters["orden"] }));
  const handleSavedSearchSortChange = (value: string) => setSavedSearchSort(value as "date" | "name");

  if (loading && !properties.length) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-screen gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando propiedades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={seoTitle} description={seoDescription} canonical="/buscar" structuredData={listStructuredData} />
      <Navbar />

      <div className="pt-16">
        {/* Barra Superior */}
        <div className="border-b bg-background sticky top-16 z-30">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="min-w-[240px] flex-1 lg:flex-initial relative">
                <PlaceAutocomplete
                  onPlaceSelect={handlePlaceSelect}
                  onInputChange={handleSearchInputChange}
                  placeholder="Ciudad, código postal..."
                  defaultValue={locationDisplayValue}
                  showIcon={true}
                  label=""
                />
                {locationDisplayValue && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 z-20"
                    onClick={() => {
                      setFilters(DEFAULT_FILTERS);
                      setSearchCoordinates(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Separator orientation="vertical" className="h-8 hidden lg:block" />
              {/* Botón Filtros Móvil */}
              <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden">
                    <SlidersHorizontal className="h-4 w-4 mr-2" />
                    Filtros
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[90vh]">
                  <SheetTitle>Filtros</SheetTitle>
                  {/* Contenido Sheet (Simplificado) */}
                  <ScrollArea className="h-[calc(90vh-120px)] mt-4">
                    <div className="p-4">
                      <p>Opciones de filtro aquí...</p>
                    </div>
                  </ScrollArea>
                </SheetContent>
              </Sheet>
              {/* Filtros Desktop */}
              <div className="hidden lg:flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      {filters.tipo ? getTipoLabel(filters.tipo) : "Tipo"} <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96" align="start">
                    <div className="grid grid-cols-3 gap-2">
                      {["casa", "departamento", "terreno", "oficina", "local"].map((t) => (
                        <Button key={t} variant="ghost" onClick={() => setFilters((p) => ({ ...p, tipo: t }))}>
                          {t}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                {/* Más popovers de filtros... */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      Precio <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="p-4">
                      <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={safePriceRange}
                        onValueChange={handlePriceRangeChange}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </div>

        {/* Layout Mapa/Lista */}
        <div className="flex flex-col lg:flex-row lg:h-full" style={{ height: "calc(100vh - 140px)" }}>
          {/* Toggle Móvil */}
          <div className="lg:hidden sticky top-0 z-20 bg-background border-b p-2">
            <div className="flex gap-2">
              <Button
                variant={mobileView === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setMobileView("list")}
                className="flex-1"
              >
                <ListIcon className="h-4 w-4 mr-2" /> Lista
              </Button>
              <Button
                variant={mobileView === "map" ? "default" : "outline"}
                size="sm"
                onClick={() => setMobileView("map")}
                className="flex-1"
              >
                <MapIcon className="h-4 w-4 mr-2" /> Mapa
              </Button>
            </div>
          </div>

          {/* Mapa */}
          <div
            className={`relative ${mobileView === "map" ? "block" : "hidden"} lg:block lg:w-1/2 lg:h-full`}
            style={{ height: "calc(100vh - 140px)" }}
          >
            <div className="absolute top-4 left-4 z-10 bg-background/95 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg border">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">
                  {mobileView === "map" || window.innerWidth >= 1024 ? mapVisibleCount : totalCount}
                </span>
                <span className="text-muted-foreground text-sm">propiedades en mapa</span>
              </div>
            </div>

            {mapError ? (
              <div className="flex h-full items-center justify-center p-8">
                <p>Error en el mapa</p>
              </div>
            ) : (
              <SearchMap
                filters={mapFilters}
                searchCoordinates={searchCoordinates}
                onMarkerClick={handleMarkerClick}
                onPropertyHover={handlePropertyHoverFromMap}
                hoveredPropertyId={hoveredProperty?.id || null}
                hoveredPropertyCoords={hoveredPropertyCoords}
                height="100%"
                onMapError={setMapError}
                onVisibleCountChange={setMapVisibleCount}
                // ✅ CONECTADO: Actualizar lista al mover mapa
                onMapPositionChange={handleMapPositionChange}
              />
            )}
          </div>

          {/* Lista */}
          <div className={`w-full lg:w-1/2 overflow-y-auto ${mobileView === "list" ? "block" : "hidden"} lg:block`}>
            {!searchError && filteredProperties.length > 0 && (
              <InfiniteScrollContainer
                onLoadMore={() => {
                  if (hasNextPage && !isFetching) fetchNextPage();
                }}
                hasMore={!!hasNextPage}
                isLoading={isFetching}
                className="space-y-4"
              >
                <div className="px-4 py-2 text-sm text-muted-foreground">
                  Mostrando {properties.length} resultados en esta zona
                </div>
                <SearchResultsList
                  properties={filteredProperties}
                  isLoading={loading && properties.length === 0}
                  listingType={filters.listingType}
                  onPropertyClick={handlePropertyClick}
                  onPropertyHover={handlePropertyHoverFromList}
                  savedSearchesCount={user ? savedSearches.length : 0}
                  highlightedPropertyId={selectedPropertyFromMap}
                  scrollToPropertyId={selectedPropertyFromMap}
                  hoveredPropertyId={hoveredProperty?.id || null}
                />
              </InfiniteScrollContainer>
            )}
            {/* Estado vacío */}
            {!searchError && !loading && filteredProperties.length === 0 && (
              <div className="flex flex-col items-center justify-center p-12 space-y-4 text-center min-h-[400px]">
                <div className="rounded-full bg-muted p-6">
                  <Star className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3>No encontramos propiedades en esta zona</h3>
                <Button
                  onClick={() => {
                    setFilters(DEFAULT_FILTERS);
                    setSearchCoordinates(null);
                  }}
                >
                  Ver todas las zonas
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <PropertyDetailSheet propertyId={selectedPropertyId} open={sheetOpen} onClose={handleCloseSheet} />
    </div>
  );
};

export default Buscar;
