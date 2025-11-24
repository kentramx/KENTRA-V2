/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                   KENTRA MAP STACK - LOADER OFICIAL                          ║
 * ║                    Google Maps API Dynamic Loader                            ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 * 
 * 📍 PROPÓSITO:
 * Esta es la función OFICIAL para cargar la API de Google Maps en Kentra.
 * Cualquier componente que necesite Google Maps DEBE usar este loader.
 * 
 * 🛠️ TECNOLOGÍA:
 * - Google Maps JavaScript API v3
 * - Places Library para autocompletado de direcciones
 * - Geocoding API para conversión dirección <-> coordenadas
 * 
 * 🎯 CARACTERÍSTICAS:
 * - Carga única: reutiliza promesa para evitar múltiples cargas
 * - Manejo de API key desde env variable o backend secrets
 * - Callback global para inicialización (window.initGoogleMaps)
 * - Eventos de ventana para compatibilidad con componentes legacy
 * - Configuración regional: idioma español (es), región México (MX)
 * - Carga async/defer para no bloquear renderizado
 * - Propagación de errores con mensajes útiles
 * 
 * 🔧 USADO POR:
 * - BasicGoogleMap (componente base)
 * - SearchMap (mapa de búsqueda)
 * - PropertyMap (mapa de detalle)
 * - PlaceAutocomplete (búsqueda de direcciones)
 * - MapPreloader (precarga oportunista)
 * 
 * 📦 CONFIGURACIÓN:
 * - API Key: VITE_GOOGLE_MAPS_API_KEY (build-time) o backend secrets (runtime)
 * - Libraries: places
 * - Language: es
 * - Region: MX
 * 
 * ⚠️ IMPORTANTE:
 * Este es el único punto de carga de Google Maps API en el proyecto.
 * No crear loaders alternativos o cargar el script manualmente en otros lugares.
 */
/// <reference types="google.maps" />
let googleMapsPromise: Promise<typeof google.maps> | null = null;

export const loadGoogleMaps = (): Promise<typeof google.maps> => {
  // Si ya está cargado, resolver inmediatamente
  if (window.google && window.google.maps) {
    return Promise.resolve(window.google.maps);
  }

  // Reutilizar promesa existente si ya estamos cargando
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const tryLoad = async () => {
      let apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

      // If not available at build-time, fetch from backend secrets
      if (!apiKey) {
        try {
          const { supabase } = await import('@/integrations/supabase/client');
          const { data, error } = await supabase.functions.invoke('public-config', { body: {} });
          if (error) throw error;
          apiKey = data?.googleMapsApiKey;
        } catch (e) {
          const err = new Error('No se pudo obtener la API key de Google Maps');
          (window as any).googleMapsLoadError = err.message;
          window.dispatchEvent(new Event('google-maps-error'));
          reject(err);
          return;
        }
      }

      if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
        const err = new Error('Falta configurar VITE_GOOGLE_MAPS_API_KEY');
        (window as any).googleMapsLoadError = err.message;
        window.dispatchEvent(new Event('google-maps-error'));
        reject(err);
        return;
      }

      // Callback global cuando el script se carga exitosamente
      (window as any).initGoogleMaps = () => {
        if (window.google && window.google.maps) {
          console.log('[GoogleMaps] loaded OK ✓');
          window.dispatchEvent(new Event('google-maps-loaded'));
          resolve(window.google.maps);
        } else {
          const err = new Error('Google Maps no se inicializó correctamente (revisa la API key y APIs habilitadas)');
          (window as any).googleMapsLoadError = err.message;
          window.dispatchEvent(new Event('google-maps-error'));
          reject(err);
        }
      };

      // Evitar insertar múltiples scripts
      const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps]');
      if (existing) return; // initGoogleMaps resolverá

      // Crear y agregar el script estable con Places legacy y carga async
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps&language=es&region=MX&v=weekly`;
      script.async = true;
      script.defer = true;
      script.setAttribute('data-google-maps', 'true');

      script.onerror = () => {
        const msg = 'No se pudo cargar Google Maps. Verifica tu conexión o tu API key.';
        (window as any).googleMapsLoadError = msg;
        window.dispatchEvent(new Event('google-maps-error'));
        reject(new Error(msg));
      };

      document.head.appendChild(script);
    };

    tryLoad();
  });

  return googleMapsPromise;
};
