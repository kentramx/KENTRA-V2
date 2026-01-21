/**
 * Marcador de precio premium estilo Zillow
 * KENTRA MAP STACK - OFICIAL
 *
 * Diseño: Pill shape negro con flecha, estados claros
 */

import { memo, useCallback, useMemo } from 'react';
import { StableOverlay } from './StableOverlay';
import type { PropertyMarker } from '@/types/map';
import { cn } from '@/lib/utils';

interface PriceMarkerProps {
  map: google.maps.Map | null;
  property: PropertyMarker;
  isSelected?: boolean;
  isHovered?: boolean;
  isVisited?: boolean;
  hidden?: boolean;
  onClick?: (id: string) => void;
  onHover?: (property: PropertyMarker | null) => void;
}

// Formatear precio compacto - más legible
function formatPrice(price: number, currency: string): string {
  const symbol = currency === 'USD' ? 'US$' : '$';

  if (price >= 1_000_000) {
    const millions = price / 1_000_000;
    // Mostrar un decimal solo si es necesario
    return `${symbol}${millions >= 10 ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (price >= 1_000) {
    const thousands = price / 1_000;
    return `${symbol}${thousands.toFixed(0)}K`;
  }
  return `${symbol}${price.toLocaleString()}`;
}

// Estilos premium - Negro elegante con estados claros
const MARKER_STYLES = {
  default: {
    bg: '#18181B', // zinc-900
    text: '#FFFFFF',
    shadow: '0 2px 8px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.15)',
    scale: 1,
    zIndex: 20,
  },
  hover: {
    bg: '#0066FF', // Azul Zillow
    text: '#FFFFFF',
    shadow: '0 4px 16px rgba(0,102,255,0.4), 0 2px 4px rgba(0,0,0,0.1)',
    scale: 1.05,
    zIndex: 40,
  },
  selected: {
    bg: '#0066FF', // Azul Zillow
    text: '#FFFFFF',
    shadow: '0 6px 20px rgba(0,102,255,0.5), 0 3px 6px rgba(0,0,0,0.15)',
    scale: 1.08,
    zIndex: 50,
  },
  visited: {
    bg: '#71717A', // zinc-500
    text: '#FFFFFF',
    shadow: '0 1px 4px rgba(0,0,0,0.15)',
    scale: 0.95,
    zIndex: 10,
  },
} as const;

export const PriceMarker = memo(function PriceMarker({
  map,
  property,
  isSelected = false,
  isHovered = false,
  isVisited = false,
  hidden = false,
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

  const priceLabel = useMemo(
    () => formatPrice(property.price, property.currency),
    [property.price, property.currency]
  );

  const state = isSelected ? 'selected' : isHovered ? 'hover' : isVisited ? 'visited' : 'default';
  const styles = MARKER_STYLES[state];

  return (
    <StableOverlay
      map={map}
      position={{ lat: property.lat, lng: property.lng }}
      zIndex={styles.zIndex}
      hidden={hidden}
    >
      <div
        className="absolute"
        style={{
          transform: 'translate(-50%, -100%)',
          paddingBottom: '6px',
        }}
      >
        <button
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="relative cursor-pointer select-none focus:outline-none"
          style={{
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            backgroundColor: styles.bg,
            color: styles.text,
            boxShadow: styles.shadow,
            transform: `scale(${styles.scale})`,
            transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          aria-label={`${property.title} - ${priceLabel}`}
        >
          {priceLabel}

          {/* Triangle pointer - mismo color que el fondo */}
          <span
            style={{
              position: 'absolute',
              left: '50%',
              top: '100%',
              transform: 'translateX(-50%)',
              marginTop: '-1px',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: `6px solid ${styles.bg}`,
              transition: 'border-color 200ms ease-out',
            }}
          />
        </button>
      </div>
    </StableOverlay>
  );
});
