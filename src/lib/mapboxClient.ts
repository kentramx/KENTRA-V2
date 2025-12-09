/**
 * Mapbox Client Configuration
 * 
 * Este módulo configura el token de acceso de Mapbox globalmente
 * y exporta la instancia configurada para uso en toda la aplicación.
 * 
 * IMPORTANTE: Todos los componentes que usen Mapbox deben importar desde aquí.
 */

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

if (!MAPBOX_TOKEN) {
  console.error(
    "[Mapbox] Missing VITE_MAPBOX_ACCESS_TOKEN. Map features will not work correctly."
  );
} else {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

export { mapboxgl, MAPBOX_TOKEN };
