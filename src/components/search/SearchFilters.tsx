/**
 * SearchFilters - Horizontal filter bar for map search
 */

import { useMapStore } from '@/stores/mapStore';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { X, Home, Building2 } from 'lucide-react';
import { PROPERTY_TYPES, PROPERTY_CATEGORIES, type PropertyCategory } from '@/config/propertyTypes';
import { cn } from '@/lib/utils';

export function SearchFilters() {
  const { filters, updateFilter, resetFilters, totalCount, isLoading } = useMapStore();

  const hasFilters = Object.values(filters).some(v => v !== undefined && v !== '');

  // Group property types by category
  const groupedTypes = PROPERTY_TYPES.reduce((acc, type) => {
    if (!acc[type.category]) {
      acc[type.category] = [];
    }
    acc[type.category].push(type);
    return acc;
  }, {} as Record<PropertyCategory, typeof PROPERTY_TYPES>);

  return (
    <div className="bg-card border-b border-border px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Listing Type Toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateFilter('listing_type', filters.listing_type === 'venta' ? undefined : 'venta')}
            className={cn(
              "rounded-none border-0 px-4",
              filters.listing_type === 'venta' && "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            <Home className="h-4 w-4 mr-1.5" />
            Venta
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateFilter('listing_type', filters.listing_type === 'renta' ? undefined : 'renta')}
            className={cn(
              "rounded-none border-0 border-l px-4",
              filters.listing_type === 'renta' && "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            <Building2 className="h-4 w-4 mr-1.5" />
            Renta
          </Button>
        </div>

        {/* Property Type */}
        <Select
          value={filters.property_type || ''}
          onValueChange={(v) => updateFilter('property_type', v || undefined)}
        >
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Tipo de propiedad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos los tipos</SelectItem>
            {Object.entries(groupedTypes).map(([category, types]) => (
              <div key={category}>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {PROPERTY_CATEGORIES[category as PropertyCategory]}
                </div>
                {types.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>

        {/* Price Range */}
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Precio mín"
            className="w-28 h-9"
            value={filters.min_price || ''}
            onChange={(e) => updateFilter('min_price', e.target.value ? Number(e.target.value) : undefined)}
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            placeholder="Precio máx"
            className="w-28 h-9"
            value={filters.max_price || ''}
            onChange={(e) => updateFilter('max_price', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>

        {/* Bedrooms */}
        <Select
          value={filters.min_bedrooms?.toString() || ''}
          onValueChange={(v) => updateFilter('min_bedrooms', v ? Number(v) : undefined)}
        >
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="Recámaras" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Cualquiera</SelectItem>
            <SelectItem value="1">1+ recámaras</SelectItem>
            <SelectItem value="2">2+ recámaras</SelectItem>
            <SelectItem value="3">3+ recámaras</SelectItem>
            <SelectItem value="4">4+ recámaras</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Limpiar
          </Button>
        )}

        {/* Results Count */}
        <div className="ml-auto text-sm text-muted-foreground">
          {isLoading ? (
            <span className="animate-pulse">Buscando...</span>
          ) : (
            <span>{totalCount.toLocaleString()} propiedades</span>
          )}
        </div>
      </div>
    </div>
  );
}
