import { useEffect, useRef, memo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMapStore } from '@/stores/mapStore';
import { useMapData } from '@/hooks/useMapData';

const MEXICO_CENTER: [number, number] = [-99.1332, 19.4326];
const INITIAL_ZOOM = 11;

export const SearchMap = memo(function SearchMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  const {
    setViewport,
    selectedPropertyId,
    setSelectedPropertyId,
    setHoveredPropertyId,
    hoveredPropertyId,
  } = useMapStore();

  const {
    mode,
    clusters,
    mapProperties,
    totalInViewport,
    isLoading,
    hasActiveFilters,
  } = useMapData();

  // ============================================
  // INICIALIZAR MAPA
  // ============================================
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'carto-light': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '© CARTO © OpenStreetMap',
          },
        },
        layers: [
          {
            id: 'carto-light-layer',
            type: 'raster',
            source: 'carto-light',
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      },
      center: MEXICO_CENTER,
      zoom: INITIAL_ZOOM,
      maxZoom: 18,
      minZoom: 4,
    });

    m.addControl(new maplibregl.NavigationControl(), 'top-right');

    const updateViewport = () => {
      const bounds = m.getBounds();
      const center = m.getCenter();
      setViewport({
        bounds: {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        },
        zoom: Math.floor(m.getZoom()),
        center: { lat: center.lat, lng: center.lng },
      });
    };

    m.on('load', updateViewport);
    m.on('moveend', updateViewport);

    map.current = m;

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current.clear();
      m.remove();
      map.current = null;
    };
  }, [setViewport]);

  // ============================================
  // RENDERIZAR MARKERS
  // ============================================
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    // Limpiar markers anteriores
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    if (mode === 'clusters') {
      // Renderizar clusters
      clusters.forEach((cluster) => {
        const size = Math.min(60, 30 + Math.log10(cluster.count + 1) * 15);

        const el = document.createElement('div');
        el.className = 'cluster-marker';
        el.style.cssText = `
          width: ${size}px;
          height: ${size}px;
          background: linear-gradient(180deg, #0066FF 0%, #0052CC 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: ${size > 40 ? '12px' : '10px'};
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,102,255,0.4);
          cursor: pointer;
          transition: transform 0.15s;
        `;
        el.innerHTML = cluster.count >= 1000
          ? `${(cluster.count/1000).toFixed(1)}K`
          : String(cluster.count);

        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.1)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
        });
        el.addEventListener('click', () => {
          m.flyTo({
            center: [cluster.lng, cluster.lat],
            zoom: m.getZoom() + 3,
            duration: 500,
          });
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([cluster.lng, cluster.lat])
          .addTo(m);

        // Usar geohash como ID (el backend no envía 'id')
        const clusterId = (cluster as any).geohash || cluster.id || `cluster-${cluster.lat}-${cluster.lng}`;
        markersRef.current.set(clusterId, marker);
      });
    } else {
      // Renderizar propiedades individuales
      mapProperties.forEach((property) => {
        const isSelected = property.id === selectedPropertyId;

        const el = document.createElement('div');
        el.className = 'price-marker';
        el.style.cssText = `
          padding: 4px 8px;
          background: ${isSelected ? '#0066FF' : 'white'};
          color: ${isSelected ? 'white' : '#1a1a1a'};
          border-radius: 4px;
          font-weight: 600;
          font-size: 11px;
          border: 1px solid ${isSelected ? '#0052CC' : '#e0e0e0'};
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
          transform: ${isSelected ? 'scale(1.1)' : 'scale(1)'};
          z-index: ${isSelected ? 10 : 1};
        `;

        const price = property.price >= 1000000
          ? `${(property.price/1000000).toFixed(1)}M`
          : `${(property.price/1000).toFixed(0)}K`;
        el.innerHTML = price;

        el.addEventListener('click', () => setSelectedPropertyId(property.id));
        el.addEventListener('mouseenter', () => setHoveredPropertyId(property.id));
        el.addEventListener('mouseleave', () => setHoveredPropertyId(null));

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([property.lng, property.lat])
          .addTo(m);

        markersRef.current.set(property.id, marker);
      });
    }
  }, [mode, clusters, mapProperties, selectedPropertyId, setSelectedPropertyId, setHoveredPropertyId]);

  // ============================================
  // ACTUALIZAR MARKER SELECCIONADO/HOVERED
  // ============================================
  useEffect(() => {
    if (mode !== 'properties') return;

    markersRef.current.forEach((marker, id) => {
      const el = marker.getElement();
      const isSelected = id === selectedPropertyId;
      const isHovered = id === hoveredPropertyId;

      el.style.background = isSelected ? '#0066FF' : isHovered ? '#E8F0FE' : 'white';
      el.style.color = isSelected ? 'white' : '#1a1a1a';
      el.style.transform = isSelected ? 'scale(1.1)' : 'scale(1)';
      el.style.zIndex = isSelected ? '10' : '1';
    });
  }, [selectedPropertyId, hoveredPropertyId, mode]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Badge de conteo */}
      <div className="absolute top-3 left-3 z-10 bg-white px-3 py-2 rounded-lg shadow-md">
        <span className="font-medium text-gray-900">
          {isLoading ? 'Cargando...' : `${totalInViewport.toLocaleString()} propiedades`}
        </span>
      </div>

      {/* Indicador de filtros */}
      {hasActiveFilters && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-blue-600 text-white px-3 py-1.5 rounded-full text-sm font-medium">
          Filtros activos
        </div>
      )}

      {/* Indicador de modo */}
      {mode === 'clusters' && (
        <div className="absolute bottom-3 left-3 z-10 bg-black/70 text-white px-3 py-1.5 rounded text-sm">
          Acerca para ver precios
        </div>
      )}

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute top-3 right-3 z-10">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
});
