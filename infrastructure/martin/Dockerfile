# Martin Tile Server Dockerfile
# Based on official MapLibre Martin image

FROM ghcr.io/maplibre/martin:v0.13.0

# Copy configuration file
COPY martin.yaml /config/martin.yaml

# Expose the default Martin port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run Martin with our configuration
CMD ["--config", "/config/martin.yaml"]
