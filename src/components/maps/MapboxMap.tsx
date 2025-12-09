import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

// Token hardcodeado para debug
mapboxgl.accessToken = 'pk.eyJ1Ijoia2VudHJhIiwiYSI6ImNtaXlhNXVxNzBkMmczZ29sOXB0dW83OGoifQ.hwDcUNvzdUwke8sog7qCCA';

export function MapboxMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [status, setStatus] = useState<string>('Inicializando...');

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      console.log('🗺️ Intentando crear mapa Mapbox...');
      console.log('📍 Token:', mapboxgl.accessToken?.substring(0, 20) + '...');
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-99.1332, 19.4326],
        zoom: 5
      });

      map.current.on('load', () => {
        console.log('✅ Mapa cargado exitosamente');
        setStatus('✅ Mapa cargado');
      });

      map.current.on('error', (e) => {
        console.error('❌ Error de Mapbox:', e);
        setStatus('❌ Error: ' + (e.error?.message || 'desconocido'));
      });

    } catch (err) {
      console.error('❌ Error al inicializar:', err);
      setStatus('❌ Error al inicializar: ' + (err as Error).message);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full h-[500px] relative border-2 border-blue-500">
      <div className="absolute top-2 left-2 z-10 bg-white px-3 py-1 rounded shadow text-sm">
        {status}
      </div>
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}

export default MapboxMap;
