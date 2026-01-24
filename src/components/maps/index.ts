/**
 * KENTRA MAP STACK - OFICIAL
 * Exportaciones centralizadas de componentes de mapa
 *
 * MIGRACIÓN A MAPLIBRE:
 * - SearchMapLibre reemplaza SearchMap (Google Maps)
 * - $0/mes vs $200-500/mes
 * - WebGL nativo, mejor performance
 */

// ============================================================================
// MAPLIBRE (RECOMENDADO) - $0/mes, sin límites
// ============================================================================
export { MapLibreBase } from './MapLibreBase';
export { SearchMapLibre } from './SearchMapLibre';
export { MapLibreClusterLayer } from './MapLibreClusterLayer';
export { MapLibreMarkerLayer } from './MapLibreMarkerLayer';

// ============================================================================
// GOOGLE MAPS (LEGACY) - $200-500/mes
// Mantener temporalmente para compatibilidad
// ============================================================================
export { GoogleMapBase } from './GoogleMapBase';
export { SearchMap } from './SearchMap';
export { PriceMarker } from './PriceMarker';
export { ClusterMarker } from './ClusterMarker';
export { StableOverlay } from './StableOverlay';
