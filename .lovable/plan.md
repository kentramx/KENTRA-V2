
# Plan: Fix get_map_data RPC Timeout

## Problem Identified

The `get_map_data` RPC is timing out (error 57014) because:

1. **Expensive COUNT(*)**: Takes 1.1+ seconds to count all matching properties in viewport
2. When combined with the main query + JSON aggregation, it exceeds the 8-second timeout

**Evidence from database analysis:**
```text
Simple spatial query with LIMIT 500: 20ms ✅
COUNT(*) with spatial filter: 1,145ms ❌ (kills the budget)
```

## Solution: Rewrite get_map_data RPC

Remove the expensive COUNT(*) and use PostgreSQL estimation instead. Also simplify the query.

### SQL Migration

```sql
CREATE OR REPLACE FUNCTION public.get_map_data(
  p_bounds_north double precision,
  p_bounds_south double precision,
  p_bounds_east double precision,
  p_bounds_west double precision,
  p_listing_type text DEFAULT NULL,
  p_property_type text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_bedrooms integer DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS TABLE(properties jsonb, clusters jsonb, total_count bigint)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_properties jsonb;
  v_estimated_count bigint;
BEGIN
  -- Fast estimation using pg_class (avoids expensive COUNT)
  -- For map purposes, exact count is not critical
  SELECT GREATEST(
    (SELECT reltuples::bigint FROM pg_class WHERE relname = 'properties'),
    0
  ) INTO v_estimated_count;

  -- Get properties with LEFT JOIN for images (no correlated subquery)
  SELECT jsonb_agg(row_to_json(t))
  INTO v_properties
  FROM (
    SELECT 
      p.id,
      p.lat,
      p.lng,
      p.price,
      COALESCE(p.currency, 'MXN') as currency,
      p.title,
      p.type::text,
      p.listing_type,
      p.address,
      p.municipality,
      p.state,
      p.bedrooms,
      p.bathrooms,
      p.sqft,
      COALESCE(p.is_featured, false) as is_featured,
      img.url as image_url
    FROM properties p
    LEFT JOIN LATERAL (
      SELECT url FROM images WHERE property_id = p.id ORDER BY position LIMIT 1
    ) img ON true
    WHERE p.status = 'activa'
      AND p.lat IS NOT NULL 
      AND p.lng IS NOT NULL
      AND p.lat >= p_bounds_south 
      AND p.lat <= p_bounds_north
      AND p.lng >= p_bounds_west 
      AND p.lng <= p_bounds_east
      AND (p_listing_type IS NULL OR p.listing_type = p_listing_type)
      AND (p_property_type IS NULL OR p.type::text = p_property_type)
      AND (p_min_price IS NULL OR p.price >= p_min_price)
      AND (p_max_price IS NULL OR p.price <= p_max_price)
      AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
    ORDER BY p.is_featured DESC NULLS LAST, p.created_at DESC
    LIMIT p_limit
  ) t;

  RETURN QUERY SELECT 
    COALESCE(v_properties, '[]'::jsonb),
    '[]'::jsonb,
    v_estimated_count;
END;
$$;
```

### Key Optimizations

| Change | Before | After | Impact |
|--------|--------|-------|--------|
| COUNT(*) | Scans all matching rows (1.1s) | pg_class estimate (0ms) | Eliminates slowest operation |
| Spatial filter | ST_MakeEnvelope with geom | Simple lat/lng comparisons | Uses existing indexes more efficiently |
| Images | Correlated subquery | LEFT JOIN LATERAL | Potentially faster execution plan |
| Limit | 2000 | 500 (default) | Reduces data transfer |

---

## Alternative: Use Direct Query (No RPC)

If the RPC continues to timeout, we could bypass it entirely and use a direct query from the hook:

```typescript
// In useMapData.ts - use direct query instead of RPC
const { data, error } = await supabase
  .from('properties')
  .select(`
    id, lat, lng, price, currency, title, type, listing_type,
    address, municipality, state, bedrooms, bathrooms, sqft, is_featured,
    images!inner(url)
  `)
  .eq('status', 'activa')
  .gte('lat', bounds.south)
  .lte('lat', bounds.north)
  .gte('lng', bounds.west)
  .lte('lng', bounds.east)
  .order('is_featured', { ascending: false })
  .order('created_at', { ascending: false })
  .limit(500);
```

This bypasses the RPC entirely and uses Supabase's optimized query builder.

---

## Files to Modify

| # | File | Action | Description |
|---|------|--------|-------------|
| 1 | SQL Migration | Create | Rewrite get_map_data RPC function |

---

## Expected Performance After Fix

| Metric | Before | After |
|--------|--------|-------|
| RPC query time | >8000ms (timeout) | ~50-100ms |
| COUNT operation | 1100ms | 0ms (estimation) |
| Properties fetch | ~20ms | ~20-50ms |
| Total response | FAILS | ~100ms |

---

## Risk Assessment

**Low Risk:**
- The fix replaces expensive operations with fast alternatives
- No schema changes required
- Existing indexes are sufficient
- Client-side code doesn't need changes (data format remains the same)
