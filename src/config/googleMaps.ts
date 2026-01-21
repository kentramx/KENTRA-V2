/**
 * Configuración centralizada de Google Maps para Kentra
 *
 * IMPORTANTE: Este archivo es la ÚNICA fuente de verdad para
 * configuración de mapas en toda la aplicación.
 */

// Librerías requeridas - definidas fuera del objeto para evitar problemas de tipo
export const GOOGLE_MAPS_LIBRARIES: ("places" | "geometry")[] = ["places", "geometry"];

// API Key desde variable de entorno (NUNCA hardcodear en producción)
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

export const GOOGLE_MAPS_CONFIG = {
  // API Key desde variables de entorno
  apiKey,

  // Restricción geográfica a México
  bounds: {
    north: 32.72,
    south: 14.53,
    west: -118.4,
    east: -86.7,
  },

  // Centro por defecto (México)
  defaultCenter: { lat: 23.6345, lng: -102.5528 },

  // Límites de zoom
  zoom: {
    default: 6,
    min: 4,
    max: 18,
    showPropertiesAt: 12,
    minForQueries: 5,
  },

  // Configuración de clustering SERVER-SIDE
  clustering: {
    gridSizeByZoom: {
      5: 3.0,
      6: 2.0,
      7: 1.0,
      8: 0.5,
      9: 0.25,
      10: 0.1,
      11: 0.05,
      12: 0,
    } as Record<number, number>,
    maxMarkersPerViewport: 200,
    maxClustersPerViewport: 100,
  },

  // Debounce para eventos de mapa - reducido para UX más responsive
  debounce: {
    boundsChange: 200,
    search: 300,
  },

  // Estilos premium del mapa - basados en Zillow (Snazzy Maps #13330)
  // https://snazzymaps.com/style/13330/zillow
  styles: [
    // Landscape base - beige claro
    {
      featureType: "landscape",
      elementType: "geometry",
      stylers: [{ color: "#e7e6e5" }],
    },
    // Terreno natural - verde suave
    {
      featureType: "landscape.natural.terrain",
      elementType: "geometry",
      stylers: [{ color: "#c5dea2" }],
    },
    // Agua - azul apagado
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#b1bdd6" }],
    },
    // Carreteras principales - blancas
    {
      featureType: "road.highway",
      elementType: "geometry.fill",
      stylers: [{ color: "#ffffff" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry.stroke",
      stylers: [{ color: "#d6d6d6" }, { weight: 0.5 }],
    },
    // Carreteras arteriales
    {
      featureType: "road.arterial",
      elementType: "geometry.fill",
      stylers: [{ color: "#ffffff" }],
    },
    {
      featureType: "road.arterial",
      elementType: "geometry.stroke",
      stylers: [{ color: "#d6d6d6" }, { weight: 0.3 }],
    },
    // Carreteras locales
    {
      featureType: "road.local",
      elementType: "geometry.fill",
      stylers: [{ color: "#f3f1ef" }],
    },
    {
      featureType: "road.local",
      elementType: "geometry.stroke",
      stylers: [{ visibility: "off" }],
    },
    // Labels de carreteras - gris suave
    {
      featureType: "road",
      elementType: "labels.text.fill",
      stylers: [{ color: "#817d76" }],
    },
    // Ocultar tránsito completamente
    {
      featureType: "transit",
      stylers: [{ visibility: "off" }],
    },
    // POIs - ocultar la mayoría
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "poi.business",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "poi.attraction",
      stylers: [{ visibility: "off" }],
    },
    // Parques visibles pero sutiles
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ color: "#c5dea2" }],
    },
    {
      featureType: "poi.park",
      elementType: "labels",
      stylers: [{ visibility: "off" }],
    },
    // Labels administrativos
    {
      featureType: "administrative.locality",
      elementType: "labels.text.fill",
      stylers: [{ color: "#444444" }],
    },
    {
      featureType: "administrative.neighborhood",
      elementType: "labels.text.fill",
      stylers: [{ color: "#666666" }],
    },
    // Estados/provincias - más sutiles
    {
      featureType: "administrative.province",
      elementType: "geometry.stroke",
      stylers: [{ color: "#c0c0c0" }, { weight: 1 }],
    },
  ],
};

// Validación en desarrollo
if (!GOOGLE_MAPS_CONFIG.apiKey && import.meta.env.DEV) {
  console.warn("[GoogleMaps] API Key no configurada. Agrega VITE_GOOGLE_MAPS_API_KEY al .env");
}