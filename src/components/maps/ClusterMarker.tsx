/**
 * Marcador de cluster
 * Círculo negro con número de propiedades
 */

import { OverlayView } from '@react-google-maps/api';
import { memo, useCallback } from 'react';
import type { PropertyCluster } from '@/types/map';
import { cn } from '@/lib/utils';

interface ClusterMarkerProps {
  cluster: PropertyCluster;
  onClick?: (cluster: PropertyCluster) => void;
}

// Formatear conteo
function formatCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

// Calcular tamaño basado en cantidad
function getSize(count: number): number {
  const minSize = 36;
  const maxSize = 60;
  const scale = Math.min(Math.log10(count + 1) / 3, 1);
  return minSize + (maxSize - minSize) * scale;
}

export const ClusterMarker = memo(function ClusterMarker({
  cluster,
  onClick,
}: ClusterMarkerProps) {
  const handleClick = useCallback(() => {
    onClick?.(cluster);
  }, [onClick, cluster]);

  const size = getSize(cluster.count);
  const countLabel = formatCount(cluster.count);

  return (
    <OverlayView
      position={{ lat: cluster.lat, lng: cluster.lng }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <button
        onClick={handleClick}
        className={cn(
          'relative -translate-x-1/2 -translate-y-1/2',
          'rounded-full bg-black text-white',
          'flex items-center justify-center',
          'font-bold shadow-lg border-[3px] border-white',
          'transition-transform duration-150',
          'cursor-pointer hover:scale-110',
          'focus:outline-none focus:ring-2 focus:ring-primary'
        )}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.35,
        }}
        aria-label={`Cluster de ${cluster.count} propiedades`}
      >
        {countLabel}
      </button>
    </OverlayView>
  );
});
