import { useEffect } from "react";
import { loadGoogleMaps } from "@/lib/loadGoogleMaps";

// Pre-carga la API de Google Maps de forma oportuna para acelerar la navegación a páginas con mapa
const MapPreloader = () => {
  useEffect(() => {
    let cancelled = false;

    const warmUp = () => {
      if (cancelled) return;
      // No bloquear la UI ni mostrar errores al usuario si falla
      loadGoogleMaps().catch(() => {});
    };

    // Intenta durante un momento ocioso del navegador
    const win: any = window as any;
    if (typeof win.requestIdleCallback === "function") {
      win.requestIdleCallback(() => warmUp());
    } else {
      // Fallback ligero
      const t = setTimeout(() => warmUp(), 800);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
};

export default MapPreloader;
