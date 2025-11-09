import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Bed, Bath, Car, Maximize } from "lucide-react";
import propertyPlaceholder from "@/assets/property-placeholder.jpg";

interface PropertyCardProps {
  id: string;
  title: string;
  price: number;
  type: string;
  listingType?: string;
  address: string;
  municipality: string;
  state: string;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  sqft?: number;
  imageUrl?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

const PropertyCard = ({
  id,
  title,
  price,
  type,
  listingType = 'venta',
  address,
  municipality,
  state,
  bedrooms,
  bathrooms,
  parking,
  sqft,
  imageUrl,
  isFavorite = false,
  onToggleFavorite,
}: PropertyCardProps) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
    }).format(price);
  };

  // Get property type label
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

  return (
    <Card className="group overflow-hidden transition-all hover:shadow-lg">
      <Link to={`/propiedad/${id}`}>
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={imageUrl || propertyPlaceholder}
            alt={`${bedrooms} bd, ${bathrooms} ba - ${getTypeLabel()}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
          {onToggleFavorite && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 bg-background/80 hover:bg-background"
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

      <CardContent className="p-4 space-y-2">
        <Link to={`/propiedad/${id}`} className="block">
          <p className="text-2xl font-bold text-foreground mb-1">
            {formatPrice(price)}
          </p>
          
          {/* Zillow-style characteristics */}
          <p className="text-sm text-muted-foreground">
            {bedrooms && <span className="font-medium">{bedrooms} bd</span>}
            {bedrooms && bathrooms && <span className="mx-1.5">|</span>}
            {bathrooms && <span className="font-medium">{bathrooms} ba</span>}
            {(bedrooms || bathrooms) && sqft && <span className="mx-1.5">|</span>}
            {sqft && <span className="font-medium">{sqft} m²</span>}
            {(bedrooms || bathrooms || sqft) && <span className="mx-1.5">-</span>}
            <span className="font-medium">{getTypeLabel()}</span>
            <span> {listingType === 'renta' ? 'en renta' : 'en venta'}</span>
          </p>

          <p className="text-sm text-muted-foreground line-clamp-1">
            {address}, {municipality}, {state}
          </p>
        </Link>
      </CardContent>
    </Card>
  );
};

export default PropertyCard;
