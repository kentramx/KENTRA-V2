/**
 * Mapbox Client Configuration
 * 
 * Este módulo configura el token de acceso de Mapbox globalmente
 * y exporta la instancia configurada para uso en toda la aplicación.
 * 
 * IMPORTANTE: Todos los componentes que usen Mapbox deben importar desde aquí.
 * 
 * Build trigger: 2024-12-09T00:55 - Force rebuild with updated VITE_MAPBOX_ACCESS_TOKEN
 */

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

// Debug logging para diagnosticar el token
console.log('[Mapbox] Token check:', {
  present: !!MAPBOX_TOKEN,
  startsWithPk: MAPBOX_TOKEN?.startsWith('pk.'),
  length: MAPBOX_TOKEN?.length || 0,
  allEnvKeys: Object.keys(import.meta.env).filter(k => k.includes('MAPBOX'))
});

if (!MAPBOX_TOKEN) {
  console.error(
    "[Mapbox] Missing VITE_MAPBOX_ACCESS_TOKEN. Map features will not work correctly."
  );
} else {
  mapboxgl.accessToken = MAPBOX_TOKEN;
  console.log('[Mapbox] Token configured successfully');
}

export { mapboxgl, MAPBOX_TOKEN };
