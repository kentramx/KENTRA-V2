

# Plan: Fix Map Performance - Client-Side Clustering

## Problem Identified

The `get_map_clusters` RPC is timing out because:
- It needs to GROUP BY 160,000+ rows
- PostgreSQL can't use indexes efficiently for aggregation
- Even state-level aggregation takes 5+ seconds
- Supabase has a ~8 second statement timeout

**Network Evidence:**
```
Status: 500
Error: "canceling statement due to statement timeout" (code 57014)
```

## Solution: Client-Side Clustering with Supercluster

Instead of server-side clustering (which requires expensive aggregation), we'll:

1. **Fetch individual property points** (fast - uses GIST index, 40ms for 500 rows)
2. **Cluster on the client** using Supercluster library (used by Mapbox, handles millions of points at 60fps)
3. **Dynamically re-cluster** as user zooms/pans

This is the approach used by Airbnb, Zillow, and other enterprise real estate platforms.

---

## Changes Required

### 1. Install Supercluster
```bash
npm install supercluster
```

### 2. Modify `src/hooks/useMapData.ts`

Remove the cluster mode branch entirely. Always fetch individual properties:

```typescript
// BEFORE: Tries to use get_map_clusters (times out)
const useClusterMode = zoom < MEXICO_CONFIG.clusterThreshold;
if (useClusterMode) {
  // Calls get_map_clusters RPC → TIMES OUT
}

// AFTER: Always fetch properties, cluster on client
const { data, error } = await supabase.rpc('get_map_data', {
  p_bounds_north: bounds.north,
  // ...
  p_limit: 2000  // Increased limit for better clustering
});

// Let SearchMap handle clustering with Supercluster
```

### 3. Modify `src/components/search/SearchMap.tsx`

Add Supercluster integration:

```typescript
import Supercluster from 'supercluster';

// Create cluster index
const clusterIndex = useMemo(() => {
  const index = new Supercluster({
    radius: 60,
    maxZoom: 14,
    minPoints: 2
  });
  
  // Convert properties to GeoJSON features
  const points = properties.map(p => ({
    type: 'Feature',
    properties: { ...p },
    geometry: { type: 'Point', coordinates: [p.lng, p.lat] }
  }));
  
  index.load(points);
  return index;
}, [properties]);

// Get clusters for current viewport
const clusters = useMemo(() => {
  if (!viewport || !clusterIndex) return [];
  const bbox = [bounds.west, bounds.south, bounds.east, bounds.north];
  return clusterIndex.getClusters(bbox, Math.floor(viewport.zoom));
}, [viewport, clusterIndex]);
```

### 4. Modify `src/types/map.ts`

Update `clusterThreshold` behavior - it now controls client-side clustering display:

```typescript
export const MEXICO_CONFIG = {
  // ...
  clusterThreshold: 14 // Show individual markers at zoom 14+
} as const;
```

### 5. Keep RPC Simple

The `get_map_clusters` RPC can remain but won't be called. Optionally create a simpler version that just counts:

```sql
-- Simple count RPC (optional, for stats display)
CREATE OR REPLACE FUNCTION get_viewport_count(
  p_north float, p_south float, p_east float, p_west float
) RETURNS integer AS $$
  SELECT COUNT(*)::integer
  FROM properties
  WHERE status = 'activa'
    AND geom && ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326);
$$ LANGUAGE sql STABLE;
```

---

## Architecture After Fix

```text
┌─────────────────┐
│   User Pan/Zoom │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  useMapData     │ ──── calls get_map_data RPC (40ms)
└────────┬────────┘       returns 500-2000 properties
         │
         ▼
┌─────────────────┐
│  Supercluster   │ ──── clusters on client (5ms)
└────────┬────────┘       returns clusters or individual points
         │
         ▼
┌─────────────────┐
│  SearchMap      │ ──── renders markers (16ms = 60fps)
└─────────────────┘
```

---

## Files to Modify

| # | File | Change |
|---|------|--------|
| 1 | `package.json` | Add supercluster dependency |
| 2 | `src/hooks/useMapData.ts` | Remove cluster mode, always fetch properties |
| 3 | `src/components/search/SearchMap.tsx` | Add Supercluster integration |
| 4 | `src/types/map.ts` | Update comments/threshold |

---

## Performance After Fix

| Metric | Before | After |
|--------|--------|-------|
| RPC call | Times out (>8s) | 40-100ms |
| Clustering | N/A | 5-10ms (client) |
| Total latency | Fails | ~100-150ms |
| FPS during zoom | N/A | 60fps |

---

## Alternative: Materialized View (Future Enhancement)

For even better performance at 5M+ properties, we could add:

```sql
-- Pre-computed clusters refreshed every 10 minutes
CREATE MATERIALIZED VIEW mv_property_clusters AS
SELECT 
  state,
  ST_Centroid(ST_Collect(geom)) as center,
  COUNT(*) as count,
  MIN(price) as min_price,
  MAX(price) as max_price
FROM properties
WHERE status = 'activa'
GROUP BY state;

CREATE UNIQUE INDEX ON mv_property_clusters(state);
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_property_clusters;
```

But client-side clustering with Supercluster is sufficient for 160K properties and simpler to implement.

---

## Estimated Time

| Phase | Time |
|-------|------|
| Install supercluster | 1 min |
| Update useMapData | 10 min |
| Update SearchMap | 15 min |
| Testing | 5 min |

**Total: ~30 minutes**

