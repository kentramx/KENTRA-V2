

# Plan: Sistema de Mapas Enterprise para Kentra

## Resumen Ejecutivo

Implementar el sistema de búsqueda con mapas interactivos, corrigiendo primero los errores de build y actualizando la función RPC de clustering para usar PostGIS puro en lugar de geohashes.

---

## Estado Actual Verificado

| Componente | Estado | Acción Requerida |
|------------|--------|------------------|
| `get_map_data` RPC | ✅ Funciona | Ninguna |
| `get_map_clusters` RPC | ❌ Rota (usa geohash_*) | Reescribir con PostGIS |
| `src/components/native/index.ts` | ❌ Export inexistente | Eliminar línea |
| `src/hooks/useHomeProperties.ts` | ❌ Columna `slug` no existe | Remover de queries |
| Columna `geom` | ✅ Existe | Ninguna |
| Índices GIST | ✅ 3 activos | Ninguna |
| MapLibre GL | ❌ No instalado | Instalar |

---

## FASE 0: Corregir Errores de Build

### Archivo 1: `src/components/native/index.ts`
Eliminar export de `LocationButton` que no existe.

### Archivo 2: `src/hooks/useHomeProperties.ts`
Remover `slug` de ambas queries SELECT (líneas 21 y 57).

---

## FASE 0.5: Arreglar RPC de Clustering

La función `get_map_clusters` está rota porque depende de columnas `geohash_3`, `geohash_4`, etc. que ya no existen. Necesitamos reescribirla usando PostGIS puro con `ST_SnapToGrid`.

### Migración SQL: Reemplazar `get_map_clusters`

```sql
CREATE OR REPLACE FUNCTION public.get_map_clusters(
  p_north double precision,
  p_south double precision,
  p_east double precision,
  p_west double precision,
  p_precision integer DEFAULT 5,
  p_listing_type text DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_bedrooms integer DEFAULT NULL
)
RETURNS TABLE(
  id text,
  count bigint,
  lat double precision,
  lng double precision,
  min_price numeric,
  max_price numeric
)
LANGUAGE sql
STABLE PARALLEL SAFE
AS $$
  WITH grid_size AS (
    SELECT CASE p_precision
      WHEN 3 THEN 2.0      -- ~200km (país)
      WHEN 4 THEN 0.5      -- ~50km (región)
      WHEN 5 THEN 0.1      -- ~10km (ciudad)
      WHEN 6 THEN 0.02     -- ~2km (zona)
      ELSE 0.1
    END as size
  )
  SELECT
    -- Generar ID único basado en grid
    'cluster_' || 
      FLOOR(lng / g.size)::text || '_' || 
      FLOOR(lat / g.size)::text as id,
    COUNT(*)::bigint as count,
    AVG(lat)::float as lat,
    AVG(lng)::float as lng,
    MIN(price) as min_price,
    MAX(price) as max_price
  FROM properties p, grid_size g
  WHERE p.status = 'activa'
    AND p.lat IS NOT NULL AND p.lng IS NOT NULL
    AND p.lat >= p_south AND p.lat <= p_north
    AND p.lng >= p_west AND p.lng <= p_east
    AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
    AND (p_property_type IS NULL OR p.type::text = p_property_type)
    AND (p_min_price IS NULL OR p.price >= p_min_price)
    AND (p_max_price IS NULL OR p.price <= p_max_price)
    AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
  GROUP BY 
    FLOOR(p.lng / g.size),
    FLOOR(p.lat / g.size),
    g.size
  HAVING COUNT(*) > 0
  ORDER BY count DESC
  LIMIT 200;
$$;
```

Esta versión:
- Usa división por grid en lugar de geohashes
- No requiere columnas adicionales
- Mantiene la misma interfaz de parámetros
- Es O(n) con el índice existente de lat/lng

---

## FASE 1: Tipos y Store

### Archivo 3: `src/types/map.ts` (NUEVO)
Tipos centralizados para el sistema de mapas incluyendo:
- `MapViewport` (bounds, zoom, center)
- `MapFilters` (listing_type, property_type, precio, recámaras)
- `MapCluster` (id, count, lat, lng, precio min/max)
- `MapPropertyMarker` (datos completos para marcadores)
- `MEXICO_CONFIG` (bounds, centro, zooms)

### Archivo 4: `src/stores/mapStore.ts` (NUEVO)
Store Zustand con `subscribeWithSelector` para:
- Estado del viewport
- Filtros de búsqueda
- Datos del mapa (clusters o propiedades)
- Lista paginada
- UI (selected, hovered, loading, error)
- Acciones (setViewport, updateFilter, setPage, etc.)

---

## FASE 2: Hooks de Datos

### Archivo 5: `src/hooks/useMapData.ts` (NUEVO)
Hook principal que:
- Detecta zoom para decidir modo (clusters vs propiedades)
- Zoom < 12: Llama `get_map_clusters` con precisión según zoom
- Zoom >= 12: Llama `get_map_data` para propiedades individuales
- Implementa debounce de 300ms para pan/zoom
- Maneja cancelación de requests anteriores
- Actualiza el store con los resultados

---

## FASE 3: Componentes de Búsqueda

### Archivo 6: `src/components/search/SearchMap.tsx` (NUEVO)
Mapa interactivo con MapLibre GL:
- Estilo CARTO Positron (gratuito, limpio)
- Bounds restringidos a México
- Evento `moveend` actualiza viewport
- Renderizado de clusters (círculos con conteo)
- Renderizado de marcadores de precio (pills)
- Click en cluster → zoom al área
- Hover sincronizado con lista

### Archivo 7: `src/components/search/SearchFilters.tsx` (NUEVO)
Barra de filtros horizontal:
- Toggle Venta/Renta
- Dropdown tipo de propiedad (usa `PROPERTY_TYPES`)
- Inputs precio min/max
- Selector de recámaras (1+, 2+, 3+, 4+)
- Contador de resultados
- Botón limpiar filtros

### Archivo 8: `src/components/search/SearchPropertyList.tsx` (NUEVO)
Lista lateral:
- Scroll virtualizado con react-window
- PropertyCards compactas
- Hover sincronizado con mapa
- Paginación
- Skeletons durante carga

### Archivo 9: `src/components/search/SearchPropertyCard.tsx` (NUEVO)
Tarjeta compacta para la lista:
- Imagen principal
- Precio formateado (K/M)
- Ubicación
- Características (recámaras, baños, m²)
- Estados hover/selected

### Archivo 10: `src/components/search/index.ts` (NUEVO)
Barrel exports para los componentes.

---

## FASE 4: Página de Búsqueda

### Archivo 11: `src/pages/Buscar.tsx` (REESCRIBIR)
Layout completo:

```text
┌─────────────────────────────────────────────────────────────┐
│ Navbar                                                       │
├─────────────────────────────────────────────────────────────┤
│ SearchFilters (barra horizontal de filtros)                 │
├──────────────────────────┬──────────────────────────────────┤
│ SearchPropertyList       │ SearchMap                        │
│ (30% width, scroll)      │ (70% width, fixed)               │
│                          │                                  │
│ - PropertyCards          │ - Clusters / Markers             │
│ - Paginación             │ - Interactivo                    │
└──────────────────────────┴──────────────────────────────────┘
```

**Responsive (Mobile):**
- Mapa fullscreen
- Drawer inferior con Vaul para lista
- Toggle flotante mapa/lista

---

## FASE 5: Estilos CSS

### Archivo 12: `src/index.css` (AGREGAR AL FINAL)
Estilos para marcadores del mapa:
- `.map-cluster-marker` - círculos con conteo
- `.cluster-circle` - tamaño dinámico según count
- `.map-property-marker` - contenedor del pill
- `.price-pill` - pill con precio (venta/renta colores)
- Estados `:hover`, `.hovered`, `.selected`

---

## Dependencia a Instalar

```bash
npm install maplibre-gl
```

MapLibre GL incluye tipos TypeScript integrados.

---

## Diagrama de Arquitectura

```text
┌─────────────────┐
│   Usuario       │
│ (pan/zoom/filter)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   mapStore      │ ◄── Zustand (subscribeWithSelector)
│                 │
│ viewport        │
│ filters         │
│ clusters[]      │
│ properties[]    │
│ UI states       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  useMapData     │ ◄── Hook con debounce 300ms
│                 │
│ zoom < 12?      │─────────┐
│     │           │         │
│     ▼           │         ▼
│ get_map_clusters│    get_map_data
│ (PostGIS grid)  │    (propiedades)
└────────┬────────┘         │
         │                  │
         ▼                  ▼
┌─────────────────────────────────────┐
│        PostgreSQL + PostGIS         │
│  ~160,000 propiedades activas       │
│  3 índices GIST en columna geom     │
└─────────────────────────────────────┘
```

---

## Lista de Archivos a Modificar/Crear

| # | Archivo | Acción | Descripción |
|---|---------|--------|-------------|
| 1 | `src/components/native/index.ts` | Modificar | Eliminar export LocationButton |
| 2 | `src/hooks/useHomeProperties.ts` | Modificar | Remover `slug` de queries |
| 3 | Migración SQL | Crear | Reescribir `get_map_clusters` |
| 4 | `src/types/map.ts` | Crear | Tipos del sistema de mapas |
| 5 | `src/stores/mapStore.ts` | Crear | Store Zustand |
| 6 | `src/hooks/useMapData.ts` | Crear | Hook de datos |
| 7 | `src/components/search/SearchMap.tsx` | Crear | Mapa MapLibre |
| 8 | `src/components/search/SearchFilters.tsx` | Crear | Barra de filtros |
| 9 | `src/components/search/SearchPropertyList.tsx` | Crear | Lista lateral |
| 10 | `src/components/search/SearchPropertyCard.tsx` | Crear | Tarjeta compacta |
| 11 | `src/components/search/index.ts` | Crear | Barrel exports |
| 12 | `src/pages/Buscar.tsx` | Reescribir | Página completa |
| 13 | `src/index.css` | Agregar | Estilos de marcadores |

---

## Criterios de Éxito

1. Build sin errores TypeScript
2. Mapa carga centrado en México < 1 segundo
3. Zoom < 12 muestra clusters con conteo
4. Zoom >= 12 muestra marcadores de precio
5. Click en cluster hace zoom al área
6. Hover sincroniza mapa ↔ lista
7. Filtros actualizan resultados < 300ms
8. Performance 60fps durante navegación
9. Mobile: drawer inferior funcional
10. RPC queries < 200ms

---

## Estimación de Tiempo

| Fase | Tiempo |
|------|--------|
| Fase 0: Fix build errors | 2 min |
| Fase 0.5: Migración RPC | 3 min |
| Fase 1: Tipos y Store | 10 min |
| Fase 2: Hook de datos | 8 min |
| Fase 3: Componentes | 20 min |
| Fase 4: Página Buscar | 5 min |
| Fase 5: Estilos | 3 min |

**Total estimado:** ~50 minutos

