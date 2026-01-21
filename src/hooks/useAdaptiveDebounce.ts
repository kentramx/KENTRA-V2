import { useState, useEffect, useRef } from 'react';

/**
 * 🎯 Hook de debounce adaptativo según FPS del dispositivo
 * - Dispositivos rápidos (60 FPS): debounce corto (200ms)
 * - Dispositivos medios (30-60 FPS): debounce medio (400ms)
 * - Dispositivos lentos (<30 FPS): debounce largo (800ms)
 */
export function useAdaptiveDebounce<T>(value: T, defaultDelay: number = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const [adaptiveDelay, setAdaptiveDelay] = useState(defaultDelay);
  const frameTimesRef = useRef<number[]>([]);
  const lastFrameRef = useRef<number>(performance.now());

  // Medir FPS solo durante inicialización (10 frames) y luego detener
  // PERFORMANCE: No mantener RAF corriendo indefinidamente
  useEffect(() => {
    let rafId: number;
    let frameCount = 0;
    const maxFrames = 10;
    let isCancelled = false;

    const measureFPS = () => {
      if (isCancelled) return;

      const now = performance.now();
      const delta = now - lastFrameRef.current;
      lastFrameRef.current = now;

      // Guardar frame time
      frameTimesRef.current.push(delta);
      frameCount++;

      // Una vez que tenemos 10 frames, calcular FPS y DETENER
      if (frameCount >= maxFrames) {
        const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b) / frameTimesRef.current.length;
        const fps = 1000 / avgFrameTime;

        // Ajustar delay según FPS (solo una vez)
        if (fps >= 50) {
          setAdaptiveDelay(200); // Rápido
        } else if (fps >= 30) {
          setAdaptiveDelay(400); // Medio
        } else {
          setAdaptiveDelay(800); // Lento
        }

        // Limpiar ref ya no necesario
        frameTimesRef.current = [];
        return; // NO continuar el loop
      }

      rafId = requestAnimationFrame(measureFPS);
    };

    rafId = requestAnimationFrame(measureFPS);

    return () => {
      isCancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, adaptiveDelay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, adaptiveDelay]);

  return debouncedValue;
}
