import { memo } from 'react';
import { useMapStore } from '@/stores/mapStore';

export const MapDebugPanel = memo(function MapDebugPanel() {
  const {
    viewport,
    filters,
    mode,
    clusters,
    mapProperties,
    listProperties,
    totalInViewport,
    isMapLoading,
    isListLoading,
    mapError,
    listError,
    selectedPropertyId,
    hoveredPropertyId,
    hasActiveFilters,
    lastRequestMeta,
  } = useMapStore();

  // Solo mostrar en desarrollo o con ?debug=true
  const showDebug = import.meta.env.DEV ||
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'));

  if (!showDebug) return null;

  const hasError = mapError || listError;

  return (
    <div
      className={`
        fixed bottom-4 right-4 z-[9999]
        ${hasError ? 'bg-red-900/95' : 'bg-black/95'}
        text-white rounded-lg shadow-2xl border
        ${hasError ? 'border-red-500' : 'border-green-500/30'}
        font-mono text-xs w-80 max-h-[60vh] overflow-auto
      `}
    >
      {/* Header */}
      <div className="p-2 border-b border-white/10 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span>{hasError ? '🔴' : '🟢'}</span>
          <span className="font-bold">MAP DEBUG</span>
        </span>
        <span className="flex items-center gap-2">
          {(isMapLoading || isListLoading) && <span className="animate-pulse">⏳</span>}
        </span>
      </div>

      <div className="p-3 space-y-3">
        {/* Errores */}
        {(mapError || listError) && (
          <div className="p-2 bg-red-800/50 rounded border border-red-500">
            <div className="font-bold text-red-300 mb-1">❌ ERRORES</div>
            {mapError && <div className="text-red-200">Map: {mapError.message}</div>}
            {listError && <div className="text-red-200">List: {listError.message}</div>}
          </div>
        )}

        {/* Status Grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-gray-400">Zoom:</span>
          <span className="text-cyan-400">{viewport?.zoom ?? 'null'}</span>

          <span className="text-gray-400">Mode:</span>
          <span className={mode === 'clusters' ? 'text-blue-400' : 'text-purple-400'}>
            {mode}
          </span>

          <span className="text-gray-400">Clusters:</span>
          <span className="text-white">{clusters.length}</span>

          <span className="text-gray-400">Map Props:</span>
          <span className="text-white">{mapProperties.length}</span>

          <span className="text-gray-400">List Props:</span>
          <span className="text-white">{listProperties.length}</span>

          <span className="text-gray-400">Total:</span>
          <span className="text-green-400">{totalInViewport.toLocaleString()}</span>

          <span className="text-gray-400">Selected:</span>
          <span className="text-white truncate">{selectedPropertyId?.slice(0, 8) || 'none'}</span>

          <span className="text-gray-400">Hovered:</span>
          <span className="text-white truncate">{hoveredPropertyId?.slice(0, 8) || 'none'}</span>

          <span className="text-gray-400">Filters:</span>
          <span className={hasActiveFilters() ? 'text-orange-400' : 'text-gray-500'}>
            {hasActiveFilters() ? 'active' : 'none'}
          </span>
        </div>

        {/* Métricas */}
        {lastRequestMeta && (
          <div className="p-2 bg-gray-800/50 rounded">
            <div className="font-bold text-gray-300 mb-1">📊 Last Request</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-gray-400">Duration:</span>
              <span className={lastRequestMeta.duration_ms > 200 ? 'text-red-400' : 'text-green-400'}>
                {lastRequestMeta.duration_ms}ms
              </span>

              {lastRequestMeta.db_query_ms && (
                <>
                  <span className="text-gray-400">DB Query:</span>
                  <span className={lastRequestMeta.db_query_ms > 100 ? 'text-yellow-400' : 'text-green-400'}>
                    {lastRequestMeta.db_query_ms}ms
                  </span>
                </>
              )}

              {/* DEBUG: Clustering path */}
              {(lastRequestMeta as any).clustering_path && (
                <>
                  <span className="text-gray-400">Path:</span>
                  <span className={(lastRequestMeta as any).clustering_path === 'DYNAMIC_CLUSTERING' ? 'text-green-400' : 'text-yellow-400'}>
                    {(lastRequestMeta as any).clustering_path}
                  </span>
                </>
              )}

              {(lastRequestMeta as any).has_advanced_filters !== undefined && (
                <>
                  <span className="text-gray-400">Adv Filters:</span>
                  <span className={(lastRequestMeta as any).has_advanced_filters ? 'text-green-400' : 'text-gray-500'}>
                    {(lastRequestMeta as any).has_advanced_filters ? 'YES' : 'NO'}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Viewport */}
        <details className="text-[10px]">
          <summary className="cursor-pointer text-gray-400 hover:text-white">
            📍 Viewport
          </summary>
          <pre className="mt-1 p-2 bg-gray-800/50 rounded overflow-auto text-gray-300">
{viewport ? `Zoom: ${viewport.zoom}
N: ${viewport.bounds.north.toFixed(4)}
S: ${viewport.bounds.south.toFixed(4)}
E: ${viewport.bounds.east.toFixed(4)}
W: ${viewport.bounds.west.toFixed(4)}` : 'null'}
          </pre>
        </details>

        {/* Filters */}
        {hasActiveFilters() && (
          <details className="text-[10px]">
            <summary className="cursor-pointer text-gray-400 hover:text-white">
              🔍 Filters
            </summary>
            <pre className="mt-1 p-2 bg-gray-800/50 rounded overflow-auto text-gray-300">
              {JSON.stringify(filters, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
});
