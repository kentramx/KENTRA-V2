/**
 * Marcador de cluster premium estilo Zillow
 * KENTRA MAP STACK - OFICIAL
 */

import { OverlayView } from '@react-google-maps/api';
import { memo, useCallback, useState } from 'react';
import type { PropertyCluster } from '@/types/map';
import { cn } from '@/lib/utils';

interface ClusterMarkerProps {
  cluster: PropertyCluster;
  hidden?: boolean; // Para pool de markers - ocultar sin desmontar
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

// Calcular tamaño basado en cantidad (escala logarítmica)
function getClusterSize(count: number): { size: number; fontSize: number } {
  const minSize = 40;
  const maxSize = 70;
  
  const scale = Math.min(Math.log10(count + 1) / 4, 1);
  const size = Math.round(minSize + (maxSize - minSize) * scale);
  const fontSize = Math.round(size * 0.32);
  
  return { size, fontSize };
}

// Obtener estilo según densidad
function getClusterStyle(count: number): { 
  gradient: string; 
  shadowNormal: string;
  shadowHover: string;
} {
  if (count >= 500) {
    return { 
      gradient: 'linear-gradient(145deg, #1a1a1a 0%, #000000 100%)',
      shadowNormal: '0 4px 14px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.3)',
      shadowHover: '0 8px 28px rgba(0,0,0,0.6), 0 4px 10px rgba(0,0,0,0.4)',
    };
  }
  if (count >= 100) {
    return { 
      gradient: 'linear-gradient(145deg, #2d2d2d 0%, #1a1a1a 100%)',
      shadowNormal: '0 4px 12px rgba(0,0,0,0.45), 0 2px 5px rgba(0,0,0,0.25)',
      shadowHover: '0 8px 24px rgba(0,0,0,0.55), 0 4px 8px rgba(0,0,0,0.35)',
    };
  }
  if (count >= 20) {
    return { 
      gradient: 'linear-gradient(145deg, #404040 0%, #2d2d2d 100%)',
      shadowNormal: '0 4px 10px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2)',
      shadowHover: '0 8px 20px rgba(0,0,0,0.5), 0 4px 6px rgba(0,0,0,0.3)',
    };
  }
  return { 
    gradient: 'linear-gradient(145deg, #525252 0%, #404040 100%)',
    shadowNormal: '0 3px 8px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.15)',
    shadowHover: '0 6px 16px rgba(0,0,0,0.45), 0 3px 5px rgba(0,0,0,0.25)',
  };
}

export const ClusterMarker = memo(function ClusterMarker({
  cluster,
  hidden = false,
  onClick,
}: ClusterMarkerProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const handleClick = useCallback(() => {
    onClick?.(cluster);
  }, [onClick, cluster]);

  const { size, fontSize } = getClusterSize(cluster.count);
  const style = getClusterStyle(cluster.count);
  const countLabel = formatCount(cluster.count);

  return (
    <OverlayView
      position={{ lat: cluster.lat, lng: cluster.lng }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'absolute -translate-x-1/2 -translate-y-1/2',
          'rounded-full',
          'flex items-center justify-center',
          'font-bold text-white tracking-tight',
          'transition-all duration-200 ease-out',
          'cursor-pointer select-none',
          'focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent',
          // Transición suave para evitar flickering
          'animate-in fade-in-0 zoom-in-95 duration-150'
        )}
        style={{
          width: size,
          height: size,
          fontSize,
          background: style.gradient,
          border: '3px solid white',
          boxShadow: isHovered ? style.shadowHover : style.shadowNormal,
          transform: isHovered ? 'translate(-50%, -50%) scale(1.12)' : 'translate(-50%, -50%) scale(1)',
          opacity: hidden ? 0 : 1,
          pointerEvents: hidden ? 'none' : 'auto',
          visibility: hidden ? 'hidden' : 'visible',
          transition: 'opacity 200ms ease-out, transform 200ms ease-out',
        }}
        aria-hidden={hidden}
        aria-label={`Grupo de ${cluster.count} propiedades. Click para acercar.`}
      >
        {countLabel}
      </button>
    </OverlayView>
  );
});
