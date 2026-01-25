# CONTEXTO DE SESIÓN - MIGRACIÓN DE MAPAS KENTRA

## Fecha: 2026-01-25

## ESTADO ACTUAL: ✅ LIMPIEZA COMPLETADA

---

## LO QUE YA SE HIZO:

### 1. Branches creados
- `backup/pre-map-cleanup-20260125` - Backup antes de limpieza
- `feature/maps-enterprise` - Branch de trabajo actual

### 2. Código eliminado (✅ COMPLETADO)

**Frontend eliminado:**
- src/components/maps/SearchMapLibre.tsx
- src/components/maps/SearchMap.tsx
- src/components/maps/MapLibreBase.tsx
- src/components/maps/MapLibreClusterLayer.tsx
- src/components/maps/MapLibreMarkerLayer.tsx
- src/components/maps/GoogleMapBase.tsx
- src/components/maps/ClusterMarker.tsx
- src/components/maps/PriceMarker.tsx
- src/components/maps/StableOverlay.tsx
- src/components/maps/index.ts
- src/hooks/useMapClusters.ts
- src/hooks/useClusterWorker.ts
- src/workers/cluster.worker.ts
- src/types/map.ts
- src/config/mapLibre.ts

**Edge Functions eliminadas:**
- supabase/functions/get-clusters/
- supabase/functions/cluster-properties/
- supabase/functions/refresh-clusters/
- supabase/functions/backfill-geohash/
- supabase/functions/cleanup-tile-cache/

### 3. Base de datos limpiada (✅ COMPLETADO via API)
- Tabla `property_clusters` eliminada
- Columnas `geohash_4` a `geohash_8` eliminadas
- Funciones de clustering eliminadas
- Triggers eliminados
- Índices de geohash eliminados
- **PostGIS 3.3.7 ya está habilitado**
- **Columnas lat/lng preservadas**

### 4. Archivos preservados (✅ VERIFICADO)
- src/components/PropertyMap.tsx (mapa de detalle Google Maps)
- src/components/maps/LocationSearchInput.tsx
- src/components/PlaceAutocomplete.tsx
- src/config/googleMaps.ts
- src/types/google-maps.d.ts

### 5. Buscar.tsx actualizado (✅ COMPLETADO)
- Imports rotos eliminados
- Placeholder "🚧 Mapa en construcción" agregado
- Build pasa sin errores

### 6. Documentación (✅ COMPLETADO)
- MAPS_MIGRATION.md creado
- Docs históricos archivados en archive/docs-pre-maps-v2/
- Docs obsoletos eliminados

### 7. Commits realizados
- `683eafb` - chore: remove old map search code
- `d4c9cee` - docs: clean up old map documentation

---

## LO QUE FALTA HACER:

### Nueva arquitectura enterprise (PENDIENTE):

1. **Base de datos con PostGIS**
   - Agregar columna `geom` GEOMETRY
   - Agregar columnas `geohash_3` a `geohash_6` GENERATED
   - Crear índice GIST
   - Crear función `get_map_clusters()`
   - Crear función `properties_mvt()` para Martin

2. **Martin Tile Server**
   - Desplegar en Railway
   - Configurar martin.yaml
   - Conectar a PostgreSQL

3. **Meilisearch**
   - Crear cuenta en Meilisearch Cloud
   - Configurar índice
   - Crear Edge Function de sync

4. **Edge Functions nuevas**
   - map-data (clusters con filtros)
   - search-properties (lista con Meilisearch)
   - sync-search (PostgreSQL → Meilisearch)

5. **Frontend nuevo**
   - Zustand store (mapStore.ts)
   - useMapData hook
   - Componente PropertyMap con MapLibre
   - PropertyList
   - FilterPanel
   - MapDebugPanel (obligatorio)

---

## CREDENCIALES DISPONIBLES:

### Supabase
- Project ID: `rxtmnbcewprzfgkvehsq`
- Access Token: `sbp_5b2b400e9dc44635fb0cd11bca9c7e5ee697e1f5`

### Para ejecutar SQL via API:
```bash
PROJECT_REF="rxtmnbcewprzfgkvehsq"
ACCESS_TOKEN="sbp_5b2b400e9dc44635fb0cd11bca9c7e5ee697e1f5"

curl -s -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT 1;"}'
```

---

## PRÓXIMO PASO AL REINICIAR:

El usuario tiene un documento de arquitectura enterprise completo que quiere implementar.
Incluye:
- PostgreSQL + PostGIS
- Martin Tile Server
- Meilisearch
- Frontend con MapLibre + Zustand

**Esperar instrucciones del usuario con el prompt de implementación.**

---

## ARCHIVOS IMPORTANTES:

- `MAPS_MIGRATION.md` - Estado de la migración
- `scripts/CLEANUP_MAPS_SQL.sql` - SQL de limpieza (ya ejecutado)
- `.claude/settings.json` - Permisos configurados

---

## NOTAS:

- El build pasa sin errores
- Buscar.tsx tiene placeholder temporal
- PropertyMap.tsx (detalle) NO se toca - usa Google Maps
- PostGIS ya está habilitado (v3.3.7)
