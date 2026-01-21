/**
 * PropertyCard TIER S - Diseño refinado con animaciones
 */

import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Star, Bed, Bath, Car, Square, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import propertyPlaceholder from "@/assets/property-placeholder.jpg";
import { useTracking } from "@/hooks/useTracking";
import { cn } from "@/lib/utils";
import { useState, useCallback, memo } from "react";
import { LazyImage } from "@/components/LazyImage";

interface PropertyCardProps {
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

const PropertyCardComponent = ({
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
}: PropertyCardProps) => {
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

  const getDisplayPrice = () => {
    if (for_sale && for_rent) {
      return (
        <div className="space-y-1">
          <div className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            {formatPrice(sale_price || price, currency)}
          </div>
          <div className="text-sm text-muted-foreground">
            Renta: {formatPrice(rent_price || 0, currency)}/mes
          </div>
        </div>
      );
    }
    if (for_sale) {
      return <div className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{formatPrice(sale_price || price, currency)}</div>;
    }
    if (for_rent) {
      return <div className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{formatPrice(rent_price || price, currency)}/mes</div>;
    }
    return <div className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{formatPrice(price, currency)}</div>;
  };

  const getTypeLabel = useCallback(() => {
    const labels: Record<string, string> = {
      casa: 'Casa',
      departamento: 'Condo',
      terreno: 'Terreno',
      oficina: 'Oficina',
      local: 'Local',
      bodega: 'Bodega',
      edificio: 'Edificio',
      rancho: 'Rancho'
    };
    return labels[type] || type;
  }, [type]);

  const getDaysOnMarket = useCallback(() => {
    if (!createdAt) return null;
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Hoy";
    if (days === 1) return "Hace 1 día";
    if (days < 7) return `Hace ${days} días`;
    if (days < 30) return `Hace ${Math.floor(days/7)} semanas`;
    return `Hace ${Math.floor(days/30)} meses`;
  }, [createdAt]);

  const isNew = useCallback(() => {
    if (!createdAt) return false;
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return days < 7;
  }, [createdAt]);

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (onCardClick) {
      e.preventDefault();
      trackGA4Event('select_item', {
        item_id: id,
        item_name: title,
        item_category: type,
        item_list_name: 'search_results',
        value: price,
        currency: 'MXN',
      });
      onCardClick(id);
    } else {
      trackGA4Event('select_item', {
        item_id: id,
        item_name: title,
        item_category: type,
        item_list_name: 'search_results',
        value: price,
        currency: 'MXN',
      });
    }
  }, [onCardClick, id, title, type, price, trackGA4Event]);

  const displayImages = images && images.length > 0 
    ? images 
    : [{ url: imageUrl || propertyPlaceholder, position: 0 }];
  
  const getImageUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    if (url.startsWith('/src/assets/')) return propertyPlaceholder;
    return url;
  };

  const handlePrevImage = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? displayImages.length - 1 : prev - 1));
  }, [displayImages.length]);

  const handleNextImage = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === displayImages.length - 1 ? 0 : prev + 1));
  }, [displayImages.length]);

  const Wrapper = onCardClick ? 'div' : Link;
  const wrapperProps = onCardClick 
    ? { onClick: handleCardClick, className: "cursor-pointer" }
    : { to: `/propiedad/${id}`, onClick: handleCardClick };

  return (
    <Card className={cn(
      "group h-full flex flex-col overflow-hidden rounded-2xl border-border/50 bg-card",
      "transition-all duration-300 ease-out",
      "hover:shadow-xl hover:-translate-y-1 hover:border-primary/20",
      isHovered && 'ring-2 ring-primary shadow-xl scale-[1.02]'
    )}>
      {/* @ts-expect-error - Wrapper component has dynamic props based on linkHref */}
      <Wrapper {...wrapperProps}>
        <div className="relative aspect-[4/3] overflow-hidden rounded-t-2xl">
          <LazyImage
            src={getImageUrl(displayImages[currentImageIndex]?.url || propertyPlaceholder)}
            alt={`${bedrooms} bd, ${bathrooms} ba - ${getTypeLabel()}`}
            className="h-full w-full transition-transform duration-500 group-hover:scale-105"
            blurDataURL={propertyPlaceholder}
          />
          
          {/* Image navigation */}
          {displayImages.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Imagen anterior"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-full h-8 w-8"
                onClick={handlePrevImage}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Siguiente imagen"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-full h-8 w-8"
                onClick={handleNextImage}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          
          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-2 z-10">
            {isFeatured && (
              <Badge className="bg-amber-500/90 hover:bg-amber-500 text-white border-0 backdrop-blur-sm">
                <Star className="w-3 h-3 mr-1 fill-current" />
                Destacada
              </Badge>
            )}
            {isNew() && (
              <Badge className="bg-accent/90 hover:bg-accent text-accent-foreground border-0 backdrop-blur-sm">
                Nuevo
              </Badge>
            )}
          </div>
          
          {/* Listing type badge */}
          <Badge className="absolute right-3 bottom-3 bg-background/90 text-foreground backdrop-blur-sm border-0 z-20">
            {getListingBadge()}
          </Badge>
          
          {/* Image indicators */}
          {displayImages.length > 1 && (
            <div className="absolute bottom-3 left-3 flex gap-1 z-20">
              {displayImages.slice(0, 5).map((_, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-colors",
                    idx === currentImageIndex ? "bg-white" : "bg-white/60"
                  )}
                />
              ))}
              {displayImages.length > 5 && (
                <span className="text-xs text-white ml-1">+{displayImages.length - 5}</span>
              )}
            </div>
          )}
          
          {/* Favorite button */}
          {onToggleFavorite && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
              className="absolute right-3 top-3 bg-background/80 hover:bg-background z-20 rounded-full h-9 w-9"
              onClick={(e) => {
                e.preventDefault();
                onToggleFavorite();
              }}
            >
              <Heart
                className={cn(
                  "h-5 w-5 transition-colors",
                  isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"
                )}
              />
            </Button>
          )}
        </div>
      {/* @ts-expect-error - Wrapper component has dynamic props based on linkHref */}
      </Wrapper>

      <CardContent className="flex-1 p-5 space-y-3">
        {/* @ts-expect-error - Wrapper component has dynamic props based on linkHref */}
        <Wrapper {...wrapperProps}>
          {/* Price - TIER S typography */}
          <div className="mb-4">
            {getDisplayPrice()}
          </div>
          
          {/* Features with icons */}
          <div className="flex items-center gap-4 text-sm mb-4">
            {bedrooms && (
              <div className="flex items-center gap-1.5">
                <Bed className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{bedrooms}</span>
              </div>
            )}
            {bathrooms && (
              <div className="flex items-center gap-1.5">
                <Bath className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{bathrooms}</span>
              </div>
            )}
            {parking && parking > 0 && (
              <div className="flex items-center gap-1.5">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{parking}</span>
              </div>
            )}
            {sqft && (
              <div className="flex items-center gap-1.5">
                <Square className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{sqft}m²</span>
              </div>
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-base line-clamp-2 mb-2 text-foreground">
            {title}
          </h3>

          {/* Location */}
          <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
            {municipality}, {state}
          </p>
          
          {/* Days on market */}
          {createdAt && (
            <p className="text-xs text-muted-foreground/70">
              {getDaysOnMarket()}
            </p>
          )}
        {/* @ts-expect-error - Wrapper component has dynamic props based on linkHref */}
        </Wrapper>
      </CardContent>
    </Card>
  );
};

const arePropsEqual = (
  prevProps: PropertyCardProps,
  nextProps: PropertyCardProps
) => {
  return (
    prevProps.id === nextProps.id &&
    prevProps.price === nextProps.price &&
    prevProps.isFavorite === nextProps.isFavorite &&
    prevProps.isHovered === nextProps.isHovered &&
    prevProps.isFeatured === nextProps.isFeatured &&
    prevProps.images?.length === nextProps.images?.length
  );
};

const PropertyCard = memo(PropertyCardComponent, arePropsEqual);

export default PropertyCard;
