import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePropertyCompare } from "@/hooks/usePropertyCompare";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  X,
  Bed,
  Bath,
  Car,
  Maximize,
  MapPin,
  DollarSign,
  Home,
  Ruler,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import propertyPlaceholder from "@/assets/property-placeholder.jpg";

const ComparePage = () => {
  const { compareList, removeFromCompare, clearCompare } = usePropertyCompare();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProperties();
  }, [compareList]);

  const fetchProperties = async () => {
    if (compareList.length === 0) {
      setProperties([]);
      setLoading(false);
      return;
    }

    // Limit to max 10 properties to compare (Postgres IN clause limit)
    const limitedList = compareList.slice(0, 10);
    if (compareList.length > 10) {
      toast.error("Máximo 10 propiedades para comparar");
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("properties")
        .select(`
          id, title, price, currency, address, state, municipality,
          bedrooms, bathrooms, parking, sqft, type, listing_type,
          images (url)
        `)
        .in("id", limitedList);

      if (error) throw error;

      // Sort by compareList order
      const sortedData = compareList
        .map((id) => data?.find((p) => p.id === id))
        .filter(Boolean);

      setProperties(sortedData);
    } catch (error) {
      console.error("Error fetching properties:", error);
      toast.error("Error al cargar las propiedades");
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleRemove = (propertyId: string) => {
    removeFromCompare(propertyId);
  };

  const handleClearAll = () => {
    clearCompare();
    toast.success("Comparación limpiada");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-96 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>

          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Home className="h-24 w-24 text-muted-foreground mb-6" />
            <h1 className="text-3xl font-bold mb-4">No hay propiedades para comparar</h1>
            <p className="text-muted-foreground text-center mb-8 max-w-md">
              Agrega propiedades al comparador haciendo clic en el icono de comparación en las fichas de propiedades
            </p>
            <Link to="/buscar">
              <Button>Buscar Propiedades</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(-1)} className="h-11">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Comparar Propiedades</h1>
              <p className="text-muted-foreground text-sm md:text-base">
                Comparando {properties.length} {properties.length === 1 ? "propiedad" : "propiedades"}
              </p>
            </div>
          </div>
          {properties.length > 0 && (
            <Button variant="outline" onClick={handleClearAll}>
              Limpiar Todo
            </Button>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="p-4 text-left font-semibold sticky left-0 bg-background z-10 min-w-[200px]">
                  Característica
                </th>
                {properties.map((property) => (
                  <th key={property.id} className="p-4 min-w-[280px]">
                    <Card className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 z-10 h-8 w-8 bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleRemove(property.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <CardContent className="p-4">
                        <div className="aspect-video mb-3 overflow-hidden rounded-lg">
                          <img
                            src={property.images?.[0]?.url || propertyPlaceholder}
                            alt={property.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <h3 className="font-semibold text-left mb-2 line-clamp-2">
                          {property.title}
                        </h3>
                        <Link to={`/propiedad/${property.id}`}>
                          <Button variant="outline" size="sm" className="w-full">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Ver Detalles
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Price */}
              <tr className="border-b hover:bg-muted/50">
                <td className="p-4 font-medium sticky left-0 bg-background">
                  <DollarSign className="h-5 w-5 inline mr-2 text-primary" />
                  Precio
                </td>
                {properties.map((property) => (
                  <td key={property.id} className="p-4 text-center">
                    <p className="text-xl font-bold text-primary">
                      {formatPrice(property.price)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {property.listing_type === "venta" ? "Venta" : "Renta mensual"}
                    </p>
                  </td>
                ))}
              </tr>

              {/* Property Type */}
              <tr className="border-b hover:bg-muted/50">
                <td className="p-4 font-medium sticky left-0 bg-background">
                  <Home className="h-5 w-5 inline mr-2 text-primary" />
                  Tipo
                </td>
                {properties.map((property) => (
                  <td key={property.id} className="p-4 text-center">
                    <Badge>{property.type}</Badge>
                  </td>
                ))}
              </tr>

              {/* Location */}
              <tr className="border-b hover:bg-muted/50">
                <td className="p-4 font-medium sticky left-0 bg-background">
                  <MapPin className="h-5 w-5 inline mr-2 text-primary" />
                  Ubicación
                </td>
                {properties.map((property) => (
                  <td key={property.id} className="p-4 text-center text-sm">
                    {property.municipality}, {property.state}
                  </td>
                ))}
              </tr>

              {/* Bedrooms */}
              <tr className="border-b hover:bg-muted/50">
                <td className="p-4 font-medium sticky left-0 bg-background">
                  <Bed className="h-5 w-5 inline mr-2 text-primary" />
                  Recámaras
                </td>
                {properties.map((property) => (
                  <td key={property.id} className="p-4 text-center">
                    {property.bedrooms ? (
                      <span className="font-semibold">{property.bedrooms}</span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Bathrooms */}
              <tr className="border-b hover:bg-muted/50">
                <td className="p-4 font-medium sticky left-0 bg-background">
                  <Bath className="h-5 w-5 inline mr-2 text-primary" />
                  Baños
                </td>
                {properties.map((property) => (
                  <td key={property.id} className="p-4 text-center">
                    {property.bathrooms ? (
                      <span className="font-semibold">{property.bathrooms}</span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Parking */}
              <tr className="border-b hover:bg-muted/50">
                <td className="p-4 font-medium sticky left-0 bg-background">
                  <Car className="h-5 w-5 inline mr-2 text-primary" />
                  Estacionamiento
                </td>
                {properties.map((property) => (
                  <td key={property.id} className="p-4 text-center">
                    {property.parking ? (
                      <span className="font-semibold">{property.parking}</span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Square Feet */}
              <tr className="border-b hover:bg-muted/50">
                <td className="p-4 font-medium sticky left-0 bg-background">
                  <Maximize className="h-5 w-5 inline mr-2 text-primary" />
                  m² Construidos
                </td>
                {properties.map((property) => (
                  <td key={property.id} className="p-4 text-center">
                    {property.sqft ? (
                      <span className="font-semibold">{property.sqft} m²</span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Lot Size */}
              <tr className="border-b hover:bg-muted/50">
                <td className="p-4 font-medium sticky left-0 bg-background">
                  <Ruler className="h-5 w-5 inline mr-2 text-primary" />
                  m² Terreno
                </td>
                {properties.map((property) => (
                  <td key={property.id} className="p-4 text-center">
                    {property.lot_size ? (
                      <span className="font-semibold">{property.lot_size} m²</span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Price per sqft */}
              <tr className="border-b hover:bg-muted/50">
                <td className="p-4 font-medium sticky left-0 bg-background">
                  <DollarSign className="h-5 w-5 inline mr-2 text-primary" />
                  Precio por m²
                </td>
                {properties.map((property) => (
                  <td key={property.id} className="p-4 text-center">
                    {property.sqft ? (
                      <span className="font-semibold">
                        {formatPrice(property.price / property.sqft)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Amenities */}
              <tr className="border-b hover:bg-muted/50">
                <td className="p-4 font-medium sticky left-0 bg-background align-top">
                  <CheckCircle2 className="h-5 w-5 inline mr-2 text-primary" />
                  Amenidades
                </td>
                {properties.map((property) => (
                  <td key={property.id} className="p-4">
                    {property.amenities && property.amenities.length > 0 ? (
                      <div className="space-y-3 text-left">
                        {property.amenities.map((amenity: any, idx: number) => (
                          <div key={idx}>
                            <p className="font-semibold text-xs text-muted-foreground mb-1">
                              {amenity.category}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {amenity.items.slice(0, 3).map((item: string, itemIdx: number) => (
                                <Badge key={itemIdx} variant="secondary" className="text-xs">
                                  {item}
                                </Badge>
                              ))}
                              {amenity.items.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{amenity.items.length - 3}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-center block">
                        Sin amenidades
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-6">
          {properties.map((property) => (
            <Card key={property.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <Link to={`/propiedad/${property.id}`} className="flex-1">
                    <div className="flex gap-4">
                      <img
                        src={property.images?.[0]?.url || propertyPlaceholder}
                        alt={property.title}
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1 line-clamp-2">{property.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {property.municipality}, {property.state}
                        </p>
                      </div>
                    </div>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(property.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Precio</span>
                    <span className="font-bold text-primary">{formatPrice(property.price)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Tipo</span>
                    <Badge>{property.type}</Badge>
                  </div>

                  {property.bedrooms && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Recámaras</span>
                      <span className="font-semibold">{property.bedrooms}</span>
                    </div>
                  )}

                  {property.bathrooms && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Baños</span>
                      <span className="font-semibold">{property.bathrooms}</span>
                    </div>
                  )}

                  {property.sqft && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">m² Construidos</span>
                      <span className="font-semibold">{property.sqft} m²</span>
                    </div>
                  )}
                </div>

                <Link to={`/propiedad/${property.id}`}>
                  <Button variant="outline" className="w-full mt-4">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver Detalles
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ComparePage;
