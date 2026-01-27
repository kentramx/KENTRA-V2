import { memo, useRef, useEffect } from 'react';
import { useMapStore } from '@/stores/mapStore';
import { Loader2, Bed, Bath, Square, ChevronLeft, ChevronRight } from 'lucide-react';

export const PropertyList = memo(function PropertyList() {
  const listRef = useRef<HTMLDivElement>(null);

  const {
    selectedPropertyId,
    setSelectedPropertyId,
    hoveredPropertyId,
    setHoveredPropertyId,
    // List data from unified store (populated by usePropertySearchUnified in SearchMap)
    listProperties: properties,
    listTotal: total,
    listPage: page,
    listPages: pages,
    isListLoading: isLoading,
    setListPage: setPage,
  } = useMapStore();

  // Scroll to selected property
  useEffect(() => {
    if (!selectedPropertyId || !listRef.current) return;

    const element = listRef.current.querySelector(`[data-property-id="${selectedPropertyId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedPropertyId]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gray-50">
        <h2 className="font-semibold text-gray-900">
          {isLoading ? 'Buscando...' : `${total.toLocaleString()} propiedades`}
        </h2>
      </div>

      {/* Lista */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : properties.length > 0 ? (
          <div className="divide-y">
            {properties.map((property) => (
              <article
                key={property.id}
                data-property-id={property.id}
                onClick={() => setSelectedPropertyId(property.id)}
                onMouseEnter={() => setHoveredPropertyId(property.id)}
                onMouseLeave={() => setHoveredPropertyId(null)}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedPropertyId === property.id
                    ? 'bg-blue-50 border-l-4 border-l-blue-600'
                    : hoveredPropertyId === property.id
                    ? 'bg-gray-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <p className="text-lg font-bold text-gray-900">
                  {formatPrice(property.price)}
                  {property.listing_type === 'renta' && (
                    <span className="text-sm font-normal text-gray-500">/mes</span>
                  )}
                </p>

                <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                  {property.bedrooms && (
                    <span className="flex items-center gap-1">
                      <Bed className="w-4 h-4" />
                      {property.bedrooms}
                    </span>
                  )}
                  {property.bathrooms && (
                    <span className="flex items-center gap-1">
                      <Bath className="w-4 h-4" />
                      {property.bathrooms}
                    </span>
                  )}
                  {property.construction_m2 && (
                    <span className="flex items-center gap-1">
                      <Square className="w-4 h-4" />
                      {property.construction_m2} m²
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-gray-900 truncate">
                  {property.title}
                </p>

                <p className="mt-0.5 text-xs text-gray-500 truncate">
                  {[property.neighborhood, property.city].filter(Boolean).join(', ')}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <p>No se encontraron propiedades</p>
            <p className="text-sm">Intenta ajustar los filtros</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="px-4 py-3 border-t flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <span className="text-sm text-gray-600">
            Página {page} de {pages}
          </span>

          <button
            onClick={() => setPage(page + 1)}
            disabled={page === pages}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
});
