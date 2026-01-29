import { memo } from 'react';
import { useMapStore } from '@/stores/mapStore';
import { X } from 'lucide-react';
import { PROPERTY_TYPES, PROPERTY_CATEGORIES, PropertyCategory } from '@/config/propertyTypes';

const CATEGORY_ORDER: PropertyCategory[] = ['residencial', 'comercial', 'industrial', 'terrenos', 'desarrollos'];

export const MapFilters = memo(function MapFilters() {
  const { filters, updateFilter, resetFilters, hasActiveFilters } = useMapStore();

  return (
    <div className="flex flex-wrap items-center gap-2 p-4 border-b bg-background">
      {/* Tipo de listado */}
      <select
        value={filters.listing_type || ''}
        onChange={(e) => updateFilter('listing_type', e.target.value as any || undefined)}
        className="px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">Comprar o Rentar</option>
        <option value="venta">Comprar</option>
        <option value="renta">Rentar</option>
      </select>

      {/* Tipo de propiedad con categorías */}
      <select
        value={filters.property_type || ''}
        onChange={(e) => updateFilter('property_type', e.target.value || undefined)}
        className="px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">Tipo de propiedad</option>
        {CATEGORY_ORDER.map(category => (
          <optgroup key={category} label={PROPERTY_CATEGORIES[category]}>
            {PROPERTY_TYPES
              .filter(t => t.category === category)
              .map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))
            }
          </optgroup>
        ))}
      </select>

      {/* Precio mínimo */}
      <input
        type="number"
        placeholder="Precio mín"
        value={filters.min_price || ''}
        onChange={(e) => updateFilter('min_price', e.target.value ? Number(e.target.value) : undefined)}
        className="w-32 px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
      />

      {/* Precio máximo */}
      <input
        type="number"
        placeholder="Precio máx"
        value={filters.max_price || ''}
        onChange={(e) => updateFilter('max_price', e.target.value ? Number(e.target.value) : undefined)}
        className="w-32 px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
      />

      {/* Recámaras */}
      <select
        value={filters.min_bedrooms || ''}
        onChange={(e) => updateFilter('min_bedrooms', e.target.value ? Number(e.target.value) : undefined)}
        className="px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
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
          className="flex items-center gap-1 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
          Limpiar
        </button>
      )}
    </div>
  );
});
