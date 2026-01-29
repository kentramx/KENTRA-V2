/**
 * SearchPropertyCard - Compact property card for the search list
 */

import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bed, Bath, Maximize2, MapPin, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ListProperty } from '@/types/map';
import { getPropertyTypeLabel } from '@/config/propertyTypes';
import propertyPlaceholder from '@/assets/property-placeholder.jpg';

interface SearchPropertyCardProps {
  property: ListProperty;
  isSelected?: boolean;
  isHovered?: boolean;
  onSelect?: () => void;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}

function formatPrice(price: number, currency: string): string {
  if (currency === 'USD') {
    if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M USD`;
    if (price >= 1000) return `$${Math.round(price / 1000)}K USD`;
    return `$${price.toLocaleString()} USD`;
  }
  if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
  if (price >= 1000) return `$${Math.round(price / 1000)}K`;
  return `$${price.toLocaleString()}`;
}

export const SearchPropertyCard = memo(function SearchPropertyCard({
  property,
  isSelected = false,
  isHovered = false,
  onSelect,
  onHoverStart,
  onHoverEnd
}: SearchPropertyCardProps) {
  const isRent = property.listing_type === 'renta';

  return (
    <Link to={`/propiedad/${property.id}`}>
      <Card
        className={cn(
          "overflow-hidden transition-all duration-200 cursor-pointer",
          isSelected && "ring-2 ring-primary shadow-lg",
          isHovered && !isSelected && "shadow-md -translate-y-0.5",
          !isSelected && !isHovered && "hover:shadow-md hover:-translate-y-0.5"
        )}
        onClick={(e) => {
          e.preventDefault();
          onSelect?.();
        }}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
      >
        <div className="flex gap-3 p-3">
          <div className="relative w-28 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
            <img
              src={property.image_url || propertyPlaceholder}
              alt={property.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {property.is_featured && (
              <div className="absolute top-1 left-1">
                <Badge variant="secondary" className="h-5 px-1.5 bg-primary text-primary-foreground text-[10px]">
                  <Star className="h-3 w-3 mr-0.5" />
                  Destacada
                </Badge>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="font-bold text-base">
                {formatPrice(property.price, property.currency)}
                {isRent && <span className="font-normal text-muted-foreground text-sm">/mes</span>}
              </div>
              <Badge variant={isRent ? "secondary" : "default"} className="text-[10px] h-5 flex-shrink-0">
                {isRent ? 'Renta' : 'Venta'}
              </Badge>
            </div>

            <h3 className="text-sm font-medium line-clamp-1 mb-1">{property.title}</h3>

            <div className="flex items-center text-xs text-muted-foreground mb-2">
              <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="truncate">{property.municipality}, {property.state}</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {property.bedrooms !== null && (
                <span className="flex items-center gap-1"><Bed className="h-3 w-3" />{property.bedrooms}</span>
              )}
              {property.bathrooms !== null && (
                <span className="flex items-center gap-1"><Bath className="h-3 w-3" />{property.bathrooms}</span>
              )}
              {property.sqft !== null && (
                <span className="flex items-center gap-1"><Maximize2 className="h-3 w-3" />{property.sqft} m²</span>
              )}
              <span className="text-[10px] uppercase tracking-wide">{getPropertyTypeLabel(property.type)}</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
});
