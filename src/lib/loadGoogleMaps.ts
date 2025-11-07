/// <reference types="google.maps" />
/**
 * Carga dinámicamente la API de Google Maps con la librería Places
 * - Evita cargas duplicadas reutilizando una única promesa
 * - Emite eventos de ventana para componentes que escuchan (compatibilidad)
 * - Propaga errores con mensajes útiles
 */
let googleMapsPromise: Promise<typeof google.maps> | null = null;

export const loadGoogleMaps = (): Promise<typeof google.maps> => {
  // Si ya está cargado, resolver inmediatamente
  if (window.google && window.google.maps) {
    return Promise.resolve(window.google.maps);
  }

  // Reutilizar promesa existente si ya estamos cargando
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
      const err = new Error('Falta configurar VITE_GOOGLE_MAPS_API_KEY en las variables de entorno');
      (window as any).googleMapsLoadError = err.message;
      window.dispatchEvent(new Event('google-maps-error'));
      reject(err);
      return;
    }

    // Callback global cuando el script se carga exitosamente
    (window as any).initGoogleMaps = () => {
      if (window.google && window.google.maps) {
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

    // Crear y agregar el script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps&language=es&region=MX`;
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
  });

  return googleMapsPromise;
};
