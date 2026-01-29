# Martin Tile Server for Kentra

This directory contains the configuration for [Martin](https://maplibre.org/martin/), a PostGIS vector tile server written in Rust.

## Overview

Martin serves vector tiles directly from PostgreSQL/PostGIS, enabling efficient rendering of millions of properties using:
- **H3 hexagonal clustering** for zoom levels 0-12
- **Individual properties** for zoom levels 13-18
- **Heat map hexagons** for density visualization

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   Martin    │────▶│  PostgreSQL │
│  (Deck.gl)  │◀────│ Tile Server │◀────│   PostGIS   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │                   │ MVT tiles
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│  Cloudflare │     │    CDN      │
│    Cache    │     │   (Edge)    │
└─────────────┘     └─────────────┘
```

## Tile Sources

### `/h3_clusters/{z}/{x}/{y}`
- **Zoom levels**: 0-12
- **Content**: H3 hexagonal clusters with property counts and average prices
- **Query params**: `?listing_type=venta|renta`

### `/properties/{z}/{x}/{y}`
- **Zoom levels**: 13-18
- **Content**: Individual property points with price, type, and metadata
- **Query params**: `?listing_type=venta|renta&property_type=casa&min_price=100000&max_price=5000000`

### `/h3_hexagons/{z}/{x}/{y}`
- **Zoom levels**: 6-16
- **Content**: Actual H3 hexagon polygons for heat map visualization
- **Query params**: `?listing_type=venta|renta`

## Local Development

1. **Start Martin locally**:
   ```bash
   docker build -t kentra-tiles .
   docker run -p 3000:3000 -e DATABASE_URL="postgres://..." kentra-tiles
   ```

2. **Test a tile request**:
   ```bash
   curl "http://localhost:3000/h3_clusters/10/234/401"
   ```

3. **View available sources**:
   ```bash
   curl "http://localhost:3000/catalog"
   ```

## Deployment to Fly.io

1. **Install Fly CLI**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login and create app**:
   ```bash
   fly auth login
   fly apps create kentra-tiles
   ```

3. **Set database secret**:
   ```bash
   fly secrets set DATABASE_URL="postgres://user:pass@host:5432/db?sslmode=require"
   ```

4. **Deploy**:
   ```bash
   fly deploy
   ```

5. **Check status**:
   ```bash
   fly status
   fly logs
   ```

## CDN Configuration

For production, configure Cloudflare or similar CDN:

1. Add custom domain: `tiles.kentra.mx`
2. Configure caching rules:
   - Cache TTL: 5 minutes for dynamic tiles
   - Cache TTL: 1 hour for static tiles (low zoom)
3. Enable Brotli/Gzip compression

### Cloudflare Cache Rules

```
Rule 1: Low zoom tiles (cache longer)
  Match: /h3_clusters/[0-8]/*
  Cache TTL: 1 hour

Rule 2: High zoom tiles
  Match: /h3_clusters/[9-12]/*
  Cache TTL: 5 minutes

Rule 3: Property tiles
  Match: /properties/*
  Cache TTL: 2 minutes
```

## Performance Targets

| Metric | Target |
|--------|--------|
| Tile response time | < 50ms |
| Tiles per second | > 1000 |
| Memory usage | < 512MB |
| Cold start | < 2s |

## Troubleshooting

### "Connection refused" errors
- Check DATABASE_URL is correct
- Ensure PostgreSQL allows connections from Fly.io IPs
- Check SSL mode (`sslmode=require` or `sslmode=disable`)

### Slow tile responses
- Check if materialized views need refresh
- Verify spatial indexes exist
- Consider increasing pool_size

### Empty tiles
- Verify H3 columns are populated
- Check that geom column exists on properties table
- Ensure PostGIS extension is enabled
