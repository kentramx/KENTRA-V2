/**
 * Hook para interactuar con el Web Worker de clustering
 * Permite clustering de 100K+ puntos sin bloquear la UI
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// Tipos
interface PropertyPoint {
  id: string;
  lat: number;
  lng: number;
  price: number;
  type?: string;
  listing_type?: string;
}

interface ClusterProperties {
  cluster?: boolean;
  cluster_id?: number;
  point_count?: number;
  point_count_abbreviated?: string;
  avg_price?: number;
}

interface ClusterFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: ClusterProperties & Partial<PropertyPoint>;
}

interface WorkerResponse {
  type: string;
  id: string;
  payload: unknown;
}

interface LoadedPayload {
  success: boolean;
  pointCount: number;
  duration: number;
}

interface ClustersPayload {
  clusters: ClusterFeature[];
  count: number;
  duration: number;
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

export function useClusterWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRequests = useRef<Map<string, PendingRequest>>(new Map());
  const timeoutIds = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const requestIdCounter = useRef(0);
  const [isReady, setIsReady] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Generar ID único para cada request
  const generateId = useCallback(() => {
    return `req_${++requestIdCounter.current}_${Date.now()}`;
  }, []);

  // Inicializar worker
  useEffect(() => {
    // Crear worker
    const worker = new Worker(
      new URL('../workers/cluster.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { type, id, payload } = e.data;

      // Manejar mensaje de ready inicial
      if (type === 'ready') {
        setIsReady(true);
        return;
      }

      // Manejar respuesta a request pendiente
      const pending = pendingRequests.current.get(id);
      if (pending) {
        pendingRequests.current.delete(id);
        // Clear the timeout for this request
        const timeoutId = timeoutIds.current.get(id);
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutIds.current.delete(id);
        }

        if (type === 'error') {
          pending.reject(new Error((payload as { message: string }).message));
        } else {
          pending.resolve(payload);
        }
      }
    };

    worker.onerror = (e) => {
      console.error('[ClusterWorker] Error:', e);
      setError(new Error(e.message));
    };

    workerRef.current = worker;

    // Cleanup
    return () => {
      worker.terminate();
      workerRef.current = null;
      pendingRequests.current.clear();
      // Clear all pending timeouts to prevent memory leaks
      timeoutIds.current.forEach(clearTimeout);
      timeoutIds.current.clear();
    };
  }, []);

  // Enviar mensaje al worker y esperar respuesta
  const sendMessage = useCallback(
    <T>(type: string, payload?: unknown): Promise<T> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not initialized'));
          return;
        }

        const id = generateId();
        pendingRequests.current.set(id, {
          resolve: resolve as (value: unknown) => void,
          reject
        });

        workerRef.current.postMessage({ type, id, payload });

        // Timeout después de 30 segundos (tracked for cleanup)
        const timeoutId = setTimeout(() => {
          if (pendingRequests.current.has(id)) {
            pendingRequests.current.delete(id);
            timeoutIds.current.delete(id);
            reject(new Error('Worker request timeout'));
          }
        }, 30000);
        timeoutIds.current.set(id, timeoutId);
      });
    },
    [generateId]
  );

  // Cargar puntos en el worker
  const load = useCallback(
    async (points: PropertyPoint[], options?: Record<string, unknown>) => {
      try {
        const result = await sendMessage<LoadedPayload>('load', { points, options });
        setIsLoaded(true);
        console.log(
          `[ClusterWorker] Loaded ${result.pointCount} points in ${result.duration}ms`
        );
        return result;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load points'));
        throw err;
      }
    },
    [sendMessage]
  );

  // Obtener clusters para un viewport
  const getClusters = useCallback(
    async (
      bbox: [number, number, number, number],
      zoom: number
    ): Promise<ClusterFeature[]> => {
      if (!isLoaded) {
        console.warn('[ClusterWorker] Not loaded yet, returning empty array');
        return [];
      }

      try {
        const result = await sendMessage<ClustersPayload>('getClusters', {
          bbox,
          zoom,
        });
        return result.clusters;
      } catch (err) {
        console.error('[ClusterWorker] getClusters error:', err);
        return [];
      }
    },
    [isLoaded, sendMessage]
  );

  // Obtener zoom de expansión de un cluster
  const getClusterExpansionZoom = useCallback(
    async (clusterId: number): Promise<number> => {
      const result = await sendMessage<{ zoom: number }>('getClusterExpansionZoom', {
        clusterId,
      });
      return result.zoom;
    },
    [sendMessage]
  );

  // Obtener propiedades dentro de un cluster
  const getClusterLeaves = useCallback(
    async (
      clusterId: number,
      limit = 100,
      offset = 0
    ): Promise<ClusterFeature[]> => {
      const result = await sendMessage<{ leaves: ClusterFeature[] }>('getClusterLeaves', {
        clusterId,
        limit,
        offset,
      });
      return result.leaves;
    },
    [sendMessage]
  );

  return {
    isReady,
    isLoaded,
    error,
    load,
    getClusters,
    getClusterExpansionZoom,
    getClusterLeaves,
  };
}
