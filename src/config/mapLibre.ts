/**
 * Configuración centralizada de MapLibre para Kentra
 *
 * IMPORTANTE: Este archivo es la ÚNICA fuente de verdad para
 * configuración de mapas MapLibre en toda la aplicación.
 *
 * MapLibre es 100% gratuito y open source - sin costos de API
 */

// Estilos de mapa disponibles (todos gratuitos)
export const MAP_STYLES = {
  // OpenFreeMap - completamente gratis, sin límites
  openFreeMap: {
    light: 'https://tiles.openfreemap.org/styles/liberty',
    // Alternativa con más detalle
    positron: 'https://tiles.openfreemap.org/styles/positron',
  },
  // MapTiler - gratis hasta 100K tiles/mes
  mapTiler: {
    streets: 'https://api.maptiler.com/maps/streets-v2/style.json',
    basic: 'https://api.maptiler.com/maps/basic-v2/style.json',
  },
  // Estilo personalizado inline (sin dependencias externas)
  custom: {
    version: 8 as const,
    name: 'Kentra Style',
    sources: {
      'openmaptiles': {
        type: 'vector' as const,
        url: 'https://tiles.openfreemap.org/planet'
      }
    },
    layers: [] // Se pueden agregar layers personalizados
  }
} as const;

// Configuración principal de MapLibre
export const MAPLIBRE_CONFIG = {
  // Estilo por defecto - OpenFreeMap (gratis, sin API key)
  defaultStyle: 'https://tiles.openfreemap.org/styles/liberty',

  // Restricción geográfica a México
  bounds: {
    north: 32.72,
    south: 14.53,
    west: -118.4,
    east: -86.7,
  } as const,

  // Centro por defecto (México)
  defaultCenter: { lat: 23.6345, lng: -102.5528 } as const,

  // Límites de zoom
  zoom: {
    default: 6,
    min: 4,
    max: 18,
    showPropertiesAt: 12,
    minForQueries: 5,
  } as const,

  // Configuración de clustering
  clustering: {
    // Zoom levels donde se usa cada precisión de geohash
    geohashByZoom: {
      4: 4,   // ~40km
      5: 4,
      6: 4,
      7: 5,   // ~5km
      8: 5,
      9: 5,
      10: 6,  // ~1km
      11: 6,
      12: 6,
      13: 7,  // ~150m
      14: 7,
      15: 7,
      16: 8,  // ~40m - propiedades individuales
      17: 8,
      18: 8,
    } as Record<number, number>,

    // Límites de rendering
    maxMarkersPerViewport: 500,
    maxClustersPerViewport: 200,

    // Radio de clustering para Supercluster (pixels)
    radiusByZoom: {
      low: 120,    // zoom 4-8
      medium: 80,  // zoom 9-12
      high: 40,    // zoom 13+
    } as const,
  },

  // Debounce para eventos de mapa
  debounce: {
    boundsChange: 150,
    search: 300,
  } as const,

  // Configuración de performance
  performance: {
    // Usar Web Worker para clustering si hay más de N puntos
    useWorkerThreshold: 1000,
    // Límite de puntos para cargar en cliente
    maxClientPoints: 50000,
    // Batch size para updates
    batchSize: 5000,
  } as const,
};

// Estilos de clusters para MapLibre
export const CLUSTER_STYLES = {
  // Colores por tamaño de cluster
  colors: {
    small: '#3B82F6',     // Azul - < 10 propiedades
    medium: '#2563EB',    // Azul más oscuro - 10-99
    large: '#1D4ED8',     // Azul intenso - 100-999
    xlarge: '#1E40AF',    // Azul muy oscuro - 1000+
  } as const,

  // Tamaños por cantidad
  sizes: {
    small: 36,
    medium: 44,
    large: 52,
    xlarge: 60,
  } as const,

  // Función para obtener color según count
  getColor: (count: number): string => {
    if (count >= 1000) return CLUSTER_STYLES.colors.xlarge;
    if (count >= 100) return CLUSTER_STYLES.colors.large;
    if (count >= 10) return CLUSTER_STYLES.colors.medium;
    return CLUSTER_STYLES.colors.small;
  },

  // Función para obtener tamaño según count
  getSize: (count: number): number => {
    if (count >= 1000) return CLUSTER_STYLES.sizes.xlarge;
    if (count >= 100) return CLUSTER_STYLES.sizes.large;
    if (count >= 10) return CLUSTER_STYLES.sizes.medium;
    return CLUSTER_STYLES.sizes.small;
  },
};

// Estilos de price markers
export const MARKER_STYLES = {
  // Estados del marker
  default: {
    background: '#FFFFFF',
    border: '#E5E7EB',
    text: '#1F2937',
  },
  selected: {
    background: '#3B82F6',
    border: '#2563EB',
    text: '#FFFFFF',
  },
  hovered: {
    background: '#EFF6FF',
    border: '#3B82F6',
    text: '#1F2937',
  },
  visited: {
    background: '#F3F4F6',
    border: '#D1D5DB',
    text: '#6B7280',
  },
} as const;

// Exportar tipo para TypeScript
export type MapLibreConfig = typeof MAPLIBRE_CONFIG;
export type ClusterStyles = typeof CLUSTER_STYLES;
export type MarkerStyles = typeof MARKER_STYLES;
