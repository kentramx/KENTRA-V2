# Fase 3: Integración de Upstash Redis Cache

## Estado Actual
✅ **Sentry implementado** - Monitoreo de errores y performance activo
⏳ **Upstash pendiente** - Requiere credenciales

---

## ¿Qué es Upstash?

Upstash es un servicio de Redis serverless que permite implementar cache distribuido y rate limiting sin gestionar infraestructura. Ideal para:

- **Cache de consultas frecuentes** (propiedades destacadas, estadísticas)
- **Rate limiting avanzado** (límites por IP, usuario, endpoint)
- **Sessions y tokens** (almacenamiento temporal de sesiones)
- **Contadores en tiempo real** (views, clicks, métricas)

---

## Implementación Planeada

### 1. Configuración de Secrets

Necesitarás obtener de Upstash:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

**Pasos:**
1. Registrarte en [console.upstash.com](https://console.upstash.com/)
2. Crear una nueva base de datos Redis
3. Copiar las credenciales REST API
4. Configurar los secrets en Lovable

### 2. Edge Functions con Cache

Implementaremos cache en:

#### `get-properties-cached`
```typescript
// Cachear listados de propiedades por 5 minutos
const cacheKey = `properties:${filters}`;
const cached = await redis.get(cacheKey);
if (cached) return cached;

const data = await supabase.from('properties').select();
await redis.setex(cacheKey, 300, JSON.stringify(data));
```

#### `property-stats-cached`
```typescript
// Cachear estadísticas globales por 1 hora
const stats = await redis.get('stats:global');
if (!stats) {
  const computed = await computeStats();
  await redis.setex('stats:global', 3600, JSON.stringify(computed));
}
```

### 3. Rate Limiting Avanzado

Reemplazar el rate limiting actual con Upstash:

```typescript
// Rate limit por IP y usuario combinados
const key = `ratelimit:${endpoint}:${userId || ip}`;
const count = await redis.incr(key);

if (count === 1) {
  await redis.expire(key, 60); // Window de 60 segundos
}

if (count > limit) {
  return new Response('Rate limit exceeded', { status: 429 });
}
```

### 4. Invalidación de Cache

Sistema para invalidar cache cuando se modifica data:

```typescript
// Después de crear/actualizar propiedad
await redis.del(`property:${propertyId}`);
await redis.del('properties:*'); // Wildcard delete
await redis.del('stats:global');
```

### 5. Métricas en Tiempo Real

Contadores atómicos con Upstash:

```typescript
// Incrementar views de propiedad
await redis.hincrby('property:views', propertyId, 1);

// Obtener top 10 propiedades más vistas
const topViewed = await redis.hgetall('property:views');
```

---

## Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────┐
│                   Frontend React                    │
│  (Sentry monitoring para errores de frontend)      │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│              Edge Functions (Deno)                  │
│  • Sentry DSN para backend errors                  │
│  • Upstash Redis para cache y rate limiting        │
├─────────────────────────────────────────────────────┤
│  Flujo típico:                                      │
│  1. Check Redis cache                              │
│  2. Si hit → return cached                         │
│  3. Si miss → query Supabase                       │
│  4. Store en cache                                 │
│  5. Log a Sentry si hay error                      │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│            Supabase PostgreSQL                      │
│  (Fuente de verdad, RLS policies activas)         │
└─────────────────────────────────────────────────────┘
```

---

## Beneficios Esperados

### Performance
- **Reducción 60-80%** en latencia de queries repetitivas
- **Menos carga** en PostgreSQL
- **Respuestas sub-100ms** para data cacheada

### Escalabilidad
- Soportar **10x más requests** sin aumentar costos de DB
- Rate limiting distribuido entre edge functions
- Cache compartido globalmente

### Confiabilidad
- Fallback automático a DB si Redis falla
- Logs de cache hit/miss en Sentry
- TTL automático para evitar data stale

---

## Próximos Pasos

1. **Obtener credenciales de Upstash**
   - Crear cuenta
   - Crear database
   - Copiar REST URL y Token

2. **Configurar secrets**
   ```
   UPSTASH_REDIS_REST_URL
   UPSTASH_REDIS_REST_TOKEN
   ```

3. **Implementar edge functions**
   - Cache layer en properties endpoint
   - Rate limiting mejorado
   - Stats caching

4. **Monitorear con Sentry**
   - Cache hit rate
   - Redis errors
   - Performance improvements

---

## Estimación de Costos

### Upstash Free Tier
- ✅ 10,000 comandos/día gratis
- ✅ 256 MB storage
- ✅ Suficiente para validación y desarrollo

### Upstash Pro (si escala)
- $0.20 por 100k comandos
- Estimado: **$10-30/mes** para tráfico medio
- ROI positivo vs aumentar Supabase tier

---

## Referencias

- [Upstash Docs](https://docs.upstash.com/)
- [Upstash + Deno](https://docs.upstash.com/redis/howto/connectwithdeno)
- [Rate Limiting con Upstash](https://upstash.com/docs/redis/features/ratelimiting)
- [Cache Patterns](https://upstash.com/docs/redis/tutorials/caching)

---

**Estado:** 📋 Documentado, listo para implementar cuando tengas credenciales
