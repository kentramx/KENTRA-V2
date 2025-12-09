/**
 * KENTRA GOOGLE MAPS CONFIG
 * Configuración centralizada para Google Maps
 */

export const GOOGLE_MAPS_CONFIG = {
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  defaultCenter: { lat: 23.6345, lng: -102.5528 }, // Centro de México
  defaultZoom: 5,
  minZoom: 4,
  maxZoom: 19,
  restriction: {
    latLngBounds: {
      north: 32.7,
      south: 14.5,
      east: -86.5,
      west: -118.5,
    },
    strictBounds: false,
  },
  clusterConfig: {
    maxZoom: 14, // Clusters hasta zoom 14, después marcadores individuales
    gridSize: {
      6: 5.0,
      8: 2.0,
      10: 1.0,
      12: 0.5,
      14: 0.1,
    },
  },
  limits: {
    maxMarkersPerView: 500,
    maxClustersPerView: 200,
  },
  styles: [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  ] as google.maps.MapTypeStyle[],
};

export type GoogleMapsConfig = typeof GOOGLE_MAPS_CONFIG;
