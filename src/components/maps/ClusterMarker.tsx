/**
 * Marcador de cluster premium estilo Zillow
 * KENTRA MAP STACK - OFICIAL
 *
 * Diseño: Círculos azules sólidos con tipografía clara
 * Referencia: Zillow Blue #0041D9
 */

import { memo, useCallback, useState } from 'react';
import { StableOverlay } from './StableOverlay';
import type { PropertyCluster } from '@/types/map';
import { cn } from '@/lib/utils';

interface ClusterMarkerProps {
  map: google.maps.Map | null;
  cluster: PropertyCluster;
  hidden?: boolean;
  onClick?: (cluster: PropertyCluster) => void;
}

// Formatear conteo compacto
function formatCount(count: number): string {
  if (count >= 10000) {
    return `${(count / 1000).toFixed(0)}K`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

// Formatear precio promedio compacto
function formatAvgPrice(price: number | undefined): string | null {
  if (!price || price <= 0) return null;
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(1)}M`;
  }
  if (price >= 1000) {
    return `$${(price / 1000).toFixed(0)}K`;
  }
  return `$${price.toFixed(0)}`;
}

// Calcular tamaño basado en cantidad (escala logarítmica más pronunciada)
// Con avg_price se necesita más espacio para el texto adicional
function getClusterSize(count: number, hasPrice: boolean): {
  size: number;
  countFontSize: number;
  priceFontSize: number;
} {
  // Tamaños más grandes para acomodar precio promedio
  if (count >= 1000) {
    return { size: hasPrice ? 64 : 56, countFontSize: 14, priceFontSize: 10 };
  }
  if (count >= 500) {
    return { size: hasPrice ? 60 : 52, countFontSize: 13, priceFontSize: 9 };
  }
  if (count >= 100) {
    return { size: hasPrice ? 56 : 48, countFontSize: 13, priceFontSize: 9 };
  }
  if (count >= 50) {
    return { size: hasPrice ? 52 : 44, countFontSize: 12, priceFontSize: 9 };
  }
  if (count >= 20) {
    return { size: hasPrice ? 48 : 40, countFontSize: 12, priceFontSize: 8 };
  }
  // Clusters pequeños (menos de 20)
  return { size: hasPrice ? 44 : 36, countFontSize: 11, priceFontSize: 8 };
}

// Colores premium estilo Zillow
const CLUSTER_COLORS = {
  // Azul Zillow como color principal
  primary: '#0066FF',
  primaryDark: '#0052CC',
  primaryLight: '#3385FF',
  // Sombras
  shadow: 'rgba(0, 102, 255, 0.35)',
  shadowHover: 'rgba(0, 102, 255, 0.5)',
};

export const ClusterMarker = memo(function ClusterMarker({
  map,
  cluster,
  hidden = false,
  onClick,
}: ClusterMarkerProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = useCallback(() => {
    onClick?.(cluster);
  }, [onClick, cluster]);

  const avgPriceLabel = formatAvgPrice(cluster.avg_price);
  const hasPrice = avgPriceLabel !== null;
  const { size, countFontSize, priceFontSize } = getClusterSize(cluster.count, hasPrice);
  const countLabel = formatCount(cluster.count);

  return (
    <StableOverlay
      map={map}
      position={{ lat: cluster.lat, lng: cluster.lng }}
      zIndex={30}
      hidden={hidden}
    >
      <button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'absolute -translate-x-1/2 -translate-y-1/2',
          'rounded-full',
          'flex flex-col items-center justify-center',
          'font-bold text-white',
          'cursor-pointer select-none',
          'focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-2',
        )}
        style={{
          width: size,
          height: size,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          letterSpacing: '-0.02em',
          background: isHovered
            ? `linear-gradient(180deg, ${CLUSTER_COLORS.primaryLight} 0%, ${CLUSTER_COLORS.primary} 100%)`
            : `linear-gradient(180deg, ${CLUSTER_COLORS.primary} 0%, ${CLUSTER_COLORS.primaryDark} 100%)`,
          border: '2px solid rgba(255,255,255,0.95)',
          boxShadow: isHovered
            ? `0 4px 16px ${CLUSTER_COLORS.shadowHover}, 0 2px 4px rgba(0,0,0,0.1)`
            : `0 2px 8px ${CLUSTER_COLORS.shadow}, 0 1px 2px rgba(0,0,0,0.08)`,
          transform: isHovered
            ? 'translate(-50%, -50%) scale(1.08)'
            : 'translate(-50%, -50%) scale(1)',
          transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          gap: hasPrice ? '1px' : 0,
          padding: hasPrice ? '2px' : 0,
        }}
        aria-label={`Grupo de ${cluster.count} propiedades${avgPriceLabel ? `, precio promedio ${avgPriceLabel}` : ''}. Click para acercar.`}
      >
        <span style={{ fontSize: countFontSize, lineHeight: 1.1 }}>{countLabel}</span>
        {avgPriceLabel && (
          <span
            style={{
              fontSize: priceFontSize,
              lineHeight: 1,
              opacity: 0.9,
              fontWeight: 500,
            }}
          >
            {avgPriceLabel}
          </span>
        )}
      </button>
    </StableOverlay>
  );
});
