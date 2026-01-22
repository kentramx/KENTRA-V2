# Enterprise Scale Setup Guide

This document covers the infrastructure configuration required for 1,000,000+ properties.

## Prerequisites

All code optimizations have been implemented. This guide covers **infrastructure settings** in Supabase Dashboard.

---

## 1. Connection Pooling (PgBouncer)

### Why It's Needed
- Edge Functions create new database connections per request
- Without pooling, you'll hit connection limits at scale
- PgBouncer multiplexes connections efficiently

### Setup Steps

1. Go to **Supabase Dashboard** → **Project Settings** → **Database**
2. Scroll to **Connection Pooling**
3. Enable **PgBouncer**
4. Recommended settings:
   - Pool Mode: **Transaction**
   - Pool Size: **15-25** (based on your plan)
5. Use the **Pooler connection string** in production

### Connection String Format
```
# Direct connection (for migrations only)
postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

# Pooled connection (for application)
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

---

## 2. Read Replicas (Optional, Pro+ Plan)

### Why It's Needed
- Distributes read queries across multiple database instances
- Reduces latency for geographically distributed users
- Improves availability

### Setup Steps

1. Go to **Supabase Dashboard** → **Project Settings** → **Infrastructure**
2. Click **Add Read Replica**
3. Select region closest to your users
4. Update application to use replica for read-heavy queries

### Code Usage
```typescript
// The application already supports this via environment variables
// Set VITE_SUPABASE_REPLICA_URL for read-heavy operations
```

---

## 3. Image Transformations (CDN)

### Already Configured
- Supabase Storage uses Cloudflare CDN automatically
- Image transformation utility created at `src/lib/imageCdn.ts`

### Enable Transformations

1. Go to **Supabase Dashboard** → **Storage** → **Policies**
2. Ensure public buckets allow transformations
3. Use the utility functions:

```typescript
import { getPresetImageUrl, getResponsiveSrcSet } from '@/lib/imageCdn';

// Single optimized image
const thumbnailUrl = getPresetImageUrl(imageUrl, 'thumbnail');

// Responsive srcset
const srcSet = getResponsiveSrcSet(imageUrl, [400, 800, 1200]);
```

---

## 4. Cron Jobs for Materialized Views

### Setup pg_cron (Pro+ Plan)

1. Go to **Supabase Dashboard** → **Database** → **Extensions**
2. Enable **pg_cron** extension
3. Run the following SQL:

```sql
-- Refresh materialized views every 5 minutes
SELECT cron.schedule(
  'refresh-materialized-views',
  '*/5 * * * *',
  $$SELECT refresh_all_materialized_views()$$
);

-- Verify cron job
SELECT * FROM cron.job;
```

### Alternative: Use Edge Function + External Cron

If pg_cron isn't available, use an external cron service:

```bash
# Call every 5 minutes
curl -X POST https://[project-ref].supabase.co/functions/v1/refresh-materialized-views
```

Services: Vercel Cron, GitHub Actions, cron-job.org

---

## 5. Monitoring & Alerts

### Sentry (Already Configured)
- Frontend: Automatic error capture with session replays
- Edge Functions: Manual error capture

### Database Health Endpoint

```bash
# Check database health
curl https://[project-ref].supabase.co/functions/v1/database-health

# Response (admin gets detailed view with Authorization header)
{
  "status": "healthy",
  "latency_ms": 45,
  "active_properties": 150000,
  "timestamp": "2026-01-22T20:00:00Z"
}
```

### Recommended Alerts (Supabase Dashboard)

1. **Database CPU** > 80% for 5 minutes
2. **Database Memory** > 85%
3. **Connection Count** > 80% of max
4. **Disk Usage** > 80%

---

## 6. Database Optimizations Applied

### Indexes Created
| Index | Purpose |
|-------|---------|
| `idx_properties_search_vector_gin` | Full-text search |
| `idx_properties_state_municipality` | Location filtering |
| `idx_properties_listing_price_sort` | Price sorting |
| `idx_properties_status_featured_created` | Newest + featured |
| `idx_properties_bedrooms_price_type` | Common filter combo |
| `idx_properties_agent_status_count` | Subscription limits |
| `idx_properties_card_covering` | Property cards (index-only scan) |
| `idx_properties_map_covering` | Map markers (index-only scan) |

### Materialized Views
| View | Refresh Frequency | Purpose |
|------|-------------------|---------|
| `mv_global_stats` | 5 minutes | Homepage stats |
| `mv_property_counts_by_status` | 5 minutes | Admin dashboard |

### RPC Functions
| Function | Purpose |
|----------|---------|
| `search_properties_cursor` | O(1) cursor pagination |
| `get_user_conversations` | Eliminate N+1 |
| `get_user_favorites` | Paginated favorites |
| `get_global_stats_cached` | Cached stats |
| `get_database_health` | Health monitoring |
| `get_agent_property_counts` | Fast limit checks |
| `batch_update_property_status` | Admin bulk ops |

---

## 7. Performance Checklist

### Before Going to 1M

- [ ] Enable PgBouncer connection pooling
- [ ] Configure pg_cron for materialized view refresh
- [ ] Set up monitoring alerts
- [ ] Test with load testing tool (k6, Artillery)
- [ ] Verify cache hit ratios > 90%

### Monitoring Queries

```sql
-- Check cache hit ratio (should be > 95%)
SELECT
  ROUND(100.0 * sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) as cache_hit_ratio
FROM pg_statio_user_tables;

-- Check index usage (should be > 95%)
SELECT
  ROUND(100.0 * sum(idx_scan) / nullif(sum(idx_scan) + sum(seq_scan), 0), 2) as index_usage_ratio
FROM pg_stat_user_tables;

-- Find missing indexes
SELECT
  schemaname, tablename, seq_scan, seq_tup_read,
  idx_scan, idx_tup_fetch
FROM pg_stat_user_tables
WHERE seq_scan > idx_scan
ORDER BY seq_tup_read DESC
LIMIT 10;
```

---

## 8. Scaling Beyond 1M

When approaching 5M+ properties, consider:

1. **Table Partitioning** - Partition properties by status or date range
2. **Dedicated Search Service** - Meilisearch or Elasticsearch
3. **Database Upgrade** - Move to larger Supabase plan
4. **Multi-Region** - Add read replicas in additional regions
5. **Archive Old Data** - Move expired properties to archive table

---

## Support

For issues with scaling, check:
1. Supabase Dashboard → Logs → Edge Functions
2. Supabase Dashboard → Reports → Database
3. Sentry Dashboard for application errors

Contact: [Your support email]
