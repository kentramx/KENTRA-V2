/**
 * Configuración centralizada de Google Maps para Kentra
 * 
 * IMPORTANTE: Este archivo es la ÚNICA fuente de verdad para
 * configuración de mapas en toda la aplicación.
 */

export const GOOGLE_MAPS_CONFIG = {
  // API Key desde variables de entorno
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  
  // Librerías requeridas
  libraries: ['places', 'geometry'] as const,
  
  // Restricción geográfica a México
  bounds: {
    north: 32.72,
    south: 14.53,
    west: -118.40,
    east: -86.70,
  },
  
  // Centro por defecto (México)
  defaultCenter: { lat: 23.6345, lng: -102.5528 },
  
  // Límites de zoom
  zoom: {
    default: 5,
    min: 4,
    max: 18,
    // Zoom mínimo para mostrar propiedades individuales
    // Por debajo de esto, SOLO clusters
    showPropertiesAt: 12,
    // Zoom mínimo para hacer queries
    minForQueries: 5,
  },
  
  // Configuración de clustering SERVER-SIDE
  clustering: {
    // Tamaño de grid según zoom (en grados)
    gridSizeByZoom: {
      5: 3.0,
      6: 2.0,
      7: 1.0,
      8: 0.5,
      9: 0.25,
      10: 0.1,
      11: 0.05,
      12: 0, // Sin clustering
    } as Record<number, number>,
    // Máximo de elementos por viewport
    maxMarkersPerViewport: 200,
    maxClustersPerViewport: 100,
  },
  
  // Debounce para eventos de mapa
  debounce: {
    boundsChange: 300, // ms
    search: 500, // ms
  },
  
  // Estilos del mapa (minimalista)
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
    {
      featureType: 'transit',
      stylers: [{ visibility: 'off' }],
    },
  ] as google.maps.MapTypeStyle[],
};

// Validación en desarrollo
if (!GOOGLE_MAPS_CONFIG.apiKey && import.meta.env.DEV) {
  console.warn('[GoogleMaps] API Key no configurada. Agrega VITE_GOOGLE_MAPS_API_KEY al .env');
}
