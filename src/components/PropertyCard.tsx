import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Star, Bed, Bath, Car, Square, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import propertyPlaceholder from "@/assets/property-placeholder.jpg";
import { useTracking } from "@/hooks/useTracking";
import { cn } from "@/lib/utils";
import { useState } from "react";

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
}

const PropertyCard = ({
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
}: PropertyCardProps) => {
  const { toast } = useToast();
  const { trackGA4Event } = useTracking();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const formatPrice = (price: number, curr: string = currency) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getListingBadge = () => {
    if (for_sale && for_rent) return "Venta y Renta";
    if (for_sale) return "En Venta";
    if (for_rent) return "En Renta";
    return listingType === 'renta' ? "En Renta" : "En Venta";
  };

  const getDisplayPrice = () => {
    if (for_sale && for_rent) {
      return (
        <div className="space-y-1">
          <div className="text-2xl font-bold text-primary">
            {formatPrice(sale_price || price, currency)}
          </div>
          <div className="text-sm text-muted-foreground">
            Renta: {formatPrice(rent_price || 0, currency)}/mes
          </div>
        </div>
      );
    }
    if (for_sale) {
      return <div className="text-2xl font-bold text-primary">{formatPrice(sale_price || price, currency)}</div>;
    }
    if (for_rent) {
      return <div className="text-2xl font-bold text-primary">{formatPrice(rent_price || price, currency)}/mes</div>;
    }
    return <div className="text-2xl font-bold text-primary">{formatPrice(price, currency)}</div>;
  };

  const getTypeLabel = () => {
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
  };

  const getDaysOnMarket = () => {
    if (!createdAt) return null;
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Hoy";
    if (days === 1) return "Hace 1 día";
    if (days < 7) return `Hace ${days} días`;
    if (days < 30) return `Hace ${Math.floor(days/7)} semanas`;
    return `Hace ${Math.floor(days/30)} meses`;
  };

  const isNew = () => {
    if (!createdAt) return false;
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return days < 7;
  };

  const handleCardClick = () => {
    // Track selección de propiedad en GA4
    trackGA4Event('select_item', {
      item_id: id,
      item_name: title,
      item_category: type,
      item_list_name: 'search_results',
      value: price,
      currency: 'MXN',
    });
  };

  const displayImages = images && images.length > 0 
    ? images 
    : [{ url: imageUrl || propertyPlaceholder, position: 0 }];
  
  const getImageUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    if (url.startsWith('/src/assets/')) return propertyPlaceholder;
    return url;
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? displayImages.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === displayImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <Card className={cn(
      "group overflow-hidden transition-all hover:shadow-lg",
      isHovered && 'ring-2 ring-primary shadow-xl scale-[1.02]'
    )}>
      <Link to={`/propiedad/${id}`} onClick={handleCardClick}>
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={getImageUrl(displayImages[currentImageIndex]?.url || propertyPlaceholder)}
            alt={`${bedrooms} bd, ${bathrooms} ba - ${getTypeLabel()}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
          
          {/* Navegación de imágenes - Solo visible si hay más de 1 imagen */}
          {displayImages.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity z-10"
                onClick={handlePrevImage}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity z-10"
                onClick={handleNextImage}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}
          
          {/* Badge de Destacada y Nuevo */}
          <div className="absolute top-2 left-2 flex flex-wrap gap-2 z-10">
            {isFeatured && (
              <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">
                <Star className="w-3 h-3 mr-1 fill-current" />
                Destacada
              </Badge>
            )}
            {isNew() && (
              <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                Nuevo
              </Badge>
            )}
          </div>
          
          {/* Tipo de operación */}
          <Badge className="absolute right-3 bottom-3 bg-background/90 text-foreground z-20">
            {getListingBadge()}
          </Badge>
          
          {/* Indicadores de galería */}
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
          
          {onToggleFavorite && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 bg-background/80 hover:bg-background z-20"
              onClick={(e) => {
                e.preventDefault();
                onToggleFavorite();
              }}
            >
              <Heart
                className={`h-5 w-5 ${isFavorite ? "fill-red-500 text-red-500" : ""}`}
              />
            </Button>
          )}
        </div>
      </Link>

      <CardContent className="p-5 space-y-3">
        <Link to={`/propiedad/${id}`} className="block" onClick={handleCardClick}>
          {/* Precio */}
          <div className="mb-3">
            {getDisplayPrice()}
          </div>
          
          {/* Características con iconos claros */}
          <div className="flex items-center gap-4 text-sm mb-3">
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

          {/* Título y tipo */}
          <p className="font-medium line-clamp-1 mb-2">
            {getTypeLabel()} en {colonia || municipality}
          </p>

          {/* Dirección */}
          <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
            {municipality}, {state}
          </p>
          
          {/* Días en el mercado */}
          {createdAt && (
            <p className="text-xs text-muted-foreground">
              {getDaysOnMarket()}
            </p>
          )}
        </Link>
      </CardContent>
    </Card>
  );
};

export default PropertyCard;
