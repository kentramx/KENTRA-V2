/**
 * PropertyCard Optimizado con React.memo
 * - Memoización profunda
 * - Lazy loading de imágenes
 * - Eventos optimizados
 */

import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Star, Bed, Bath, Car, Square, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import propertyPlaceholder from "@/assets/property-placeholder.jpg";
import { useTracking } from "@/hooks/useTracking";
import { cn } from "@/lib/utils";
import { useState, useCallback, memo } from "react";
import { LazyImage } from "@/components/LazyImage";

interface PropertyCardOptimizedProps {
  id: string;
  title: string;
  price: number;
  type: string;
  listingType?: string;
  for_sale?: boolean;
  for_rent?: boolean;
  sale_price?: number | null;
  rent_price?: number | null;
  currency?: string;
  address: string;
  colonia?: string;
  municipality: string;
  state: string;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  sqft?: number;
  imageUrl?: string;
  images?: { url: string; position: number }[];
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  isHovered?: boolean;
  agentId: string;
  isFeatured?: boolean;
  createdAt?: string;
  onCardClick?: (id: string) => void;
}

const PropertyCardOptimizedComponent = ({
  id,
  title,
  price,
  type,
  listingType = 'venta',
  for_sale = false,
  for_rent = false,
  sale_price,
  rent_price,
  currency = 'MXN',
  address,
  colonia,
  municipality,
  state,
  bedrooms,
  bathrooms,
  parking,
  sqft,
  imageUrl,
  images,
  isFavorite = false,
  onToggleFavorite,
  isHovered = false,
  agentId,
  isFeatured = false,
  createdAt,
  onCardClick,
}: PropertyCardOptimizedProps) => {
  const { toast } = useToast();
  const { trackGA4Event } = useTracking();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const formatPrice = useCallback((price: number, curr: string = currency) => {
    const formatted = new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: 0,
    }).format(price);
    
    return curr === 'USD' ? `${formatted} USD` : formatted;
  }, [currency]);

  const getListingBadge = useCallback(() => {
    if (for_sale && for_rent) return "Venta y Renta";
    if (for_sale) return "En Venta";
    if (for_rent) return "En Renta";
    return listingType === 'renta' ? "En Renta" : "En Venta";
  }, [for_sale, for_rent, listingType]);

  const handlePreviousImage = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? (images?.length || 1) - 1 : prev - 1));
  }, [images?.length]);

  const handleNextImage = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === (images?.length || 1) - 1 ? 0 : prev + 1));
  }, [images?.length]);

  const handleCardClick = useCallback(() => {
    trackGA4Event('ViewContent' as any, {
      property_id: id,
      property_type: type,
      listing_type: listingType,
      price: price,
    });
    onCardClick?.(id);
  }, [id, type, listingType, price, trackGA4Event, onCardClick]);

  const handleFavoriteClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!onToggleFavorite) {
      toast({
        title: "Inicia sesión",
        description: "Debes iniciar sesión para guardar favoritos",
        variant: "destructive",
      });
      return;
    }

    onToggleFavorite();
    trackGA4Event((isFavorite ? 'RemoveFromCart' : 'AddToCart') as any, {
      property_id: id,
    });
  }, [onToggleFavorite, isFavorite, id, toast, trackGA4Event]);

  const currentImage = images && images.length > 0 
    ? images[currentImageIndex]?.url 
    : imageUrl || propertyPlaceholder;

  const hasMultipleImages = images && images.length > 1;

  return (
    <Card
      className={cn(
        "group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-2xl h-full",
        isHovered && "ring-2 ring-primary shadow-2xl scale-105 z-10"
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-0">
        {/* Imagen con navegación */}
        <div className="relative h-56 overflow-hidden">
          <LazyImage
            src={currentImage}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
          />

          {/* Badges superiores */}
          <div className="absolute top-2 left-2 flex gap-2 flex-wrap">
            <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm">
              {getListingBadge()}
            </Badge>
            {isFeatured && (
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0">
                <Star className="h-3 w-3 mr-1" />
                Destacada
              </Badge>
            )}
          </div>

          {/* Botón de favoritos */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 bg-background/90 backdrop-blur-sm hover:bg-background"
            onClick={handleFavoriteClick}
            aria-label="Toggle favorite"
          >
            <Heart
              className={cn("h-5 w-5", isFavorite && "fill-red-500 text-red-500")}
            />
          </Button>

          {/* Controles de navegación de imágenes */}
          {hasMultipleImages && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/70 backdrop-blur-sm hover:bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handlePreviousImage}
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/70 backdrop-blur-sm hover:bg-background/90 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleNextImage}
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {images?.map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "h-1 w-1 rounded-full transition-all",
                      index === currentImageIndex
                        ? "bg-white w-6"
                        : "bg-white/50"
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Información de la propiedad */}
        <div className="p-4 space-y-3">
          {/* Precio */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {for_sale && for_rent ? (
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-primary">
                    {formatPrice(sale_price || price, currency)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Renta: {formatPrice(rent_price || price, currency)}/mes
                  </div>
                </div>
              ) : (
                <div className="text-2xl font-bold text-primary">
                  {formatPrice(price, currency)}
                  {for_rent && <span className="text-sm text-muted-foreground">/mes</span>}
                </div>
              )}
            </div>
            <Badge variant="outline" className="shrink-0">
              {type}
            </Badge>
          </div>

          {/* Título */}
          <h3 className="font-semibold text-lg line-clamp-2 min-h-[3.5rem]">
            {title}
          </h3>

          {/* Ubicación */}
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="line-clamp-2">
              {address}, {municipality}, {state}
            </span>
          </div>

          {/* Características */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
            {bedrooms !== null && bedrooms !== undefined && (
              <div className="flex items-center gap-1">
                <Bed className="h-4 w-4" />
                <span>{bedrooms}</span>
              </div>
            )}
            {bathrooms !== null && bathrooms !== undefined && (
              <div className="flex items-center gap-1">
                <Bath className="h-4 w-4" />
                <span>{bathrooms}</span>
              </div>
            )}
            {parking !== null && parking !== undefined && parking > 0 && (
              <div className="flex items-center gap-1">
                <Car className="h-4 w-4" />
                <span>{parking}</span>
              </div>
            )}
            {sqft && (
              <div className="flex items-center gap-1">
                <Square className="h-4 w-4" />
                <span>{sqft.toLocaleString()} m²</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Función de comparación personalizada para memo
const arePropsEqual = (
  prevProps: PropertyCardOptimizedProps,
  nextProps: PropertyCardOptimizedProps
) => {
  // Comparar props primitivas
  if (
    prevProps.id !== nextProps.id ||
    prevProps.title !== nextProps.title ||
    prevProps.price !== nextProps.price ||
    prevProps.isFavorite !== nextProps.isFavorite ||
    prevProps.isHovered !== nextProps.isHovered ||
    prevProps.isFeatured !== nextProps.isFeatured
  ) {
    return false;
  }

  // Comparar arrays de imágenes
  if (prevProps.images?.length !== nextProps.images?.length) {
    return false;
  }

  return true;
};

// Exportar componente memoizado
export const PropertyCardOptimized = memo(PropertyCardOptimizedComponent, arePropsEqual);

export default PropertyCardOptimized;
