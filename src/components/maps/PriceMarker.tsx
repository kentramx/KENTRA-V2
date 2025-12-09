/**
 * Marcador de precio estilo Zillow
 * Píldora negra con precio en blanco
 */

import { OverlayView } from '@react-google-maps/api';
import { memo, useCallback } from 'react';
import type { PropertyMarker } from '@/types/map';
import { cn } from '@/lib/utils';

interface PriceMarkerProps {
  property: PropertyMarker;
  isSelected?: boolean;
  isHovered?: boolean;
  onClick?: (id: string) => void;
  onHover?: (property: PropertyMarker | null) => void;
}

// Formatear precio compacto
function formatPrice(price: number, currency: string): string {
  const symbol = currency === 'USD' ? 'US$' : '$';
  
  if (price >= 1_000_000) {
    const millions = price / 1_000_000;
    return `${symbol}${millions.toFixed(millions >= 10 ? 0 : 1)}M`;
  } else if (price >= 1_000) {
    const thousands = price / 1_000;
    return `${symbol}${thousands.toFixed(0)}K`;
  }
  return `${symbol}${price.toFixed(0)}`;
}

export const PriceMarker = memo(function PriceMarker({
  property,
  isSelected = false,
  isHovered = false,
  onClick,
  onHover,
}: PriceMarkerProps) {
  const handleClick = useCallback(() => {
    onClick?.(property.id);
  }, [onClick, property.id]);

  const handleMouseEnter = useCallback(() => {
    onHover?.(property);
  }, [onHover, property]);

  const handleMouseLeave = useCallback(() => {
    onHover?.(null);
  }, [onHover]);

  const priceLabel = formatPrice(property.price, property.currency);
  const isActive = isSelected || isHovered;

  return (
    <OverlayView
      position={{ lat: property.lat, lng: property.lng }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <button
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'relative -translate-x-1/2 -translate-y-1/2',
          'px-2 py-1 rounded-full',
          'text-xs font-bold whitespace-nowrap',
          'transition-all duration-150 ease-out',
          'shadow-md border-2 border-white',
          'cursor-pointer hover:scale-110',
          'focus:outline-none focus:ring-2 focus:ring-primary',
          isActive
            ? 'bg-primary text-primary-foreground scale-110 z-50'
            : 'bg-black text-white z-10'
        )}
        aria-label={`${property.title} - ${priceLabel}`}
      >
        {priceLabel}
        {/* Triángulo inferior */}
        <span 
          className={cn(
            'absolute left-1/2 -translate-x-1/2 top-full',
            'border-l-4 border-r-4 border-t-4',
            'border-l-transparent border-r-transparent',
            isActive ? 'border-t-primary' : 'border-t-black'
          )} 
        />
      </button>
    </OverlayView>
  );
});
