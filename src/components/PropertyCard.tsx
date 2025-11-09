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

  return (
    <Card className="group overflow-hidden transition-all hover:shadow-lg">
      <Link to={`/propiedad/${id}`}>
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={imageUrl || propertyPlaceholder}
            alt={title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
          <div className="absolute left-3 top-3 flex gap-2">
            <Badge 
              className={listingType === 'renta' 
                ? "bg-accent text-accent-foreground" 
                : "bg-secondary text-secondary-foreground"
              }
            >
              {listingType === 'renta' ? 'Renta' : 'Venta'}
            </Badge>
            <Badge className="bg-primary/90 text-primary-foreground">
              {type}
            </Badge>
          </div>
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

      <CardContent className="p-4">
        <Link to={`/propiedad/${id}`}>
          <p className="mb-3 text-2xl font-bold text-primary">
            {formatPrice(price)}
          </p>
          <p className="text-sm text-muted-foreground mb-2">
            {address}, {municipality}, {state}
          </p>
        </Link>
      </CardContent>

      <CardFooter className="border-t border-border p-4">
        <div className="flex w-full gap-4 text-sm text-muted-foreground">
          {bedrooms && (
            <div className="flex items-center gap-1">
              <Bed className="h-4 w-4" />
              <span>{bedrooms}</span>
            </div>
          )}
          {bathrooms && (
            <div className="flex items-center gap-1">
              <Bath className="h-4 w-4" />
              <span>{bathrooms}</span>
            </div>
          )}
          {parking && (
            <div className="flex items-center gap-1">
              <Car className="h-4 w-4" />
              <span>{parking}</span>
            </div>
          )}
          {sqft && (
            <div className="flex items-center gap-1">
              <Maximize className="h-4 w-4" />
              <span>{sqft} m²</span>
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};

export default PropertyCard;
