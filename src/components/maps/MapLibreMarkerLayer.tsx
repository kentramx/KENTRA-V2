/**
 * Capa de markers de precio para MapLibre GL
 * Renderiza propiedades individuales con precio
 */

import { useEffect, useMemo, useCallback } from 'react';
import { useMap, Marker } from 'react-map-gl/maplibre';
import { MARKER_STYLES } from '@/config/mapLibre';
import type { PropertyMarker } from '@/types/map';
import { cn } from '@/lib/utils';

interface MapLibreMarkerLayerProps {
  properties: PropertyMarker[];
  selectedPropertyId?: string | null;
  hoveredPropertyId?: string | null;
  visitedPropertyIds?: Set<string>;
  onPropertyClick?: (id: string) => void;
  onPropertyHover?: (property: PropertyMarker | null) => void;
  maxVisible?: number;
}

// Formatear precio para mostrar
function formatPrice(price: number): string {
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(1)}M`;
  }
  if (price >= 1000) {
    return `$${Math.round(price / 1000)}K`;
  }
  return `$${price.toLocaleString()}`;
}

// Componente de marker individual
function PriceMarkerContent({
  property,
  isSelected,
  isHovered,
  isVisited,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  property: PropertyMarker;
  isSelected: boolean;
  isHovered: boolean;
  isVisited: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  // Determinar estilo según estado
  const style = useMemo(() => {
    if (isSelected) return MARKER_STYLES.selected;
    if (isHovered) return MARKER_STYLES.hovered;
    if (isVisited) return MARKER_STYLES.visited;
    return MARKER_STYLES.default;
  }, [isSelected, isHovered, isVisited]);

  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap',
        'shadow-md cursor-pointer',
        'transition-all duration-150',
        'hover:scale-110 hover:z-50',
        isSelected && 'scale-110 z-50',
      )}
      style={{
        backgroundColor: style.background,
        borderColor: style.border,
        color: style.text,
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      {formatPrice(property.price)}
    </div>
  );
}

export function MapLibreMarkerLayer({
  properties,
  selectedPropertyId,
  hoveredPropertyId,
  visitedPropertyIds = new Set(),
  onPropertyClick,
  onPropertyHover,
  maxVisible = 500,
}: MapLibreMarkerLayerProps) {
  const { current: map } = useMap();

  // Limitar propiedades visibles
  const visibleProperties = useMemo(() => {
    return properties.slice(0, maxVisible);
  }, [properties, maxVisible]);

  // Handler de click
  const handleClick = useCallback(
    (property: PropertyMarker) => {
      onPropertyClick?.(property.id);
    },
    [onPropertyClick]
  );

  // Handler de hover
  const handleMouseEnter = useCallback(
    (property: PropertyMarker) => {
      onPropertyHover?.(property);
    },
    [onPropertyHover]
  );

  const handleMouseLeave = useCallback(() => {
    onPropertyHover?.(null);
  }, [onPropertyHover]);

  // Actualizar cursor en hover
  useEffect(() => {
    if (!map) return;

    if (hoveredPropertyId) {
      map.getCanvas().style.cursor = 'pointer';
    } else {
      map.getCanvas().style.cursor = '';
    }
  }, [map, hoveredPropertyId]);

  return (
    <>
      {visibleProperties.map((property) => (
        <Marker
          key={property.id}
          longitude={property.lng}
          latitude={property.lat}
          anchor="center"
        >
          <PriceMarkerContent
            property={property}
            isSelected={property.id === selectedPropertyId}
            isHovered={property.id === hoveredPropertyId}
            isVisited={visitedPropertyIds.has(property.id)}
            onClick={() => handleClick(property)}
            onMouseEnter={() => handleMouseEnter(property)}
            onMouseLeave={handleMouseLeave}
          />
        </Marker>
      ))}
    </>
  );
}
