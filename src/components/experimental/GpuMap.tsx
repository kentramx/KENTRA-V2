import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/lib/loadGoogleMaps';
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import { ScatterplotLayer } from '@deck.gl/layers';
import { AlertCircle } from 'lucide-react';

export default function GpuMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let mapInstance: google.maps.Map | null = null;
    let overlayInstance: GoogleMapsOverlay | null = null;

    const initMap = async () => {
      try {
        // 1. Esperar a que cargue la API
        await loadGoogleMaps();
        
        if (!mapRef.current) return;

        // 2. Inicializar Mapa
        mapInstance = new google.maps.Map(mapRef.current, {
          center: { lat: 23.6345, lng: -102.5528 },
          zoom: 5,
          mapId: 'DEMO_MAP_ID', // Importante para Vector Maps si se tiene
          disableDefaultUI: false,
        });

        // 3. Generar 10k puntos dummy
        const data = Array.from({ length: 10000 }, () => ({
          position: [
            -102.5528 + (Math.random() - 0.5) * 15, 
            23.6345 + (Math.random() - 0.5) * 10
          ],
          color: [255, 0, 0], // Rojo brillante
          radius: 2000 // 2km de radio
        }));

        // 4. Inicializar Deck.gl Overlay
        overlayInstance = new GoogleMapsOverlay({
          layers: [
            new ScatterplotLayer({
              id: 'scatter-layer',
              data,
              getPosition: (d: any) => d.position,
              getFillColor: (d: any) => d.color,
              getRadius: (d: any) => d.radius,
              opacity: 0.8,
              stroked: true,
              radiusMinPixels: 3, // Asegurar visibilidad mínima
            })
          ],
        });

        // 5. Conectar Overlay al Mapa
        overlayInstance.setMap(mapInstance);
        setStatus('ready');
      } catch (error: any) {
        console.error('Error iniciando GpuMap:', error);
        setErrorMessage(error.message || 'Error desconocido');
        setStatus('error');
      }
    };

    initMap();

    // Cleanup
    return () => {
      if (overlayInstance) overlayInstance.setMap(null);
    };
  }, []);

  // Renderizado Defensivo
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', backgroundColor: '#f0f0f0' }}>
      {/* Estado de Carga */}
      {status === 'loading' && (
        <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 100, background: 'white', padding: 10, borderRadius: 8 }}>
          Cargando librerías...
        </div>
      )}

      {/* Estado de Error */}
      {status === 'error' && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', padding: 20, border: '2px solid red', color: 'red', borderRadius: 8 }}>
          <AlertCircle style={{ display: 'inline', marginRight: 8 }} />
          {errorMessage}
        </div>
      )}

      {/* Contenedor del Mapa */}
      <div 
        ref={mapRef} 
        style={{ width: '100%', height: '100%' }} 
      />
    </div>
  );
}
