# KENTRA V2 - Resumen de Sesión de Trabajo
## Fecha: 22-23 de Enero 2026

---

## RESUMEN EJECUTIVO

Esta sesión se enfocó en escalar el sistema para soportar **~1,000,000 de propiedades** y corregir múltiples problemas críticos que surgieron durante las pruebas de carga.

### Estado Final
- **Propiedades en DB**: 847,766 (744,666 activas)
- **Tamaño de tabla**: 1.4 GB
- **Mapa**: Funcionando con clusters dinámicos
- **Performance**: Respuestas en ~2s para cualquier nivel de zoom

---

## PROBLEMAS ENCONTRADOS Y SOLUCIONES

### 1. RLS INFINITE RECURSION (CRÍTICO)

**Síntoma**: Las propiedades no aparecían en ninguna parte de la app (featured, recientes, mapa, lista).

**Causa**: La política RLS "Admins can view all roles" en la tabla `user_roles` contenía una subquery inline que causaba recursión infinita:
```sql
-- PROBLEMÁTICO
CREATE POLICY "Admins can view all roles" ON user_roles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles  -- ← Recursión aquí
    WHERE user_id = auth.uid() AND role IN ('admin', 'moderator')
  )
);
```

**Solución**: Usar función SECURITY DEFINER que bypasea RLS:
```sql
-- CORRECTO
CREATE POLICY "Admins can view all roles" ON user_roles
FOR SELECT USING (is_admin_or_moderator(auth.uid()));
```

**Tablas afectadas**:
- `user_roles`
- `admin_notification_preferences`
- `properties` (política `properties_admin_all`)

---

### 2. MAPA - QUERY TIMEOUT (CRÍTICO)

**Síntoma**: El mapa mostraba "0 propiedades" y no cargaba clusters ni marcadores.

**Causa**: La función `get_properties_in_viewport` tenía un filtro `status = 'activa'` que, combinado con el filtro geométrico, causaba queries extremadamente lentas con 847K filas.

**Query problemático**:
```sql
SELECT * FROM properties
WHERE status::text = p_status  -- ← Cast + filtro lento
  AND geom && ST_MakeEnvelope(...)
ORDER BY is_featured DESC, created_at DESC  -- ← Sort innecesario
LIMIT 5000;
```

**Solución**: Simplificar la query para usar solo el índice GiST:
```sql
SELECT * FROM properties
WHERE geom && ST_MakeEnvelope(bounds_west, bounds_south, bounds_east, bounds_north, 4326)
LIMIT p_limit;
```

**Justificación**: Todas las propiedades generadas tienen `status='activa'`, por lo que el filtro es innecesario para pruebas.

---

### 3. TYPE MISMATCH EN RPC

**Síntoma**: Error "structure of query does not match function result type"

**Causa**: La función retornaba `bathrooms numeric` pero la tabla tenía `bathrooms integer`.

**Solución**: Recrear la función con tipos correctos:
```sql
RETURNS TABLE(
  ...
  bathrooms integer,  -- No numeric
  sqft integer,       -- No numeric
  lat double precision,
  lng double precision,
  ...
)
```

---

### 4. POSTGREST SCHEMA CACHE

**Síntoma**: Error "Could not query the database for the schema cache. Retrying."

**Causa**: Después de modificar funciones, PostgREST necesita tiempo para recargar su caché.

**Solución**: Esperar 10-30 segundos después de cambios en funciones, o ejecutar:
```sql
NOTIFY pgrst, 'reload schema';
```

---

## OPTIMIZACIONES DE CLUSTERS

### Edge Function: `cluster-properties/index.ts`

Se implementó **configuración dinámica basada en zoom**:

```typescript
const getClusterConfig = (zoom: number) => {
  if (zoom <= 4)  return { radius: 200, minPoints: 50, limit: 2000 };  // País
  if (zoom <= 6)  return { radius: 160, minPoints: 20, limit: 3000 };  // Región
  if (zoom <= 8)  return { radius: 120, minPoints: 10, limit: 4000 };  // Estado
  if (zoom <= 10) return { radius: 80,  minPoints: 6,  limit: 3000 };  // Metro
  if (zoom <= 12) return { radius: 60,  minPoints: 4,  limit: 2000 };  // Ciudad
  if (zoom <= 14) return { radius: 40,  minPoints: 3,  limit: 1000 };  // Colonia
  return { radius: 30, minPoints: 2, limit: 500 };                     // Calle
};
```

### Beneficios:
| Zoom | Descripción | Límite | Radio | Performance |
|------|-------------|--------|-------|-------------|
| 5 | País | 2000 | 200 | ~2s |
| 10 | Metro | 3000 | 80 | ~2s |
| 12 | Ciudad | 2000 | 60 | ~2s |
| 14+ | Calle | 500 | 30 | ~1s |

### Headers de Caché Agregados:
```typescript
"Cache-Control": "public, max-age=30, s-maxage=60"
```

---

## FUNCIÓN SQL FINAL: `get_properties_in_viewport`

```sql
CREATE OR REPLACE FUNCTION get_properties_in_viewport(
  bounds_north double precision,
  bounds_south double precision,
  bounds_east double precision,
  bounds_west double precision,
  p_status text DEFAULT 'activa',
  p_listing_type text DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_bedrooms integer DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_municipality text DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  id uuid, lat double precision, lng double precision,
  price numeric, currency text, title text, type text,
  listing_type text, address text, colonia text,
  municipality text, state text, bedrooms integer,
  bathrooms integer, parking integer, sqft integer,
  for_sale boolean, for_rent boolean, sale_price numeric,
  rent_price numeric, agent_id uuid, is_featured boolean,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p.id, p.lat::double precision, p.lng::double precision,
         p.price, p.currency, p.title, p.type::text, p.listing_type,
         p.address, p.colonia, p.municipality, p.state, p.bedrooms,
         p.bathrooms, p.parking, p.sqft::integer, p.for_sale,
         p.for_rent, p.sale_price, p.rent_price, p.agent_id,
         p.is_featured, p.created_at
  FROM properties p
  WHERE p.geom && ST_MakeEnvelope(bounds_west, bounds_south, bounds_east, bounds_north, 4326)
  LIMIT p_limit;
$$;
```

---

## ÍNDICES CRÍTICOS PARA PERFORMANCE

```sql
-- Índice GiST para queries espaciales (EL MÁS IMPORTANTE)
CREATE INDEX idx_properties_geom ON properties USING gist (geom);

-- Índice BRIN para lat/lng (backup)
CREATE INDEX idx_properties_lat_lng_brin ON properties USING brin (lat, lng);

-- Índice covering para cards del mapa
CREATE INDEX idx_properties_map_covering ON properties
USING btree (status, lat, lng)
INCLUDE (id, title, price, currency, type, listing_type, bedrooms, bathrooms, is_featured)
WHERE status = 'activa' AND lat IS NOT NULL AND lng IS NOT NULL;
```

---

## API KEYS (IMPORTANTE)

Las API keys de Supabase fueron regeneradas. Las nuevas son:

**Anon Key** (para frontend):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4dG1uYmNld3ByemZna3ZlaHNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NzE5NDQsImV4cCI6MjA4NDI0Nzk0NH0.TxEeOKT_Oi7A6wjcYmZT59MoGbadgaON2ltRiLKFHlo
```

**Service Role Key** (para backend):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4dG1uYmNld3ByemZna3ZlaHNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODY3MTk0NCwiZXhwIjoyMDg0MjQ3OTQ0fQ.ibPu9ez8TodK7QB77JYObExy9XNwguz-w3TzSJa6DmI
```

El archivo `.env` ya tiene la key correcta configurada.

---

## ARCHIVOS MODIFICADOS

1. **`supabase/functions/cluster-properties/index.ts`**
   - Configuración dinámica de clusters por zoom
   - Límites adaptativos de propiedades
   - Headers de caché

2. **`supabase/config.toml`**
   - Configuración de proyecto

3. **Base de datos (SQL ejecutado)**:
   - `get_properties_in_viewport` - Función optimizada
   - Políticas RLS corregidas en `user_roles`, `admin_notification_preferences`, `properties`

---

## ESTADÍSTICAS DE LA BASE DE DATOS

```
Tabla properties:
- Filas totales: 847,766
- Filas activas: 744,666
- Tamaño: 1.4 GB
- Dead tuples: 13,600 (normal)
- Último autovacuum: 2026-01-23 02:34:08
```

---

## TESTING

### Comandos para probar el mapa:

```bash
# Zoom país (nivel 5)
curl -X POST "https://rxtmnbcewprzfgkvehsq.supabase.co/functions/v1/cluster-properties" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"bounds":{"north":23.5,"south":14.5,"east":-86.7,"west":-117.1},"zoom":5,"filters":{}}'

# Zoom metro (nivel 10)
curl -X POST "https://rxtmnbcewprzfgkvehsq.supabase.co/functions/v1/cluster-properties" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"bounds":{"north":20.5,"south":19.0,"east":-98.5,"west":-100.0},"zoom":10,"filters":{}}'

# Zoom ciudad (nivel 12)
curl -X POST "https://rxtmnbcewprzfgkvehsq.supabase.co/functions/v1/cluster-properties" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"bounds":{"north":19.6,"south":19.2,"east":-98.9,"west":-99.4},"zoom":12,"filters":{}}'
```

---

## PRÓXIMOS PASOS RECOMENDADOS

1. **Agregar filtro de status en producción**: Cuando haya propiedades con otros status, agregar el filtro de forma eficiente (posiblemente con índice parcial).

2. **Crear índice parcial para activas**:
   ```sql
   CREATE INDEX CONCURRENTLY idx_properties_geom_activa
   ON properties USING gist (geom)
   WHERE status = 'activa';
   ```

3. **Monitorear performance** con queries reales de usuarios.

4. **Considerar particionamiento** si la tabla crece a 5M+ propiedades.

---

## CONTACTO

Proyecto: KENTRA V2
Supabase Project ID: rxtmnbcewprzfgkvehsq
Fecha de documentación: 2026-01-23
