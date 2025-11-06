/// <reference types="@types/google.maps" />
/**
 * Carga dinámicamente la API de Google Maps con la librería Places
 * @returns Promise que se resuelve cuando google.maps está disponible
 */
export const loadGoogleMaps = (): Promise<typeof google.maps> => {
  // Si ya está cargado, resolver inmediatamente
  if (window.google && window.google.maps) {
    return Promise.resolve(window.google.maps);
  }

  return new Promise((resolve, reject) => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
      reject(new Error('Falta configurar VITE_GOOGLE_MAPS_API_KEY en las variables de entorno'));
      return;
    }

    // Callback global cuando el script se carga exitosamente
    (window as any).initGoogleMaps = () => {
      if (window.google && window.google.maps) {
        resolve(window.google.maps);
      }
    };

    // Crear y agregar el script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps&language=es&region=MX`;
    script.async = true;
    script.defer = true;
    
    script.onerror = () => {
      reject(new Error('No se pudo cargar Google Maps. Verifica tu conexión e intenta de nuevo.'));
    };

    document.head.appendChild(script);
  });
};
