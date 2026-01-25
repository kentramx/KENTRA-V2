/**
 * Capa de clusters para MapLibre GL
 * Renderiza clusters usando las capacidades nativas de MapLibre
 */

import { useEffect } from 'react';
import { useMap, Source, Layer } from 'react-map-gl/maplibre';
import type { CircleLayerSpecification, SymbolLayerSpecification } from 'maplibre-gl';
import { CLUSTER_STYLES } from '@/config/mapLibre';

interface ClusterData {
  id: string;
  lat: number;
  lng: number;
  count: number;
  avg_price?: number;
}

interface MapLibreClusterLayerProps {
  clusters: ClusterData[];
  onClusterClick?: (cluster: ClusterData) => void;
}

// Convertir clusters a GeoJSON
function clustersToGeoJSON(clusters: ClusterData[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: clusters.map((cluster) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [cluster.lng, cluster.lat],
      },
      properties: {
        id: cluster.id,
        count: cluster.count,
        avg_price: cluster.avg_price || 0,
      },
    })),
  };
}

// Estilos de la capa de círculos
const clusterCircleLayer: CircleLayerSpecification = {
  id: 'clusters-circle',
  type: 'circle',
  source: 'clusters',
  paint: {
    // Color según cantidad
    'circle-color': [
      'step',
      ['get', 'count'],
      CLUSTER_STYLES.colors.small,
      10, CLUSTER_STYLES.colors.medium,
      100, CLUSTER_STYLES.colors.large,
      1000, CLUSTER_STYLES.colors.xlarge,
    ],
    // Tamaño según cantidad
    'circle-radius': [
      'step',
      ['get', 'count'],
      CLUSTER_STYLES.sizes.small / 2,
      10, CLUSTER_STYLES.sizes.medium / 2,
      100, CLUSTER_STYLES.sizes.large / 2,
      1000, CLUSTER_STYLES.sizes.xlarge / 2,
    ],
    // Borde blanco
    'circle-stroke-width': 2,
    'circle-stroke-color': '#FFFFFF',
    // Sombra
    'circle-blur': 0.1,
  },
};

// Estilos del texto del contador
const clusterCountLayer: SymbolLayerSpecification = {
  id: 'clusters-count',
  type: 'symbol',
  source: 'clusters',
  layout: {
    'text-field': [
      'case',
      ['>=', ['get', 'count'], 1000000],
      ['concat', ['to-string', ['/', ['round', ['/', ['get', 'count'], 100000]], 10]], 'M'],
      ['>=', ['get', 'count'], 1000],
      ['concat', ['to-string', ['/', ['round', ['/', ['get', 'count'], 100]], 10]], 'K'],
      ['to-string', ['get', 'count']],
    ],
    'text-size': [
      'step',
      ['get', 'count'],
      12,
      10, 13,
      100, 14,
      1000, 15,
    ],
    'text-allow-overlap': true,
    'text-ignore-placement': true,
  },
  paint: {
    'text-color': '#FFFFFF',
    'text-halo-color': 'rgba(0, 0, 0, 0.3)',
    'text-halo-width': 1,
  },
};

export function MapLibreClusterLayer({
  clusters,
  onClusterClick,
}: MapLibreClusterLayerProps) {
  const { current: map } = useMap();

  // Manejar click en clusters
  useEffect(() => {
    if (!map || !onClusterClick) return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['clusters-circle'],
      });

      if (features.length > 0) {
        const feature = features[0];
        const props = feature.properties;
        const geometry = feature.geometry as GeoJSON.Point;

        onClusterClick({
          id: props?.id || '',
          lat: geometry.coordinates[1],
          lng: geometry.coordinates[0],
          count: props?.count || 0,
          avg_price: props?.avg_price,
        });
      }
    };

    map.on('click', 'clusters-circle', handleClick);

    // Cursor pointer en hover
    map.on('mouseenter', 'clusters-circle', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'clusters-circle', () => {
      map.getCanvas().style.cursor = '';
    });

    return () => {
      map.off('click', 'clusters-circle', handleClick);
    };
  }, [map, onClusterClick]);

  // No renderizar si no hay clusters
  if (clusters.length === 0) {
    return null;
  }

  const geojson = clustersToGeoJSON(clusters);

  return (
    <Source id="clusters" type="geojson" data={geojson}>
      <Layer {...clusterCircleLayer} />
      <Layer {...clusterCountLayer} />
    </Source>
  );
}
