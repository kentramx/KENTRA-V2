/**
 * SearchMap - Interactive map with MapLibre GL
 * Renders clusters or individual property markers based on zoom level
 */

import { useEffect, useRef, useCallback, memo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore } from '@/stores/mapStore';
import { useMapData } from '@/hooks/useMapData';
import { MAP_STYLE, MEXICO_CONFIG, MEXICO_BOUNDS } from '@/types/map';

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

export const SearchMap = memo(function SearchMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  const {
    isClusterMode,
    clusters,
    mapProperties,
    selectedPropertyId,
    hoveredPropertyId,
    setViewport,
    setSelectedPropertyId,
    setHoveredPropertyId
  } = useMapStore();

  // Initialize data fetching
  useMapData();

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

      setViewport({
        bounds: {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        },
        zoom: Math.round(map.getZoom()),
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

  // Render clusters
  useEffect(() => {
    if (!mapRef.current || !isClusterMode) return;

    clearMarkers();

    clusters.forEach(cluster => {
      const size = getClusterSize(cluster.count);
      
      const el = document.createElement('div');
      el.className = 'map-cluster-marker';
      el.innerHTML = `
        <div class="cluster-circle" style="width: ${size}px; height: ${size}px;">
          ${formatCount(cluster.count)}
        </div>
      `;

      el.addEventListener('click', () => {
        if (mapRef.current) {
          // Zoom in on cluster click
          mapRef.current.flyTo({
            center: [cluster.lng, cluster.lat],
            zoom: mapRef.current.getZoom() + 2,
            duration: 500
          });
        }
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([cluster.lng, cluster.lat])
        .addTo(mapRef.current!);

      markersRef.current.set(cluster.id, marker);
    });
  }, [clusters, isClusterMode, clearMarkers]);

  // Render individual properties
  useEffect(() => {
    if (!mapRef.current || isClusterMode) return;

    clearMarkers();

    mapProperties.forEach(prop => {
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
        .setLngLat([prop.lng, prop.lat])
        .addTo(mapRef.current!);

      markersRef.current.set(prop.id, marker);
    });
  }, [mapProperties, isClusterMode, selectedPropertyId, hoveredPropertyId, clearMarkers, setSelectedPropertyId, setHoveredPropertyId]);

  // Update marker styles on hover/select change (without re-creating markers)
  useEffect(() => {
    if (isClusterMode) return;

    mapProperties.forEach(prop => {
      const marker = markersRef.current.get(prop.id);
      if (!marker) return;

      const el = marker.getElement();
      const isSelected = prop.id === selectedPropertyId;
      const isHovered = prop.id === hoveredPropertyId;

      el.className = `map-property-marker ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`;
    });
  }, [selectedPropertyId, hoveredPropertyId, mapProperties, isClusterMode]);

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-full min-h-[400px]"
      style={{ position: 'relative' }}
    />
  );
});
