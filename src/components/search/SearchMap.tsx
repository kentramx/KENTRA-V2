/**
 * SearchMap - Interactive map with MapLibre GL and client-side Supercluster
 * Renders clusters or individual property markers based on zoom level
 */

import { useEffect, useRef, useCallback, memo, useMemo, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Supercluster, { ClusterProperties, PointFeature } from 'supercluster';
import { useMapStore } from '@/stores/mapStore';
import { useMapData } from '@/hooks/useMapData';
import { MAP_STYLE, MEXICO_CONFIG, MEXICO_BOUNDS } from '@/types/map';
import type { MapPropertyMarker } from '@/types/map';

function formatCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${Math.round(count / 1000)}K`;
  return count.toString();
}

function formatPrice(price: number): string {
  if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
  if (price >= 1000) return `$${Math.round(price / 1000)}K`;
  return `$${price.toLocaleString()}`;
}

function getClusterSize(count: number): number {
  if (count >= 1000) return 56;
  if (count >= 100) return 48;
  if (count >= 10) return 40;
  return 32;
}

// Type for cluster or point features from Supercluster
type ClusterOrPoint = Supercluster.ClusterFeature<MapPropertyMarker> | Supercluster.PointFeature<MapPropertyMarker>;

// Type guard for cluster features
function isClusterFeature(
  feature: ClusterOrPoint
): feature is Supercluster.ClusterFeature<MapPropertyMarker> {
  return 'cluster' in feature.properties && feature.properties.cluster === true;
}

export const SearchMap = memo(function SearchMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [currentZoom, setCurrentZoom] = useState<number>(MEXICO_CONFIG.defaultZoom);

  const {
    viewport,
    mapProperties,
    selectedPropertyId,
    hoveredPropertyId,
    setViewport,
    setSelectedPropertyId,
    setHoveredPropertyId
  } = useMapStore();

  // Initialize data fetching
  useMapData();

  // Create Supercluster index from properties
  const clusterIndex = useMemo(() => {
    if (!mapProperties.length) return null;

    const index = new Supercluster<MapPropertyMarker>({
      radius: 60,
      maxZoom: MEXICO_CONFIG.clusterThreshold,
      minPoints: 2
    });

    // Convert properties to GeoJSON features
    const points: PointFeature<MapPropertyMarker>[] = mapProperties.map(p => ({
      type: 'Feature',
      properties: p,
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] }
    }));

    index.load(points);
    return index;
  }, [mapProperties]);

  // Get clusters for current viewport
  const clusters = useMemo(() => {
    if (!viewport || !clusterIndex) return [];
    
    const bbox: [number, number, number, number] = [
      viewport.bounds.west,
      viewport.bounds.south,
      viewport.bounds.east,
      viewport.bounds.north
    ];
    // Cast result to our expected type since getClusters returns a broader type
    return clusterIndex.getClusters(bbox, Math.floor(viewport.zoom)) as ClusterOrPoint[];
  }, [viewport, clusterIndex]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [MEXICO_CONFIG.defaultCenter.lng, MEXICO_CONFIG.defaultCenter.lat],
      zoom: MEXICO_CONFIG.defaultZoom,
      maxBounds: MEXICO_BOUNDS,
      minZoom: MEXICO_CONFIG.minZoom,
      maxZoom: MEXICO_CONFIG.maxZoom
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('moveend', () => {
      const bounds = map.getBounds();
      const center = map.getCenter();
      const zoom = map.getZoom();

      setCurrentZoom(zoom);
      setViewport({
        bounds: {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        },
        zoom: Math.round(zoom),
        center: { lat: center.lat, lng: center.lng }
      });
    });

    // Trigger initial viewport
    map.once('load', () => {
      map.fire('moveend');
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [setViewport]);

  // Clear all markers
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();
  }, []);

  // Render clusters and individual markers
  useEffect(() => {
    if (!mapRef.current || !clusters.length) {
      clearMarkers();
      return;
    }

    clearMarkers();

    clusters.forEach((feature) => {
      const [lng, lat] = feature.geometry.coordinates;

      if (isClusterFeature(feature)) {
        // Render cluster marker
        const clusterProps = feature.properties as ClusterProperties;
        const count = clusterProps.point_count || 0;
        const clusterId = feature.id as number;
        const size = getClusterSize(count);
        
        const el = document.createElement('div');
        el.className = 'map-cluster-marker';
        el.innerHTML = `
          <div class="cluster-circle" style="width: ${size}px; height: ${size}px;">
            ${formatCount(count)}
          </div>
        `;

        el.addEventListener('click', () => {
          if (mapRef.current && clusterIndex && clusterId !== undefined) {
            // Get expansion zoom for this cluster
            const expansionZoom = clusterIndex.getClusterExpansionZoom(clusterId);
            mapRef.current.flyTo({
              center: [lng, lat],
              zoom: Math.min(expansionZoom, MEXICO_CONFIG.maxZoom),
              duration: 500
            });
          }
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(mapRef.current!);

        markersRef.current.set(`cluster_${clusterId}`, marker);
      } else {
        // Render individual property marker
        const prop = feature.properties as MapPropertyMarker;
        const isSelected = prop.id === selectedPropertyId;
        const isHovered = prop.id === hoveredPropertyId;
        const isRent = prop.listing_type === 'renta';

        const el = document.createElement('div');
        el.className = `map-property-marker ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`;
        el.innerHTML = `
          <div class="price-pill ${isRent ? 'rent' : 'sale'}">
            ${formatPrice(prop.price)}
          </div>
        `;

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedPropertyId(prop.id);
        });
        
        el.addEventListener('mouseenter', () => setHoveredPropertyId(prop.id));
        el.addEventListener('mouseleave', () => setHoveredPropertyId(null));

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(mapRef.current!);

        markersRef.current.set(prop.id, marker);
      }
    });
  }, [clusters, selectedPropertyId, hoveredPropertyId, clearMarkers, clusterIndex, setSelectedPropertyId, setHoveredPropertyId]);

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-full min-h-[400px]"
      style={{ position: 'relative' }}
    />
  );
});
