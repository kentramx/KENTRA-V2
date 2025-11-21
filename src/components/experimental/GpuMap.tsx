import { useEffect, useRef, useState } from 'react';
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import { ScatterplotLayer } from '@deck.gl/layers';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

// Generar 10,000 puntos aleatorios alrededor del centro de México
const generateRandomPoints = (count: number) => {
  const centerLat = 23.6345; // Centro de México
  const centerLng = -102.5528;
  const spread = 8; // Grados de dispersión

  return Array.from({ length: count }, (_, i) => ({
    id: i,
    position: [
      centerLng + (Math.random() - 0.5) * spread,
      centerLat + (Math.random() - 0.5) * spread,
    ] as [number, number],
    price: Math.random() * 10000000, // Precio aleatorio 0-10M
  }));
};

const GpuMap = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const overlayRef = useRef<GoogleMapsOverlay | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [fps, setFps] = useState<number>(0);

  // Generar puntos una sola vez
  const pointsRef = useRef(generateRandomPoints(10000));

  // FPS Counter
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime >= lastTime + 1000) {
        setFps(Math.round(frameCount * 1000 / (currentTime - lastTime)));
        frameCount = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(measureFPS);
    };

    const animationId = requestAnimationFrame(measureFPS);
    return () => cancelAnimationFrame(animationId);
  }, []);

  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current) return;

      try {
        await loadGoogleMaps();

        // Crear mapa base de Google Maps
        const map = new google.maps.Map(mapRef.current, {
          center: { lat: 23.6345, lng: -102.5528 },
          zoom: 5,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });

        mapInstanceRef.current = map;

        // Crear overlay de deck.gl
        const overlay = new GoogleMapsOverlay({
          layers: [],
        });

        overlay.setMap(map);
        overlayRef.current = overlay;
        setIsReady(true);

      } catch (err) {
        console.error('Error inicializando GPU Map:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      }
    };

    initMap();

    return () => {
      overlayRef.current?.setMap(null);
      overlayRef.current = null;
      mapInstanceRef.current = null;
    };
  }, []);

  // Actualizar la capa de puntos cuando cambia el estado
  useEffect(() => {
    if (!isReady || !overlayRef.current) return;

    const layer = new ScatterplotLayer({
      id: 'scatterplot-layer',
      data: pointsRef.current,
      pickable: true,
      opacity: 0.9,
      stroked: true,
      filled: true,
      radiusScale: 1,
      radiusMinPixels: 8,
      radiusMaxPixels: 30,
      lineWidthMinPixels: 1,
      getPosition: (d: any) => d.position,
      getRadius: (d: any) => (hoveredPoint === d.id ? 1000 : 500),
      getFillColor: (d: any) => {
        // Rojo brillante para máxima visibilidad
        if (hoveredPoint === d.id) {
          return [255, 255, 0, 255]; // Amarillo al hover
        }
        return [255, 0, 0, 255]; // Rojo brillante
      },
      getLineColor: [255, 255, 255, 150],
      onHover: (info: any) => {
        if (info.object) {
          setHoveredPoint(info.object.id);
        } else {
          setHoveredPoint(null);
        }
      },
      updateTriggers: {
        getRadius: [hoveredPoint],
        getFillColor: [hoveredPoint],
      },
    });

    overlayRef.current.setProps({
      layers: [layer],
    });
  }, [isReady, hoveredPoint]);

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error cargando mapa GPU: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Stats overlay */}
      <div className="absolute top-4 left-4 bg-background/95 backdrop-blur-sm border rounded-lg p-4 shadow-lg">
        <h3 className="font-bold text-lg mb-2">🚀 GPU Map Test</h3>
        <div className="space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">Puntos renderizados:</span>{' '}
            <span className="font-mono font-bold">10,000</span>
          </div>
          <div>
            <span className="text-muted-foreground">FPS:</span>{' '}
            <span 
              className={`font-mono font-bold ${
                fps >= 55 ? 'text-green-500' : 
                fps >= 30 ? 'text-yellow-500' : 
                'text-red-500'
              }`}
            >
              {fps}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Estado:</span>{' '}
            <span className={`font-medium ${isReady ? 'text-green-500' : 'text-yellow-500'}`}>
              {isReady ? '✓ Listo' : '⏳ Cargando...'}
            </span>
          </div>
          {hoveredPoint !== null && (
            <div className="pt-2 border-t mt-2">
              <span className="text-muted-foreground">Punto hover:</span>{' '}
              <span className="font-mono">#{hoveredPoint}</span>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 right-4 bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg max-w-xs">
        <p className="text-xs text-muted-foreground">
          💡 <strong>Interacción:</strong> Haz hover sobre los puntos para ver el efecto de cambio de color y tamaño.
          Los colores representan rangos de precio simulados.
        </p>
      </div>
    </div>
  );
};

export default GpuMap;
