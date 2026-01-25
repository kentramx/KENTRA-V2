import { Toaster } from 'react-hot-toast';
import { SearchMap } from '@/components/search/SearchMap';
import { PropertyList } from '@/components/search/PropertyList';
import { MapFilters } from '@/components/search/MapFilters';
import { MapDebugPanel } from '@/components/search/MapDebugPanel';

export default function Buscar() {
  return (
    <>
      <Toaster
        position="bottom-right"
        toastOptions={{
          error: {
            duration: 10000,
            style: {
              background: '#7f1d1d',
              color: '#fecaca',
              border: '1px solid #dc2626',
            },
          },
        }}
      />

      <div className="h-screen flex flex-col">
        {/* Filtros */}
        <MapFilters />

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Lista */}
          <div className="w-[400px] flex-shrink-0 border-r overflow-hidden">
            <PropertyList />
          </div>

          {/* Mapa */}
          <div className="flex-1 relative">
            <SearchMap />
          </div>
        </div>
      </div>

      {/* Debug Panel */}
      <MapDebugPanel />
    </>
  );
}
