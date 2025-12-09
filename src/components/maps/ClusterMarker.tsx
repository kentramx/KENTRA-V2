/**
 * KENTRA MAP STACK - OFICIAL
 * Marcador de cluster con conteo
 */

import { memo, useCallback } from 'react';
import { OverlayView, OverlayViewF } from '@react-google-maps/api';
import { PropertyCluster } from '@/types/map';

interface ClusterMarkerProps {
  cluster: PropertyCluster;
  onClick?: (cluster: PropertyCluster) => void;
}

const formatCount = (count: number): string => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
  return count.toString();
};

const getSize = (count: number): { size: string; fontSize: string } => {
  if (count >= 1000) return { size: 'w-14 h-14', fontSize: 'text-base' };
  if (count >= 100) return { size: 'w-12 h-12', fontSize: 'text-sm' };
  if (count >= 10) return { size: 'w-10 h-10', fontSize: 'text-sm' };
  return { size: 'w-9 h-9', fontSize: 'text-xs' };
};

function ClusterMarkerComponent({ cluster, onClick }: ClusterMarkerProps) {
  const handleClick = useCallback(() => {
    onClick?.(cluster);
  }, [onClick, cluster]);

  const position = { lat: cluster.lat, lng: cluster.lng };
  const { size, fontSize } = getSize(cluster.count);

  return (
    <OverlayViewF
      position={position}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div
        onClick={handleClick}
        className={`
          ${size} ${fontSize}
          rounded-full bg-primary text-primary-foreground
          flex items-center justify-center
          font-bold cursor-pointer
          shadow-xl border-[3px] border-background
          hover:scale-110 active:scale-95
          transition-transform duration-150
          transform -translate-x-1/2 -translate-y-1/2
          select-none
        `}
        style={{
          boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
        }}
      >
        {formatCount(cluster.count)}
      </div>
    </OverlayViewF>
  );
}

export const ClusterMarker = memo(ClusterMarkerComponent);
