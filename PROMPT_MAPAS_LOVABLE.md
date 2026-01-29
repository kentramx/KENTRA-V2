# PROMPT PARA REHACER MAPAS - KENTRA

## CONTEXTO DEL PROYECTO

Kentra es un portal inmobiliario para México. Necesitamos reimplementar el sistema de mapas desde cero.

---

## TECH STACK ACTUAL

- **Frontend:** React 18 + TypeScript + Vite
- **UI:** shadcn/ui + Tailwind CSS + Radix UI
- **State:** Zustand
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **Routing:** React Router v6
- **Data Fetching:** TanStack React Query

---

## ESTRUCTURA DE DATOS

### Tabla `properties` (campos relevantes para mapas)

```sql
-- Identificación
id              UUID PRIMARY KEY
title           TEXT
slug            TEXT

-- Tipo
type            TEXT  -- 'casa', 'departamento', 'terreno', 'oficina', 'local', 'bodega', etc.
listing_type    TEXT  -- 'venta' o 'renta'

-- Precio
price           NUMERIC
currency        TEXT  -- 'MXN' o 'USD'

-- Características
bedrooms        INTEGER
bathrooms       INTEGER
sqft            NUMERIC  -- metros cuadrados construcción
lot_size        NUMERIC  -- metros cuadrados terreno

-- UBICACIÓN (CRÍTICO)
lat             NUMERIC  -- Latitud
lng             NUMERIC  -- Longitud
address         TEXT
colonia         TEXT     -- Colonia/Neighborhood
municipality    TEXT     -- Municipio/Ciudad
state           TEXT     -- Estado

-- Estado
status          TEXT  -- 'activa', 'pendiente', 'vendida', etc.

-- Media
images          JSONB  -- Array de { id, url, position }
```

---

## TIPOS DE PROPIEDAD

### Residencial
- `casa` - Casa
- `departamento` - Departamento
- `penthouse` - Penthouse
- `villa` - Villa
- `townhouse` - Townhouse
- `estudio` - Estudio
- `rancho` - Rancho

### Comercial
- `oficina` - Oficina
- `local` - Local Comercial
- `bodega` - Bodega
- `edificio` - Edificio

### Terrenos
- `terreno` - Terreno

---

## CONFIGURACIÓN GEOGRÁFICA DE MÉXICO

```typescript
const MEXICO_CONFIG = {
  // Límites geográficos de México
  bounds: {
    north: 32.72,
    south: 14.53,
    west: -118.4,
    east: -86.7
  },

  // Centro de México
  defaultCenter: {
    lat: 23.6345,
    lng: -102.5528
  },

  // Configuración de zoom
  zoom: {
    default: 6,        // Vista inicial (todo México)
    min: 4,            // Máximo alejado
    max: 18,           // Máximo acercado
    showPropertiesAt: 14  // A partir de zoom 14, mostrar propiedades individuales
  }
}
```

---

## ESTADOS Y MUNICIPIOS DE MÉXICO

```typescript
const mexicoStates = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche',
  'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima',
  'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo',
  'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca',
  'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa',
  'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán',
  'Zacatecas'
];

// Cada estado tiene sus municipios principales
const mexicoMunicipalities = {
  'Ciudad de México': ['Álvaro Obregón', 'Benito Juárez', 'Coyoacán', 'Cuauhtémoc', 'Miguel Hidalgo', ...],
  'Jalisco': ['Guadalajara', 'Zapopan', 'Tlaquepaque', 'Puerto Vallarta', ...],
  'Nuevo León': ['Monterrey', 'San Pedro Garza García', 'San Nicolás', ...],
  // ... etc
};
```

---

## PÁGINAS QUE NECESITAN MAPAS

### 1. `/buscar` - Página Principal de Búsqueda

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Header con filtros                                      │
├─────────────────┬───────────────────────────────────────┤
│                 │                                        │
│  Lista de       │           MAPA                         │
│  Propiedades    │      (clusters o marcadores)          │
│  (400px)        │                                        │
│                 │                                        │
│  - Cards        │                                        │
│  - Paginación   │                                        │
│                 │                                        │
└─────────────────┴───────────────────────────────────────┘
```

**Comportamiento del Mapa:**
1. **Zoom < 14:** Mostrar CLUSTERS (agrupaciones)
   - Círculo con número de propiedades
   - Click en cluster → hacer zoom a ese área

2. **Zoom >= 14:** Mostrar PROPIEDADES individuales
   - Marcador con precio
   - Click en marcador → seleccionar propiedad
   - Hover → highlight en lista

**Sincronización Mapa ↔ Lista:**
- La lista muestra las propiedades visibles en el viewport del mapa
- Mover/zoom el mapa → actualiza la lista
- Aplicar filtros → actualiza mapa Y lista
- Click en propiedad de lista → centra y selecciona en mapa

---

### 2. `/propiedad/:id` - Detalle de Propiedad

**Mapa Simple:**
- Un solo marcador en la ubicación de la propiedad
- Altura: 400px
- Controles de zoom
- Opción de Street View (si está disponible)

---

## FILTROS REQUERIDOS

```typescript
interface PropertyFilters {
  // Tipo de operación
  listing_type?: 'venta' | 'renta';

  // Tipo de propiedad
  property_type?: string;  // 'casa', 'departamento', etc.

  // Precio
  min_price?: number;
  max_price?: number;

  // Características
  min_bedrooms?: number;
  min_bathrooms?: number;
  min_sqft?: number;
  max_sqft?: number;

  // Ubicación
  state?: string;
  municipality?: string;
}
```

---

## UI/UX REQUERIDO

### Clusters
- Círculo con el número de propiedades
- Color por densidad (más propiedades = color más intenso)
- Tamaño proporcional a la cantidad

### Marcadores de Propiedad
- Mostrar precio formateado
  - `$2.5M` para millones
  - `$850K` para miles
- Color diferente para venta (verde) vs renta (azul)
- Estado hover: agrandar ligeramente
- Estado seleccionado: borde destacado

### PropertyCard en Lista
```typescript
interface PropertyCardData {
  id: string;
  title: string;
  slug: string;
  price: number;
  listing_type: 'venta' | 'renta';
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  address: string;
  city: string;
  state: string;
  image_url: string;  // Primera imagen
}
```

---

## ESTADO GLOBAL (Zustand Store)

```typescript
interface MapStore {
  // Viewport actual del mapa
  viewport: {
    bounds: { north, south, east, west };
    zoom: number;
    center: { lat, lng };
  };
  setViewport: (viewport) => void;

  // Filtros activos
  filters: PropertyFilters;
  updateFilter: (key, value) => void;
  resetFilters: () => void;

  // Modo de visualización
  mode: 'clusters' | 'properties';

  // Datos del mapa
  clusters: Cluster[];
  properties: MapProperty[];
  total: number;

  // Lista con paginación
  listProperties: MapProperty[];
  listPage: number;
  listPages: number;
  setListPage: (page) => void;

  // UI State
  selectedPropertyId: string | null;
  hoveredPropertyId: string | null;

  // Loading
  isLoading: boolean;
  error: Error | null;
}
```

---

## ENDPOINTS SUPABASE

### RPC: `search_properties_for_map`

```sql
CREATE OR REPLACE FUNCTION search_properties_for_map(
  p_north NUMERIC,
  p_south NUMERIC,
  p_east NUMERIC,
  p_west NUMERIC,
  p_zoom INTEGER,
  p_listing_type TEXT DEFAULT NULL,
  p_property_type TEXT DEFAULT NULL,
  p_min_price NUMERIC DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL,
  p_min_bedrooms INTEGER DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 20
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  v_mode TEXT;
  v_properties JSONB;
  v_total INTEGER;
BEGIN
  -- Si zoom >= 14, retornar propiedades individuales
  -- Si zoom < 14, retornar clusters agrupados por geohash

  -- Filtrar por:
  -- 1. Bounds del viewport
  -- 2. status = 'activa'
  -- 3. Todos los filtros opcionales

  RETURN jsonb_build_object(
    'mode', v_mode,
    'data', v_properties,
    'total', v_total,
    'page', p_page,
    'pages', CEIL(v_total::NUMERIC / p_limit)
  );
END;
$$ LANGUAGE plpgsql;
```

---

## ESTILOS DEL MAPA (Tipo Zillow)

```typescript
const mapStyles = [
  // Fondo base - beige claro
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#e7e6e5" }] },

  // Agua - azul suave
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#b1bdd6" }] },

  // Carreteras - blancas
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }] },

  // Ocultar POIs innecesarios
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },

  // Parques sutiles
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#c5dea2" }] },
];
```

---

## COLORES DEL TEMA KENTRA

```css
/* Primary - Verde Olivo */
--primary: hsl(82, 42%, 32%);
--primary-foreground: white;

/* Accent - Verde Claro */
--accent: hsl(82, 30%, 94%);

/* Muted */
--muted: hsl(220, 14%, 96%);
--muted-foreground: hsl(220, 9%, 46%);

/* Destructive */
--destructive: hsl(0, 84%, 60%);
```

---

## COMPONENTES A CREAR

1. **`SearchMap.tsx`** - Mapa principal para /buscar
2. **`MapFilters.tsx`** - Barra de filtros
3. **`PropertyList.tsx`** - Lista lateral de propiedades
4. **`PropertyCard.tsx`** - Card de propiedad para lista
5. **`ClusterMarker.tsx`** - Marcador de cluster
6. **`PropertyMarker.tsx`** - Marcador de propiedad
7. **`PropertyDetailMap.tsx`** - Mapa pequeño para detalle

---

## HOOKS A CREAR

1. **`useMapSearch`** - Hook principal para buscar propiedades/clusters
2. **`useMapStore`** - Acceso al store de Zustand
3. **`useGeocoding`** - Geocodificar direcciones

---

## LIBRERÍAS RECOMENDADAS

```json
{
  "react-map-gl": "^7.x",        // Wrapper de MapLibre para React
  "maplibre-gl": "^4.x",          // Motor de mapas (gratuito)
  "@react-google-maps/api": "^2.x" // Solo para Places Autocomplete
}
```

**Tiles gratuitos:**
- CARTO Light: `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json`
- OpenStreetMap

---

## FLUJO DE DATOS

```
Usuario mueve mapa
       ↓
setViewport({ bounds, zoom })
       ↓
useEffect detecta cambio
       ↓
Debounce 300ms
       ↓
Llamada a Supabase RPC
       ↓
Actualizar store con datos
       ↓
Re-render mapa y lista
```

---

## RESPONSIVE

- **Desktop (>1024px):** Layout split (lista + mapa)
- **Tablet (768-1024px):** Toggle entre lista y mapa
- **Mobile (<768px):** Mapa fullscreen con drawer para lista

---

## PERFORMANCE

- Debounce de 300ms en pan/zoom
- Máximo 200 marcadores individuales
- Máximo 100 clusters
- Lazy load de imágenes en lista
- Virtualización de lista si hay muchos items

---

## CRITERIOS DE ACEPTACIÓN

1. ✅ Mapa carga centrado en México
2. ✅ Zoom out muestra clusters
3. ✅ Zoom in muestra propiedades individuales
4. ✅ Filtros funcionan correctamente
5. ✅ Lista sincronizada con viewport
6. ✅ Click en propiedad la selecciona
7. ✅ Hover muestra preview
8. ✅ Paginación funciona
9. ✅ Mobile responsive
10. ✅ Performance fluida (60fps)

---

## NOTAS IMPORTANTES

1. **Solo propiedades activas:** Filtrar siempre por `status = 'activa'`
2. **Coordenadas válidas:** Solo mostrar propiedades con `lat` y `lng` no nulos
3. **Bounds de México:** Restringir navegación a bounds de México
4. **Precios en MXN:** Formatear precios en pesos mexicanos
5. **Idioma español:** Todo el UI en español
