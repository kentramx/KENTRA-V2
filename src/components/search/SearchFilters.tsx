import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { MapPin, Bed, Bath, Car, Search, X, Tag, TrendingUp, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { mexicoStates, mexicoMunicipalities } from '@/data/mexicoLocations';

interface Filters {
  estado: string;
  municipio: string;
  precioMin: string;
  precioMax: string;
  tipo: string;
  listingType: string;
  recamaras: string;
  banos: string;
  orden: 'price_desc' | 'price_asc' | 'newest' | 'oldest' | 'bedrooms_desc' | 'sqft_desc';
}

interface SearchFiltersProps {
  filters: Filters;
  onFilterChange: (key: keyof Filters, value: string) => void;
  onResetFilters: () => void;
  onSearch: () => void;
  activeFiltersCount: number;
  propertyCount?: number;
}

const getTipoLabel = (tipo: string) => {
  const labels: Record<string, string> = {
    casa: '🏠 Casa',
    departamento: '🏢 Depto',
    terreno: '🌳 Terreno',
    oficina: '💼 Oficina',
    local: '🏪 Local',
    bodega: '📦 Bodega',
    edificio: '🏛️ Edificio',
    rancho: '🐎 Rancho'
  };
  return labels[tipo] || tipo;
};

export const SearchFilters = ({
  filters,
  onFilterChange,
  onResetFilters,
  onSearch,
  activeFiltersCount,
  propertyCount = 0,
}: SearchFiltersProps) => {
  const stateOptions = mexicoStates.map(state => ({
    value: state,
    label: state,
  }));

  const municipalityOptions = filters.estado
    ? (mexicoMunicipalities[filters.estado] || []).map(mun => ({
        value: mun,
        label: mun,
      }))
    : [];

  const propertyTypes = [
    { value: 'casa', label: '🏠 Casa' },
    { value: 'departamento', label: '🏢 Departamento' },
    { value: 'terreno', label: '🌳 Terreno' },
    { value: 'oficina', label: '💼 Oficina' },
    { value: 'local', label: '🏪 Local Comercial' },
    { value: 'bodega', label: '📦 Bodega' },
    { value: 'edificio', label: '🏛️ Edificio' },
    { value: 'rancho', label: '🐎 Rancho' },
  ];

  const renderFilterChips = () => {
    const chips = [];
    
    if (filters.estado) chips.push({ key: 'estado', label: filters.estado });
    if (filters.municipio) chips.push({ key: 'municipio', label: filters.municipio });
    if (filters.tipo) chips.push({ key: 'tipo', label: getTipoLabel(filters.tipo) });
    if (filters.listingType) chips.push({ key: 'listingType', label: filters.listingType === 'sale' ? 'Venta' : 'Renta' });
    if (filters.precioMin) chips.push({ key: 'precioMin', label: `Min: $${parseInt(filters.precioMin).toLocaleString()}` });
    if (filters.precioMax) chips.push({ key: 'precioMax', label: `Max: $${parseInt(filters.precioMax).toLocaleString()}` });
    if (filters.recamaras) chips.push({ key: 'recamaras', label: `${filters.recamaras}+ recámaras` });
    if (filters.banos) chips.push({ key: 'banos', label: `${filters.banos}+ baños` });

    return chips;
  };

  const FilterContent = () => (
    <div className="space-y-4">
      {/* Ubicación */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Ubicación
        </Label>
        <Combobox
          options={stateOptions}
          value={filters.estado}
          onValueChange={(value) => onFilterChange('estado', value)}
          placeholder="Seleccionar estado"
          searchPlaceholder="Buscar estado..."
          emptyText="No se encontró el estado"
        />
        {filters.estado && (
          <Combobox
            options={municipalityOptions}
            value={filters.municipio}
            onValueChange={(value) => onFilterChange('municipio', value)}
            placeholder="Seleccionar municipio"
            searchPlaceholder="Buscar municipio..."
            emptyText="No se encontró el municipio"
          />
        )}
      </div>

      <Separator />

      {/* Tipo de propiedad */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Tipo de Propiedad
        </Label>
        <Select value={filters.tipo || "all"} onValueChange={(value) => onFilterChange('tipo', value === "all" ? "" : value)}>
          <SelectTrigger>
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {propertyTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tipo de operación */}
      <div className="space-y-2">
        <Label>Tipo de Operación</Label>
        <RadioGroup value={filters.listingType} onValueChange={(value) => onFilterChange('listingType', value)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="" id="all" />
            <Label htmlFor="all" className="font-normal cursor-pointer">Todas</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="sale" id="sale" />
            <Label htmlFor="sale" className="font-normal cursor-pointer">En Venta</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="rent" id="rent" />
            <Label htmlFor="rent" className="font-normal cursor-pointer">En Renta</Label>
          </div>
        </RadioGroup>
      </div>

      <Separator />

      {/* Rango de precio */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Rango de Precio
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="Precio mínimo"
            value={filters.precioMin}
            onChange={(e) => onFilterChange('precioMin', e.target.value)}
          />
          <Input
            type="number"
            placeholder="Precio máximo"
            value={filters.precioMax}
            onChange={(e) => onFilterChange('precioMax', e.target.value)}
          />
        </div>
      </div>

      <Separator />

      {/* Recámaras */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Bed className="h-4 w-4" />
          Recámaras
        </Label>
        <Select value={filters.recamaras || "0"} onValueChange={(value) => onFilterChange('recamaras', value === "0" ? "" : value)}>
          <SelectTrigger>
            <SelectValue placeholder="Cualquier cantidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Cualquier cantidad</SelectItem>
            <SelectItem value="1">1+</SelectItem>
            <SelectItem value="2">2+</SelectItem>
            <SelectItem value="3">3+</SelectItem>
            <SelectItem value="4">4+</SelectItem>
            <SelectItem value="5">5+</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Baños */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Bath className="h-4 w-4" />
          Baños
        </Label>
        <Select value={filters.banos || "0"} onValueChange={(value) => onFilterChange('banos', value === "0" ? "" : value)}>
          <SelectTrigger>
            <SelectValue placeholder="Cualquier cantidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Cualquier cantidad</SelectItem>
            <SelectItem value="1">1+</SelectItem>
            <SelectItem value="2">2+</SelectItem>
            <SelectItem value="3">3+</SelectItem>
            <SelectItem value="4">4+</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Ordenar por */}
      <div className="space-y-2">
        <Label>Ordenar por</Label>
        <Select value={filters.orden} onValueChange={(value) => onFilterChange('orden', value as Filters['orden'])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Más recientes</SelectItem>
            <SelectItem value="oldest">Más antiguas</SelectItem>
            <SelectItem value="price_asc">Precio: menor a mayor</SelectItem>
            <SelectItem value="price_desc">Precio: mayor a menor</SelectItem>
            <SelectItem value="bedrooms_desc">Más recámaras</SelectItem>
            <SelectItem value="sqft_desc">Mayor superficie</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Botones */}
      <div className="flex gap-2 pt-4">
        <Button onClick={onSearch} className="flex-1">
          <Search className="mr-2 h-4 w-4" />
          Buscar
        </Button>
        {activeFiltersCount > 0 && (
          <Button onClick={onResetFilters} variant="outline">
            <X className="mr-2 h-4 w-4" />
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Filters */}
      <div className="hidden lg:block">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Filtros</h2>
              {activeFiltersCount > 0 && (
                <Badge variant="secondary">{activeFiltersCount} activos</Badge>
              )}
            </div>
            <FilterContent />
          </CardContent>
        </Card>
      </div>

      {/* Mobile Filters */}
      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-full sm:max-w-md">
            <ScrollArea className="h-full pr-4">
              <FilterContent />
            </ScrollArea>
          </SheetContent>
        </Sheet>

        {/* Active Filter Chips */}
        {renderFilterChips().length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {renderFilterChips().map((chip) => (
              <Badge
                key={chip.key}
                variant="secondary"
                className="cursor-pointer"
                onClick={() => onFilterChange(chip.key as keyof Filters, '')}
              >
                {chip.label}
                <X className="ml-1 h-3 w-3" />
              </Badge>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
