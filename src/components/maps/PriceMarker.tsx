/**
 * KENTRA MAP STACK - OFICIAL
 * Marcador de precio estilo Zillow
 */

import { memo, useCallback } from 'react';
import { OverlayView, OverlayViewF } from '@react-google-maps/api';
import { PropertyMarker } from '@/types/map';

interface PriceMarkerProps {
  property: PropertyMarker;
  isSelected?: boolean;
  isHovered?: boolean;
  onClick?: (id: string) => void;
  onHover?: (id: string | null) => void;
}

const formatPrice = (price: number): string => {
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(1)}M`;
  }
  if (price >= 1000) {
    return `$${Math.round(price / 1000)}K`;
  }
  return `$${price.toLocaleString()}`;
};

function PriceMarkerComponent({
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
    onHover?.(property.id);
  }, [onHover, property.id]);

  const handleMouseLeave = useCallback(() => {
    onHover?.(null);
  }, [onHover]);

  const position = { lat: property.lat, lng: property.lng };

  return (
    <OverlayViewF
      position={position}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`
          px-2 py-1 rounded-lg text-xs font-bold cursor-pointer
          shadow-lg border-2 transition-all duration-150
          transform -translate-x-1/2 -translate-y-1/2
          whitespace-nowrap select-none
          ${isSelected 
            ? 'bg-primary text-primary-foreground border-primary scale-110 z-50' 
            : isHovered 
              ? 'bg-primary text-primary-foreground border-primary scale-105 z-40'
              : 'bg-background text-foreground border-border hover:border-primary hover:scale-105 z-10'
          }
        `}
        style={{ 
          minWidth: '50px', 
          textAlign: 'center',
          boxShadow: isSelected || isHovered 
            ? '0 4px 12px rgba(0,0,0,0.3)' 
            : '0 2px 6px rgba(0,0,0,0.15)'
        }}
      >
        {formatPrice(property.price)}
      </div>
    </OverlayViewF>
  );
}

export const PriceMarker = memo(PriceMarkerComponent);
