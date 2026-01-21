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

// Calcular tamaño basado en cantidad (escala logarítmica más pronunciada)
function getClusterSize(count: number): { size: number; fontSize: number } {
  // Tamaños más grandes y diferenciados
  if (count >= 1000) {
    return { size: 56, fontSize: 15 };
  }
  if (count >= 500) {
    return { size: 52, fontSize: 14 };
  }
  if (count >= 100) {
    return { size: 48, fontSize: 14 };
  }
  if (count >= 50) {
    return { size: 44, fontSize: 13 };
  }
  if (count >= 20) {
    return { size: 40, fontSize: 13 };
  }
  // Clusters pequeños (menos de 20)
  return { size: 36, fontSize: 12 };
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

  const { size, fontSize } = getClusterSize(cluster.count);
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
          'flex items-center justify-center',
          'font-bold text-white',
          'cursor-pointer select-none',
          'focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-2',
        )}
        style={{
          width: size,
          height: size,
          fontSize,
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
        }}
        aria-label={`Grupo de ${cluster.count} propiedades. Click para acercar.`}
      >
        {countLabel}
      </button>
    </StableOverlay>
  );
});
