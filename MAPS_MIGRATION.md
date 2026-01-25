# Estado de Migración de Mapas

## Fecha: 2026-01-25

## Estado: 🚧 EN PROGRESO - Limpieza completada, implementación pendiente

---

## Qué se eliminó:

### Código Frontend
- [x] `src/components/maps/SearchMapLibre.tsx` - Mapa de búsqueda principal
- [x] `src/components/maps/SearchMap.tsx` - Alternativa Google Maps
- [x] `src/components/maps/MapLibreBase.tsx` - Container MapLibre
- [x] `src/components/maps/MapLibreClusterLayer.tsx` - Capa de clusters
- [x] `src/components/maps/MapLibreMarkerLayer.tsx` - Capa de markers
- [x] `src/components/maps/GoogleMapBase.tsx` - Container Google Maps
- [x] `src/components/maps/ClusterMarker.tsx` - Marker de cluster
- [x] `src/components/maps/PriceMarker.tsx` - Marker de precio
- [x] `src/components/maps/StableOverlay.tsx` - Overlay optimizado
- [x] `src/components/maps/index.ts` - Barrel exports
- [x] `src/hooks/useMapClusters.ts` - Hook principal de clustering
- [x] `src/hooks/useClusterWorker.ts` - Hook de Web Worker
- [x] `src/workers/cluster.worker.ts` - Web Worker de Supercluster
- [x] `src/types/map.ts` - Tipos de mapas
- [x] `src/config/mapLibre.ts` - Configuración MapLibre

### Edge Functions
- [x] `supabase/functions/get-clusters/` - Clusters pre-computados
- [x] `supabase/functions/cluster-properties/` - Clustering Supercluster
- [x] `supabase/functions/refresh-clusters/` - Refrescar clusters
- [x] `supabase/functions/backfill-geohash/` - Backfill de geohash
- [x] `supabase/functions/cleanup-tile-cache/` - Limpieza de cache

### Base de Datos
- [x] Tabla `property_clusters`
- [x] Columnas `geohash_4`, `geohash_5`, `geohash_6`, `geohash_7`, `geohash_8`
- [x] Función `encode_geohash()`
- [x] Función `update_property_geohash()`
- [x] Función `get_clusters_in_viewport()`
- [x] Función `get_properties_in_viewport()`
- [x] Función `refresh_property_clusters()`
- [x] Función `backfill_geohash_batched()`
- [x] Función `backfill_geohash_single_batch()`
- [x] Función `backfill_geohash_fast()`
- [x] Trigger `trigger_update_property_geohash`
- [x] Índices `idx_properties_geohash_*`

### Documentación
- [x] `MAPA_ZILLOW_FASES_COMPLETADAS.md` - Eliminado
- [x] `FASE_0_1_2_COMPLETADO.md` - Eliminado
- [x] Otros docs históricos - Movidos a `archive/docs-pre-maps-v2/`

---

## Qué se preservó:

### Código Frontend
- [x] `src/components/PropertyMap.tsx` - Mapa de detalle (Google Maps)
- [x] `src/components/maps/LocationSearchInput.tsx` - Autocompletado de direcciones
- [x] `src/components/PlaceAutocomplete.tsx` - Autocompletado de lugares
- [x] `src/config/googleMaps.ts` - Configuración Google Maps
- [x] `src/types/google-maps.d.ts` - Tipos de Google Maps

### Base de Datos
- [x] Columnas `lat` y `lng` en `properties`
- [x] **PostGIS 3.3.7** ya habilitado

### Edge Functions
- [x] `geocode-property/` - Geocodificación
- [x] `geocode-existing-properties/` - Geocodificación batch
- [x] `property-search/` - Búsqueda de propiedades

---

## Nueva arquitectura (pendiente):

### Base de Datos
- [ ] Columna `geom` GEOMETRY(Point, 4326) GENERATED
- [ ] Columnas `geohash_3` a `geohash_6` GENERATED con ST_GeoHash
- [ ] Índice GIST en `geom`
- [ ] Función `get_map_clusters()` con PostGIS
- [ ] Función `properties_mvt()` para Martin

### Infraestructura
- [ ] Martin Tile Server (Railway)
- [ ] Meilisearch Cloud
- [ ] Sync Worker (PostgreSQL → Meilisearch)

### Edge Functions
- [ ] `map-data/` - Clusters con filtros
- [ ] `search-properties/` - Lista paginada (Meilisearch)
- [ ] `sync-search/` - Sincronización

### Frontend
- [ ] Zustand store (`mapStore.ts`)
- [ ] Hook `useMapData()`
- [ ] Componente `PropertyMap/` (MapLibre)
- [ ] Componente `PropertyList/`
- [ ] Componente `FilterPanel/`
- [ ] Debug Panel

---

## Estado actual de Buscar.tsx

La página `src/pages/Buscar.tsx` tiene un **placeholder temporal** que muestra:
- "🚧 Mapa en construcción"
- Mensaje sobre nueva arquitectura enterprise

La lista de propiedades sigue funcionando con `usePropertySearch`.

---

## Notas importantes:

1. **NO tocar `PropertyMap.tsx`** - Es el mapa de detalle de propiedad individual (Google Maps), funciona correctamente

2. **PostGIS ya está habilitado** - versión 3.3.7, listo para usar

3. **Columnas lat/lng preservadas** - Son la base para la nueva arquitectura

4. **Branch de trabajo:** `feature/maps-enterprise`

5. **Branch de backup:** `backup/pre-map-cleanup-20260125`

6. **Nueva arquitectura diseñada para 5M+ propiedades**

---

## Commits relacionados:

- `683eafb` - chore: remove old map search code - preparing for enterprise architecture

---

## Próximos pasos:

1. Implementar schema PostgreSQL + PostGIS
2. Desplegar Martin en Railway
3. Configurar Meilisearch Cloud
4. Implementar Edge Functions
5. Implementar Frontend con MapLibre
6. Testing y optimización
