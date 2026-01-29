import { 
  Home, Building2, Mountain, Briefcase, Store, Warehouse, 
  Building, Trees, Hotel, Factory, Layers, LayoutGrid, 
  Castle, House, Landmark, Blocks
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
  { value: 'loft', label: 'Loft', icon: LayoutGrid, category: 'residencial', hasRooms: true, hasParking: true, hasSqft: true, hasLotSize: false },
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
  { value: 'desarrollo_horizontal', label: 'Desarrollo Horizontal', icon: LayoutGrid, category: 'desarrollos', hasRooms: true, hasParking: true, hasSqft: true, hasLotSize: true },
];

// Helpers
export const getPropertyTypeConfig = (value: string): PropertyTypeConfig | undefined => 
  PROPERTY_TYPES.find(t => t.value === value);

export const getPropertyTypesByCategory = (category: PropertyCategory): PropertyTypeConfig[] =>
  PROPERTY_TYPES.filter(t => t.category === category);

export const getPropertyTypeLabel = (value: string): string =>
  PROPERTY_TYPES.find(t => t.value === value)?.label || value;
