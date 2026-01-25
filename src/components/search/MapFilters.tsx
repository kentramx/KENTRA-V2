import { memo } from 'react';
import { useMapStore } from '@/stores/mapStore';
import { X } from 'lucide-react';

export const MapFilters = memo(function MapFilters() {
  const { filters, updateFilter, resetFilters, hasActiveFilters } = useMapStore();

  return (
    <div className="flex flex-wrap items-center gap-2 p-4 border-b bg-white">
      {/* Tipo de listado */}
      <select
        value={filters.listing_type || ''}
        onChange={(e) => updateFilter('listing_type', e.target.value as any || undefined)}
        className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Comprar o Rentar</option>
        <option value="venta">Comprar</option>
        <option value="renta">Rentar</option>
      </select>

      {/* Tipo de propiedad */}
      <select
        value={filters.property_type || ''}
        onChange={(e) => updateFilter('property_type', e.target.value || undefined)}
        className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Tipo de propiedad</option>
        <option value="casa">Casa</option>
        <option value="departamento">Departamento</option>
        <option value="terreno">Terreno</option>
        <option value="oficina">Oficina</option>
        <option value="local">Local comercial</option>
      </select>

      {/* Precio mínimo */}
      <input
        type="number"
        placeholder="Precio mín"
        value={filters.min_price || ''}
        onChange={(e) => updateFilter('min_price', e.target.value ? Number(e.target.value) : undefined)}
        className="w-32 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Precio máximo */}
      <input
        type="number"
        placeholder="Precio máx"
        value={filters.max_price || ''}
        onChange={(e) => updateFilter('max_price', e.target.value ? Number(e.target.value) : undefined)}
        className="w-32 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Recámaras */}
      <select
        value={filters.min_bedrooms || ''}
        onChange={(e) => updateFilter('min_bedrooms', e.target.value ? Number(e.target.value) : undefined)}
        className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Recámaras</option>
        <option value="1">1+</option>
        <option value="2">2+</option>
        <option value="3">3+</option>
        <option value="4">4+</option>
        <option value="5">5+</option>
      </select>

      {/* Limpiar filtros */}
      {hasActiveFilters() && (
        <button
          onClick={resetFilters}
          className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
          Limpiar
        </button>
      )}
    </div>
  );
});
