// [REBUILD 2025-11-23 19:30] Logs agresivos + Rebuild para VITE_MAPBOX_ACCESS_TOKEN
/**
 * ✅ Componente de mapa V2 con Mapbox GL JS (WebGL layers)
 * - Arquitectura ultra-escalable tipo Zillow
 * - GeoJSON source + layers (NO DOM markers)
 * - Prefetch de tiles vecinos
 * - Hard cap visual con overlay
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// ✅ FIX CSP/Worker para Vite/Lovable (evita blob worker bloqueado)
import MapboxWorker from 'mapbox-gl/dist/mapbox-gl-csp-worker?worker';
mapboxgl.workerClass = MapboxWorker;

import { useTiledMapV2, ViewportBounds, MIN_ZOOM_FOR_TILES, MAX_PROPERTIES_PER_TILE } from '@/hooks/useTiledMapV2';
import type { MapProperty, PropertyFilters } from '@/types/property';
import { monitoring } from '@/lib/monitoring';
import { Loader2, AlertCircle, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MapboxDebugPanel } from '@/components/MapboxDebugPanel';

interface SearchMapMapboxV2Props {
  filters: PropertyFilters;
  searchCoordinates: { lat: number; lng: number } | null;
  onMarkerClick: (id: string) => void;
  onPropertyHover?: (property: MapProperty | null) => void;
  hoveredPropertyId?: string | null;
  hoveredPropertyCoords?: { lat: number; lng: number } | null;
  height?: string;
  onMapError?: (error: string) => void;
  onVisibleCountChange?: (count: number) => void;
  onMapPositionChange?: (center: { lat: number; lng: number }, bounds: ViewportBounds) => void;
}

export const SearchMapMapboxV2: React.FC<SearchMapMapboxV2Props> = ({
  filters,
  searchCoordinates,
  onMarkerClick,
  onPropertyHover,
  hoveredPropertyId,
  hoveredPropertyCoords,
  height = '100%',
  onMapError,
  onVisibleCountChange,
  onMapPositionChange,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const didInitRef = useRef(false);
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const previousMarkersRef = useRef<any[]>([]);

  // ✅ Debug overlay: visible en DEV o con ?debugMap=1
  const debugEnabled =
    import.meta.env.DEV ||
    new URLSearchParams(window.location.search).get('debugMap') === '1';

  // 🔍 Debug state avanzado para MapboxDebugPanel
  const [debugData, setDebugData] = useState({
    mapInitStatus: {
      didInit: false,
      mapExists: false,
      styleLoaded: false,
    },
    tokenInfo: {
      envKeyUsed: '',
      tokenLength: 0,
    },
    workerFixEnabled: true, // CSP worker fix siempre activo
    webglInfo: {
      supported: false,
      vendor: '',
      renderer: '',
    },
    viewport: {
      boundsKey: null as string | null,
      zoom: 5,
      bounds: null as {
        minLat: number;
        maxLat: number;
        minLng: number;
        maxLng: number;
      } | null,
    },
    counts: {
      properties: 0,
      clusters: 0,
      hasTooManyResults: false,
    },
    performance: {
      lastTilesLoadMs: null as number | null,
    },
    errors: {
      lastMapboxError: null as string | null,
      lastTilesError: null as string | null,
    },
  });

  // 🚀 TILE-BASED ARCHITECTURE V2
  const { data: viewportData, isLoading, error } = useTiledMapV2(
    viewportBounds,
    { ...filters, status: ['activa'] }
  );

  const { properties = [], clusters = [], hasTooManyResults = false } = viewportData || {};

  // 🔍 Exponer debug data a window global (solo en DEV o con debugMap)
  useEffect(() => {
    if (debugEnabled) {
      (window as any).__KENTRA_MAPBOX_DEBUG__ = {
        timestamp: new Date().toISOString(),
        component: 'SearchMapMapboxV2',
        ...debugData,
      };
    }
  }, [debugData, debugEnabled]);

  // ✅ Calcular y reportar el total de propiedades visibles
  useEffect(() => {
    if (!onVisibleCountChange) return;

    const totalVisible =
      (properties?.length || 0) + (clusters?.reduce((acc, c) => acc + c.property_count, 0) || 0);

    onVisibleCountChange(totalVisible);
  }, [properties, clusters, onVisibleCountChange]);

  // ✅ Inicialización Mapbox estable (solo una vez con didInitRef)
  useEffect(() => {
    if (!mapContainer.current) return;

    // 🚨 LOG AGRESIVO: Verificar montaje del componente
    console.log('🗺️ [SearchMapMapboxV2] COMPONENTE MONTADO', {
      timestamp: new Date().toISOString(),
      containerExists: !!mapContainer.current,
      didInitRef: didInitRef.current,
      isDEV: import.meta.env.DEV,
      isPreview: window.location.hostname.includes('lovable.app'),
    });

    if (didInitRef.current) return;
    didInitRef.current = true;

    // ✅ Función asíncrona para inicializar el mapa con el token
    const initializeMap = async () => {
      // ✅ Primero intentar desde variables de entorno (build-time)
      let token =
        import.meta.env.VITE_MAPBOX_TOKEN ||
        import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ||
        '';

      let tokenSource = 'env';

      // 🚨 Si no hay token en env, intentar desde edge function (runtime fallback)
      if (!token) {
        console.log('⚠️ [Mapbox] Token no encontrado en env, intentando desde edge function...');
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-config`,
            {
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );

          if (response.ok) {
            const config = await response.json();
            token = config.mapboxAccessToken || '';
            tokenSource = 'edge-function';
            console.log('✅ [Mapbox] Token obtenido desde edge function', {
              tokenLength: token.length,
              tokenStart: token ? token.substring(0, 6) : 'N/A',
            });
          } else {
            console.error('❌ [Mapbox] Error al cargar config desde edge function:', response.status);
          }
        } catch (fetchError) {
          console.error('❌ [Mapbox] Excepción al cargar config:', fetchError);
        }
      }

      const tokenNameUsed = tokenSource === 'env' 
        ? (import.meta.env.VITE_MAPBOX_TOKEN ? 'VITE_MAPBOX_TOKEN' : 'VITE_MAPBOX_ACCESS_TOKEN')
        : 'edge-function';

      // 🔍 Actualizar debug data con token
      setDebugData(prev => ({
        ...prev,
        tokenInfo: {
          envKeyUsed: tokenNameUsed,
          tokenLength: token.length,
        },
      }));

      // 🚨 LOGS SIEMPRE VISIBLES (incluso en preview)
      console.log('🔑 [Mapbox Token Check] RESULTADO', {
        tokenSource,
        hasVITE_MAPBOX_TOKEN: !!import.meta.env.VITE_MAPBOX_TOKEN,
        hasVITE_MAPBOX_ACCESS_TOKEN: !!import.meta.env.VITE_MAPBOX_ACCESS_TOKEN,
        tokenLength: token.length,
        tokenNameUsed,
        tokenFirstChars: token ? token.substring(0, 6) + '...' : 'NINGUNO',
        allEnvKeys: Object.keys(import.meta.env).filter(k => k.includes('MAPBOX')),
      });

      if (!token) {
        const errorMsg =
          '❌ Token de Mapbox no disponible. Intenta recargar la página o contacta soporte.';
        
        console.error('🚨 [SearchMapMapboxV2] ERROR CRÍTICO:', errorMsg);
        console.error('🔍 Variables de entorno disponibles:', Object.keys(import.meta.env));
        console.error('📋 Valores de env:', {
          VITE_MAPBOX_TOKEN: import.meta.env.VITE_MAPBOX_TOKEN || 'undefined',
          VITE_MAPBOX_ACCESS_TOKEN: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'undefined',
        });
        
        setMapError(errorMsg);
        setDebugData(prev => ({
          ...prev,
          errors: { ...prev.errors, lastMapboxError: errorMsg },
        }));
        monitoring.error('[SearchMapMapboxV2] Token no configurado');
        onMapError?.(errorMsg);
        return;
      }

      console.log('✅ [Mapbox] Token configurado correctamente', {
        tokenSource,
        tokenLength: token.length,
        tokenStart: token.substring(0, 6),
      });

      mapboxgl.accessToken = token;

      // 🖥️ Verificar soporte WebGL ANTES de crear el mapa (intentar TODOS los contextos)
      const canvas = document.createElement('canvas');
      
      // ✅ Intentar WebGL2 primero, luego WebGL, luego experimental
      let gl: WebGLRenderingContext | null = null;
      const contextOptions = {
        failIfMajorPerformanceCaveat: false, // ✅ NO fallar si hay advertencias de performance
        preserveDrawingBuffer: true,         // ✅ Necesario para algunos iframes
        antialias: true,
        alpha: true,
      };
      
      try {
        gl = canvas.getContext('webgl2', contextOptions) as WebGLRenderingContext | null ||
             canvas.getContext('webgl', contextOptions) as WebGLRenderingContext | null ||
             canvas.getContext('experimental-webgl', contextOptions) as WebGLRenderingContext | null;
      } catch (e) {
        console.error('🚨 [WebGL] Error al obtener contexto:', e);
      }
      
      const webglSupported = !!gl;
      const webglVendor = gl ? (gl.getParameter(gl.VENDOR) as string) : 'N/A';
      const webglRenderer = gl ? (gl.getParameter(gl.RENDERER) as string) : 'N/A';

      console.log('🖥️ [WebGL Check] EXHAUSTIVO', {
        supported: webglSupported,
        vendor: webglVendor,
        renderer: webglRenderer,
        contextOptions,
        triedContexts: ['webgl2', 'webgl', 'experimental-webgl'],
      });

      // 🔍 Actualizar debug data con WebGL info
      setDebugData(prev => ({
        ...prev,
        webglInfo: {
          supported: webglSupported,
          vendor: webglVendor,
          renderer: webglRenderer,
        },
      }));

      if (!webglSupported) {
        const errorMsg = '❌ Tu navegador no soporta WebGL (requerido para el mapa). Intenta actualizar tu navegador o usar Chrome/Firefox.';
        console.error('🚨 [WebGL] No disponible');
        setMapError(errorMsg);
        setDebugData(prev => ({
          ...prev,
          errors: { ...prev.errors, lastMapboxError: errorMsg },
        }));
        onMapError?.(errorMsg);
        return;
      }

      const center: [number, number] = searchCoordinates
        ? [searchCoordinates.lng, searchCoordinates.lat]
        : [-102.5528, 23.6345]; // Centro de México
      const zoom = searchCoordinates ? 12 : 5;

      // ✅ Wrap map creation en try-catch para capturar errores síncronos de WebGL
      let map: mapboxgl.Map;
      try {
        map = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/streets-v12',
          center,
          zoom,
          // ✅ Opciones críticas para WebGL en iframes restrictivos
          failIfMajorPerformanceCaveat: false, // Intentar incluso si hay advertencias
          preserveDrawingBuffer: true,         // Crítico para algunos iframes
          antialias: true,                     // Mejorar rendering
          // ✅ Atributos adicionales para forzar WebGL
          renderWorldCopies: false,            // Reducir overhead
          trackResize: true,
          refreshExpiredTiles: false,          // Reducir overhead
        });
        mapRef.current = map;
        console.log('✅ [Mapbox] Mapa creado exitosamente con opciones WebGL avanzadas');
      } catch (error: any) {
        const errorMsg = error?.message || 'Error al inicializar el mapa';
        console.error('🚨 [Mapbox] Error durante new mapboxgl.Map():', error);
        
        // Detectar error WebGL específicamente
        if (errorMsg.toLowerCase().includes('webgl')) {
          const webglError = '❌ Tu navegador no puede inicializar WebGL (requerido para el mapa). Intenta cerrar otras pestañas o actualizar tu navegador.';
          setMapError(webglError);
          setDebugData(prev => ({
            ...prev,
            errors: { ...prev.errors, lastMapboxError: webglError },
          }));
          onMapError?.(webglError);
        } else {
          setMapError(errorMsg);
          setDebugData(prev => ({
            ...prev,
            errors: { ...prev.errors, lastMapboxError: errorMsg },
          }));
          onMapError?.(errorMsg);
        }
        return;
      }

    // ✅ Capturar errores de Mapbox (403 token, CSP, style fail, etc.)
    map.on('error', (e: any) => {
      const msg =
        e?.error?.message ||
        e?.message ||
        'Error desconocido de Mapbox';

      console.error('[Mapbox error event]', e);

      setMapError(msg);
      setDebugData(prev => ({
        ...prev,
        errors: { ...prev.errors, lastMapboxError: msg },
      }));
      onMapError?.(msg);
    });

    map.on('load', () => {
      setDebugData(prev => ({
        ...prev,
        mapInitStatus: {
          didInit: true,
          mapExists: true,
          styleLoaded: map.isStyleLoaded(),
        },
      }));
      // ✅ Crear source + layers SOLO en load
      map.addSource('kentra-points-v2', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Layer: Clusters circle
      map.addLayer({
        id: 'clusters-circle-v2',
        type: 'circle',
        source: 'kentra-points-v2',
        filter: ['==', ['get', 'type'], 'cluster'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'count'],
            '#0EA5E9',
            10,
            '#3B82F6',
            50,
            '#6366F1',
            100,
            '#8B5CF6',
          ],
          'circle-radius': ['step', ['get', 'count'], 20, 10, 30, 50, 40, 100, 50],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Layer: Clusters count
      map.addLayer({
        id: 'clusters-count-v2',
        type: 'symbol',
        source: 'kentra-points-v2',
        filter: ['==', ['get', 'type'], 'cluster'],
        layout: {
          'text-field': ['get', 'count'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 14,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });

      // Layer: Properties circle
      map.addLayer({
        id: 'properties-circle-v2',
        type: 'circle',
        source: 'kentra-points-v2',
        filter: ['==', ['get', 'type'], 'property'],
        paint: {
          'circle-color': [
            'case',
            ['boolean', ['get', 'isHovered'], false],
            '#F59E0B',
            '#10B981',
          ],
          'circle-radius': ['case', ['boolean', ['get', 'isHovered'], false], 12, 8],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
    });

    // ✅ Listener moveend para calcular bounds y notificar
    map.on('moveend', () => {
      const mapBounds = map.getBounds();
      const zoom = map.getZoom();

      const bounds: ViewportBounds = {
        minLng: mapBounds.getWest(),
        minLat: mapBounds.getSouth(),
        maxLng: mapBounds.getEast(),
        maxLat: mapBounds.getNorth(),
        zoom: Math.round(zoom),
      };

      setViewportBounds(bounds);
      
      // 🔍 Actualizar debug data con viewport
      const boundsKey = `${bounds.zoom}_${bounds.minLat.toFixed(3)}_${bounds.maxLat.toFixed(3)}`;
      setDebugData(prev => ({
        ...prev,
        viewport: {
          boundsKey,
          zoom: bounds.zoom,
          bounds: {
            minLat: bounds.minLat,
            maxLat: bounds.maxLat,
            minLng: bounds.minLng,
            maxLng: bounds.maxLng,
          },
        },
      }));

      const center = map.getCenter();
      onMapPositionChange?.({ lat: center.lat, lng: center.lng }, bounds);
    });

    // ✅ Interacciones: click en cluster → zoom +2
    map.on('click', 'clusters-circle-v2', (e) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const coordinates = (feature.geometry as any).coordinates.slice();
      const zoom = map.getZoom();

      map.easeTo({
        center: coordinates,
        zoom: Math.min(zoom + 2, 18),
        duration: 500,
      });
    });

    // ✅ Interacciones: click en property → onMarkerClick
    map.on('click', 'properties-circle-v2', (e) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const id = feature.properties?.id;
      if (id) {
        onMarkerClick(id);
      }
    });

    // ✅ Interacciones: hover en property
    map.on('mouseenter', 'properties-circle-v2', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      if (!e.features || e.features.length === 0 || !onPropertyHover) return;
      const feature = e.features[0];
      const id = feature.properties?.id;
      const property = properties.find((p) => p.id === id);
      if (property) {
        onPropertyHover(property);
      }
    });

    map.on('mouseleave', 'properties-circle-v2', () => {
      map.getCanvas().style.cursor = '';
      onPropertyHover?.(null);
    });

    // ✅ Hover en cluster
    map.on('mouseenter', 'clusters-circle-v2', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'clusters-circle-v2', () => {
      map.getCanvas().style.cursor = '';
    });

    // 🔍 Actualizar debug data al inicializar
    setDebugData(prev => ({
      ...prev,
      mapInitStatus: {
        didInit: true,
        mapExists: true,
        styleLoaded: false,
      },
    }));

    return () => {
      map.remove();
      didInitRef.current = false;
    };
    };

    // Ejecutar la inicialización
    initializeMap();
  }, []); // Solo inicializar una vez

  // ✅ Update de datos con source.setData()
  useEffect(() => {
    if (!mapRef.current) return;

    const source = mapRef.current.getSource('kentra-points-v2') as mapboxgl.GeoJSONSource;
    if (!source) return; // Guard correcto

    // 🔍 Actualizar debug data con contadores
    setDebugData(prev => ({
      ...prev,
      counts: {
        properties: properties.length,
        clusters: clusters.length,
        hasTooManyResults,
      },
    }));

    const features: any[] = [];

    // ✅ Solo renderizar properties si NO está saturado
    if (!hasTooManyResults) {
      properties.forEach((p) => {
        if (!p.lat || !p.lng || isNaN(Number(p.lat)) || isNaN(Number(p.lng))) return;
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [Number(p.lng), Number(p.lat)] },
          properties: {
            id: p.id,
            type: 'property',
            title: p.title,
            price: p.price,
            isHovered: hoveredPropertyId === p.id,
          },
        });
      });
    }

    clusters.forEach((c) => {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
        properties: {
          id: c.cluster_id,
          type: 'cluster',
          count: c.property_count,
          avgPrice: c.avg_price,
        },
      });
    });

    source.setData({ type: 'FeatureCollection', features });

    if (features.length > 0) {
      previousMarkersRef.current = features;
    }
  }, [properties, clusters, hasTooManyResults, hoveredPropertyId]);

  // ✅ Log de errores y actualizar debug data
  if (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    setDebugData(prev => ({
      ...prev,
      errors: { ...prev.errors, lastTilesError: errorMsg },
    }));
    
    monitoring.error('[SearchMapMapboxV2] Error cargando tiles', {
      component: 'SearchMapMapboxV2',
      error,
      filters,
      bounds: viewportBounds,
    });
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={mapContainer} className="absolute inset-0" />

      {/* 🔄 Overlay de carga */}
      {isLoading && viewportBounds && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-[2px]">
          <div className="rounded-lg bg-background/95 px-4 py-3 shadow-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Cargando propiedades en el mapa...</span>
            </div>
          </div>
        </div>
      )}

      {/* ❌ Overlay de error crítico */}
      {mapError && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/30 backdrop-blur-sm">
          <div className="pointer-events-auto rounded-lg bg-background border border-destructive/20 px-6 py-4 shadow-xl max-w-md mx-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div className="space-y-2">
                <p className="font-medium text-foreground">No pudimos cargar el mapa</p>
                <p className="text-sm text-muted-foreground">{mapError}</p>
                
                {/* ⚠️ Soluciones específicas para WebGL */}
                {mapError.toLowerCase().includes('webgl') && (
                  <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md text-left border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                      <strong className="block mb-1">💡 Posibles soluciones:</strong>
                      <span className="block">• Cierra otras pestañas con mapas o videos</span>
                      <span className="block">• Actualiza tu navegador a la última versión</span>
                      <span className="block">• Intenta usar Chrome o Firefox</span>
                      <span className="block">• Verifica que WebGL esté habilitado en tu navegador</span>
                    </p>
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground mt-2">
                  Puedes seguir usando la lista de propiedades sin problema.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setMapError(null);
                  window.location.reload();
                }}
                className="mt-2"
              >
                Reintentar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ Overlay de tile saturado */}
      {hasTooManyResults && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-background/90 px-4 py-2 text-sm text-muted-foreground shadow-lg backdrop-blur-sm flex items-center gap-2">
            <ZoomIn className="h-4 w-4" />
            <span>Acerca el mapa para ver propiedades individuales</span>
          </div>
        </div>
      )}

      {/* ℹ️ Mensaje de zoom bajo */}
      {viewportBounds && viewportBounds.zoom < MIN_ZOOM_FOR_TILES && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-background/90 px-4 py-2 text-sm text-muted-foreground shadow-lg backdrop-blur-sm">
            Acerca un poco más el mapa para ver propiedades.
          </div>
        </div>
      )}

      {/* ✅ Panel de diagnóstico visual profesional (DEV only) */}
      {debugEnabled && <MapboxDebugPanel data={debugData} />}
    </div>
  );
};
