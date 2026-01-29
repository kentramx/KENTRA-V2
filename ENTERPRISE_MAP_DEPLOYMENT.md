# Enterprise Map Architecture - Deployment Guide

Este documento contiene los pasos para desplegar la arquitectura enterprise de mapas con Deck.gl + geohash clustering.

> **Nota**: La extensión H3 no está disponible en Supabase. Se usa geohash como alternativa con la misma funcionalidad.

## Resumen de Cambios

### Archivos Creados

| Archivo | Descripción |
|---------|-------------|
| `supabase/migrations/20260129_h3_infrastructure.sql` | Extensión H3, columnas, triggers |
| `supabase/migrations/20260129_h3_materialized_views.sql` | Vistas materializadas para clusters |
| `supabase/migrations/20260129_martin_tile_functions.sql` | Funciones MVT para Martin |
| `infrastructure/martin/` | Configuración del tile server |
| `src/components/search/SearchMapEnterprise.tsx` | Componente Deck.gl |
| `supabase/functions/property-search-h3/index.ts` | Edge function H3 |

### Dependencias Instaladas
- `deck.gl`, `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/mapbox`, `@deck.gl/geo-layers`
- `h3-js`

---

## Paso 1: Habilitar Extensión H3 en Supabase

**IMPORTANTE**: La extensión H3 debe habilitarse manualmente en Supabase.

1. Ve al dashboard de Supabase: https://supabase.com/dashboard/project/rxtmnbcewprzfgkvehsq
2. Navega a **Database** → **Extensions**
3. Busca y habilita:
   - `h3` - H3 hexagonal indexing
   - `h3_postgis` - H3 PostGIS integration
   - `postgis` (si no está habilitado)

Si H3 no está disponible, contacta soporte de Supabase.

---

## Paso 2: Desplegar Migraciones SQL

### Opción A: Via Supabase CLI

```bash
# Autenticarse
supabase login

# Push migraciones
cd /root/projects/kentra
supabase db push
```

### Opción B: Via SQL Editor

Si la CLI no funciona, ejecuta las migraciones manualmente:

1. Ve a **SQL Editor** en el dashboard
2. Ejecuta en orden:
   - `20260129_h3_infrastructure.sql`
   - `20260129_h3_materialized_views.sql`
   - `20260129_martin_tile_functions.sql`

---

## Paso 3: Poblar Datos Geohash Existentes

Una vez aplicadas las migraciones, los triggers poblarán automáticamente las columnas geohash para nuevas propiedades. Para propiedades existentes:

1. Abre el **SQL Editor** en Supabase Dashboard
2. Copia y ejecuta el contenido de `scripts/populate_geohash_7_8.sql`
3. Repite hasta que veas "0 rows updated"
4. Esto puede tomar varias ejecuciones para ~180k propiedades

```sql
-- O ejecutar este script directamente (procesa 50k filas por ejecución)
-- Ver scripts/populate_geohash_7_8.sql para el script completo
```

---

## Paso 4: Refrescar Vistas Materializadas

```sql
-- Ejecutar después de poblar geohash_7/geohash_8
REFRESH MATERIALIZED VIEW mv_geohash_clusters_7;
REFRESH MATERIALIZED VIEW mv_geohash_clusters_7_all;
```

Para refrescar periódicamente (cada 5-15 minutos), configura un cron job en Supabase:

```sql
-- En Database → Extensions → pg_cron
SELECT cron.schedule(
  'refresh-geohash-clusters',
  '*/10 * * * *',  -- Cada 10 minutos
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_geohash_clusters_7$$
);
```

---

## Paso 5: Desplegar Martin Tile Server (Opcional)

Martin proporciona vector tiles directamente desde PostGIS. Es opcional pero mejora el rendimiento.

### Autenticarse en Fly.io

```bash
export PATH="$HOME/.fly/bin:$PATH"
fly auth login
```

### Crear App y Configurar Secretos

```bash
cd /root/projects/kentra/infrastructure/martin

# Crear app
fly apps create kentra-tiles

# Configurar base de datos
fly secrets set DATABASE_URL="postgres://postgres:[PASSWORD]@db.rxtmnbcewprzfgkvehsq.supabase.co:5432/postgres?sslmode=require"
```

### Desplegar

```bash
fly deploy
```

### Verificar

```bash
# Ver estado
fly status

# Ver logs
fly logs

# Probar endpoint
curl https://kentra-tiles.fly.dev/health
```

---

## Paso 6: Configurar Frontend

### Variable de Entorno (solo si se usa Martin)

Agrega en `.env`:

```bash
VITE_MARTIN_URL=https://kentra-tiles.fly.dev
```

### Desplegar Edge Function

```bash
supabase functions deploy property-search-h3
```

---

## Paso 7: Verificar Funcionamiento

1. **Abre la aplicación** y navega a `/buscar`
2. **Verifica la consola** del navegador para ver mensajes de Deck.gl
3. **En modo desarrollo**, verás un badge morado con el modo actual (clusters/properties)

### Indicadores de Éxito

- [ ] Mapa carga sin errores
- [ ] Clusters se muestran con conteos
- [ ] Click en cluster hace zoom
- [ ] Zoom alto (14+) muestra precios individuales
- [ ] Filtros funcionan correctamente

---

## Troubleshooting

### "H3 extension not found"
- Habilita la extensión en Supabase Dashboard → Database → Extensions

### "Materialized view does not exist"
- Ejecuta las migraciones SQL en orden correcto
- Ejecuta `SELECT refresh_h3_clusters()`

### Markers no aparecen en el mapa
- Verifica en consola: debe mostrar `[SearchMapEnterprise] Map loaded`
- Verifica que hay datos: `mode: clusters, clustersCount: X`

### Performance lenta
- Verifica que las vistas materializadas están pobladas
- Ejecuta `ANALYZE mv_h3_clusters_res6;` para actualizar estadísticas

---

## Arquitectura Final

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  MapLibre   │◄───│   Deck.gl   │◄───│   Zustand   │         │
│  │  (base map) │    │ (WebGL GPU) │    │   (state)   │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE EDGE FUNCTIONS                       │
│              property-search-h3 (H3 clustering)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    POSTGRESQL + POSTGIS + H3                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ properties  │  │ H3 indexes  │  │ Materialized│             │
│  │   table     │  │ (res 4-9)   │  │   Views     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Métricas Esperadas

| Métrica | Objetivo |
|---------|----------|
| Carga inicial | < 500ms |
| Respuesta de clusters | < 100ms |
| Renderizado (60fps) | > 10,000 puntos |
| Memoria del navegador | < 200MB |
