

# Plan: Agregar 16 Nuevos Tipos de Inmuebles a Kentra

## Resumen Ejecutivo

Expandir Kentra de 8 a 24 tipos de propiedades, organizados por categorías como Inmuebles24. Esto incluye tipos residenciales, comerciales, industriales, terrenos especializados y desarrollos.

---

## Tipos de Inmuebles a Agregar

### Organización por Categorías

| Categoría | Tipos Actuales | Nuevos Tipos |
|-----------|----------------|--------------|
| **Residencial** | casa, departamento, rancho | casa_condominio, duplex, penthouse, villa, loft, townhouse, estudio |
| **Comercial** | oficina, local, edificio | consultorio, hotel |
| **Industrial** | bodega | nave_industrial |
| **Terrenos** | terreno | terreno_comercial, terreno_industrial |
| **Desarrollos** | - | desarrollo_vertical, desarrollo_horizontal |

### Total: 8 actuales + 16 nuevos = 24 tipos

---

## Archivos a Modificar

### 1. src/types/property.ts (Líneas 205-213)

**Actual:**
```typescript
export type PropertyType =
  | 'casa'
  | 'departamento'
  | 'terreno'
  | 'oficina'
  | 'local'
  | 'bodega'
  | 'edificio'
  | 'rancho';
```

**Nuevo:**
```typescript
export type PropertyType =
  // Residencial
  | 'casa'
  | 'casa_condominio'
  | 'departamento'
  | 'duplex'
  | 'penthouse'
  | 'villa'
  | 'loft'
  | 'townhouse'
  | 'estudio'
  | 'rancho'
  // Comercial
  | 'oficina'
  | 'local'
  | 'consultorio'
  | 'edificio'
  | 'hotel'
  // Industrial
  | 'bodega'
  | 'nave_industrial'
  // Terrenos
  | 'terreno'
  | 'terreno_comercial'
  | 'terreno_industrial'
  // Desarrollos
  | 'desarrollo_vertical'
  | 'desarrollo_horizontal';
```

---

### 2. src/config/propertyTypes.ts (Archivo Nuevo)

Crear un archivo centralizado para manejar la configuración de tipos de propiedades:

```typescript
import { 
  Home, Building2, Mountain, Briefcase, Store, Warehouse, 
  Building, Trees, Hotel, Factory, Layers, Grid3X3, 
  Castle, House, Landmark, Blocks, Building as BuildingIcon
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface PropertyTypeConfig {
  value: string;
  label: string;
  icon: LucideIcon;
  category: PropertyCategory;
  hasRooms: boolean;      // Tiene recámaras/baños
  hasParking: boolean;    // Tiene estacionamiento
  hasSqft: boolean;       // Tiene m² construcción
  hasLotSize: boolean;    // Tiene m² terreno
}

export type PropertyCategory = 
  | 'residencial' 
  | 'comercial' 
  | 'industrial' 
  | 'terrenos' 
  | 'desarrollos';

export const PROPERTY_CATEGORIES: Record<PropertyCategory, string> = {
  residencial: 'Residencial',
  comercial: 'Comercial',
  industrial: 'Industrial',
  terrenos: 'Terrenos',
  desarrollos: 'Desarrollos',
};

export const PROPERTY_TYPES: PropertyTypeConfig[] = [
  // === RESIDENCIAL ===
  { value: 'casa', label: 'Casa', icon: Home, category: 'residencial', hasRooms: true, hasParking: true, hasSqft: true, hasLotSize: true },
  { value: 'casa_condominio', label: 'Casa en Condominio', icon: Home, category: 'residencial', hasRooms: true, hasParking: true, hasSqft: true, hasLotSize: true },
  { value: 'departamento', label: 'Departamento', icon: Building2, category: 'residencial', hasRooms: true, hasParking: true, hasSqft: true, hasLotSize: false },
  { value: 'duplex', label: 'Dúplex', icon: Layers, category: 'residencial', hasRooms: true, hasParking: true, hasSqft: true, hasLotSize: false },
  { value: 'penthouse', label: 'Penthouse', icon: Building2, category: 'residencial', hasRooms: true, hasParking: true, hasSqft: true, hasLotSize: false },
  { value: 'villa', label: 'Villa', icon: Castle, category: 'residencial', hasRooms: true, hasParking: true, hasSqft: true, hasLotSize: true },
  { value: 'loft', label: 'Loft', icon: Grid3X3, category: 'residencial', hasRooms: true, hasParking: true, hasSqft: true, hasLotSize: false },
  { value: 'townhouse', label: 'Townhouse', icon: House, category: 'residencial', hasRooms: true, hasParking: true, hasSqft: true, hasLotSize: true },
  { value: 'estudio', label: 'Estudio', icon: Building2, category: 'residencial', hasRooms: false, hasParking: true, hasSqft: true, hasLotSize: false },
  { value: 'rancho', label: 'Rancho', icon: Trees, category: 'residencial', hasRooms: true, hasParking: true, hasSqft: true, hasLotSize: true },

  // === COMERCIAL ===
  { value: 'oficina', label: 'Oficina', icon: Briefcase, category: 'comercial', hasRooms: false, hasParking: true, hasSqft: true, hasLotSize: false },
  { value: 'local', label: 'Local Comercial', icon: Store, category: 'comercial', hasRooms: false, hasParking: true, hasSqft: true, hasLotSize: false },
  { value: 'consultorio', label: 'Consultorio', icon: Landmark, category: 'comercial', hasRooms: false, hasParking: true, hasSqft: true, hasLotSize: false },
  { value: 'edificio', label: 'Edificio', icon: Building, category: 'comercial', hasRooms: false, hasParking: true, hasSqft: true, hasLotSize: true },
  { value: 'hotel', label: 'Hotel', icon: Hotel, category: 'comercial', hasRooms: true, hasParking: true, hasSqft: true, hasLotSize: true },

  // === INDUSTRIAL ===
  { value: 'bodega', label: 'Bodega', icon: Warehouse, category: 'industrial', hasRooms: false, hasParking: true, hasSqft: true, hasLotSize: true },
  { value: 'nave_industrial', label: 'Nave Industrial', icon: Factory, category: 'industrial', hasRooms: false, hasParking: true, hasSqft: true, hasLotSize: true },

  // === TERRENOS ===
  { value: 'terreno', label: 'Terreno', icon: Mountain, category: 'terrenos', hasRooms: false, hasParking: false, hasSqft: false, hasLotSize: true },
  { value: 'terreno_comercial', label: 'Terreno Comercial', icon: Mountain, category: 'terrenos', hasRooms: false, hasParking: false, hasSqft: false, hasLotSize: true },
  { value: 'terreno_industrial', label: 'Terreno Industrial', icon: Mountain, category: 'terrenos', hasRooms: false, hasParking: false, hasSqft: false, hasLotSize: true },

  // === DESARROLLOS ===
  { value: 'desarrollo_vertical', label: 'Desarrollo Vertical', icon: Blocks, category: 'desarrollos', hasRooms: true, hasParking: true, hasSqft: true, hasLotSize: true },
  { value: 'desarrollo_horizontal', label: 'Desarrollo Horizontal', icon: Grid3X3, category: 'desarrollos', hasRooms: true, hasParking: true, hasSqft: true, hasLotSize: true },
];

// Helpers
export const getPropertyTypeConfig = (value: string): PropertyTypeConfig | undefined => 
  PROPERTY_TYPES.find(t => t.value === value);

export const getPropertyTypesByCategory = (category: PropertyCategory): PropertyTypeConfig[] =>
  PROPERTY_TYPES.filter(t => t.category === category);

export const getPropertyTypeLabel = (value: string): string =>
  PROPERTY_TYPES.find(t => t.value === value)?.label || value;
```

---

### 3. src/components/property-form/shared/PropertyTypeSelector.tsx

Reescribir para usar la configuración centralizada con categorías:

```typescript
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { 
  PROPERTY_TYPES, 
  PROPERTY_CATEGORIES, 
  getPropertyTypesByCategory,
  PropertyCategory 
} from '@/config/propertyTypes';

interface PropertyTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export const PropertyTypeSelector = ({ value, onChange }: PropertyTypeSelectorProps) => {
  const categories: PropertyCategory[] = ['residencial', 'comercial', 'industrial', 'terrenos', 'desarrollos'];

  return (
    <div className="space-y-6">
      <Label className="flex items-center gap-1 text-lg">
        Tipo de Propiedad
        <span className="text-destructive">*</span>
      </Label>
      
      {categories.map((category) => {
        const types = getPropertyTypesByCategory(category);
        
        return (
          <div key={category} className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              {PROPERTY_CATEGORIES[category]}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {types.map((type) => {
                const Icon = type.icon;
                const isSelected = value === type.value;
                
                return (
                  <Card
                    key={type.value}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md",
                      isSelected && "ring-2 ring-primary bg-primary/5"
                    )}
                    onClick={() => onChange(type.value)}
                  >
                    <div className="flex flex-col items-center justify-center p-3 gap-2">
                      <Icon className={cn(
                        "w-6 h-6",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )} />
                      <span className={cn(
                        "text-xs font-medium text-center",
                        isSelected ? "text-primary" : "text-foreground"
                      )}>
                        {type.label}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
```

---

### 4. src/components/search/MapFilters.tsx (Líneas 21-33)

Actualizar el dropdown de filtro de tipo de propiedad con categorías:

```typescript
import { PROPERTY_TYPES, PROPERTY_CATEGORIES, PropertyCategory } from '@/config/propertyTypes';

// Dentro del componente, reemplazar el select de property_type:
<select
  value={filters.property_type || ''}
  onChange={(e) => updateFilter('property_type', e.target.value || undefined)}
  className="px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
>
  <option value="">Tipo de propiedad</option>
  {(['residencial', 'comercial', 'industrial', 'terrenos', 'desarrollos'] as PropertyCategory[]).map(category => (
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
```

---

### 5. src/components/property-form/steps/Step6Review.tsx (Líneas 20-36)

Reemplazar el objeto `propertyTypeLabels` con la función centralizada:

```typescript
import { getPropertyTypeLabel } from '@/config/propertyTypes';

// Línea 38, cambiar:
const typeLabel = getPropertyTypeLabel(formData.type);
```

---

### 6. src/components/PropertyCard.tsx

Agregar helper para mostrar el tipo de propiedad:

```typescript
import { getPropertyTypeLabel } from '@/config/propertyTypes';

// En el renderizado del tipo de propiedad (si existe):
<span>{getPropertyTypeLabel(type)}</span>
```

---

### 7. src/components/AgentSearchBar.tsx

No requiere cambios - no tiene filtro de tipo de propiedad.

---

### 8. Edge Functions (Sin cambios)

Las Edge Functions (`property-search-unified`, `property-search`, etc.) ya manejan `property_type` como string, por lo que **no requieren cambios** - aceptarán cualquier valor nuevo automáticamente.

---

### 9. Base de Datos (Sin cambios)

La columna `type` en la tabla `properties` es de tipo `text`, no un ENUM, por lo que **no requiere migración** - los nuevos tipos se almacenarán automáticamente.

---

## Diagrama de Arquitectura

```text
┌─────────────────────────────────────────────────────────────┐
│                  src/config/propertyTypes.ts                │
│         (Fuente única de verdad - 24 tipos)                 │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ PropertyType    │  │ PropertyType    │  │ MapFilters.tsx  │
│ Selector.tsx    │  │ Labels (Review) │  │ (Búsqueda)      │
│ (Form Wizard)   │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                     types/property.ts                       │
│               (PropertyType union type)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Beneficios de Esta Arquitectura

1. **Fuente Única de Verdad**: Todos los componentes usan `propertyTypes.ts`
2. **Fácil Mantenimiento**: Agregar un nuevo tipo = 1 línea en el config
3. **Campos Dinámicos**: El config define si cada tipo tiene recámaras, baños, etc.
4. **SEO Amigable**: Labels en español para toda la UI
5. **Backward Compatible**: Los datos existentes siguen funcionando

---

## Estimación

| Archivo | Tipo de Cambio | Líneas |
|---------|----------------|--------|
| src/config/propertyTypes.ts | Nuevo | ~100 |
| src/types/property.ts | Modificar | ~25 |
| PropertyTypeSelector.tsx | Reescribir | ~60 |
| MapFilters.tsx | Modificar | ~20 |
| Step6Review.tsx | Modificar | ~5 |
| PropertyCard.tsx | Modificar | ~3 |

**Total:** 6 archivos, ~213 líneas de código
**Riesgo:** Bajo (no hay cambios en base de datos)
**Tiempo estimado:** 15-20 minutos

