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

  // Medir FPS en background
  useEffect(() => {
    let rafId: number;
    
    const measureFPS = () => {
      const now = performance.now();
      const delta = now - lastFrameRef.current;
      lastFrameRef.current = now;
      
      // Guardar últimos 10 frames
      frameTimesRef.current.push(delta);
      if (frameTimesRef.current.length > 10) {
        frameTimesRef.current.shift();
      }
      
      // Calcular FPS promedio cada segundo
      if (frameTimesRef.current.length === 10) {
        const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b) / 10;
        const fps = 1000 / avgFrameTime;
        
        // Ajustar delay según FPS
        if (fps >= 50) {
          setAdaptiveDelay(200); // Rápido
        } else if (fps >= 30) {
          setAdaptiveDelay(400); // Medio
        } else {
          setAdaptiveDelay(800); // Lento
        }
      }
      
      rafId = requestAnimationFrame(measureFPS);
    };
    
    rafId = requestAnimationFrame(measureFPS);
    
    return () => cancelAnimationFrame(rafId);
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
