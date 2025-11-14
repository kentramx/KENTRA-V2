# SEO Técnico de Kentra

## Resumen

Implementación completa de SEO técnico para el marketplace inmobiliario Kentra, incluyendo metadatos dinámicos, datos estructurados (schema.org), sitemap XML y robots.txt optimizados.

---

## 🎯 Metadatos por Tipo de Página

### Home (/)
- **Title**: "Kentra - Encuentra tu Propiedad Ideal en México | Casas, Departamentos y más"
- **Description**: "Plataforma inmobiliaria líder en México. Miles de propiedades en venta y renta..."
- **Structured Data**: WebSite + Organization + SearchAction

### Búsqueda (/buscar)
- **Title Dinámico**: "[Tipo] en [Ubicación] | Kentra"
- **Description Dinámica**: "Encuentra [count] [tipo] en [ubicación]..."
- **Structured Data**: ItemList con primeras 10 propiedades

### Detalle de Propiedad (/property/:id)
- **Title**: "[Tipo] en [Ciudad], [Estado] - [Precio] | Kentra"
- **Description**: "[Tipo] con [X] recámaras, [Y] baños..."
- **Open Graph**: Imagen principal de la propiedad
- **Structured Data**: RealEstateListing + Offer + Breadcrumb

### Perfil de Agente (/agent/:id)
- **Title**: "[Nombre] - Agente Inmobiliario en [Ciudad] | Kentra"
- **Description**: Bio del agente + número de propiedades
- **Structured Data**: RealEstateAgent + AggregateRating

### Pricing Pages
- **Title**: "Planes para [Tipo] | Kentra"
- **Description**: Descripción del plan desde $[precio]/mes

---

## 📊 Datos Estructurados Implementados

### 1. Propiedades (schema.org/RealEstateListing)
```json
{
  "@context": "https://schema.org",
  "@type": "SingleFamilyResidence",
  "name": "Casa en Polanco, CDMX",
  "address": {...},
  "offers": {
    "price": 5000000,
    "priceCurrency": "MXN"
  },
  "image": [...]
}
```

### 2. Sitio Web (schema.org/WebSite)
- Incluye SearchAction para búsqueda interna

### 3. Organización (schema.org/Organization)
- Logo y datos corporativos de Kentra

---

## 🗺️ Sitemap

**Endpoint**: `/sitemap.xml` (Edge Function)  
**Actualización**: Dinámica

Incluye:
- Home (prioridad 1.0)
- Búsqueda (prioridad 0.9)
- Propiedades activas (prioridad 0.8)
- Páginas de pricing (prioridad 0.7)
- Directorio de agentes (prioridad 0.8)

**Límite**: 50,000 URLs máximo

---

## 🤖 Robots.txt

Permite:
- Todas las páginas públicas
- /property/*
- /buscar*
- /pricing-*

Bloquea:
- /admin-*
- /panel-*
- /auth
- /settings
- Parámetros de tracking (?utm_*, ?fbclid=*)

---

## 🔧 Implementación Técnica

### Componente Central: SEOHead
```typescript
// src/components/SEOHead.tsx
<SEOHead
  title="[Título optimizado]"
  description="[Descripción optimizada]"
  canonical="/ruta"
  structuredData={[...]}
/>
```

### Utilidades
- `src/utils/seo.ts` - Generación de títulos y descripciones
- `src/utils/structuredData.ts` - Generación de JSON-LD

---

## ✅ Checklist SEO

- [x] Metadatos dinámicos en todas las páginas principales
- [x] Open Graph tags para compartir en redes sociales
- [x] Twitter Cards configuradas
- [x] Canonical URLs en páginas clave
- [x] Schema.org para propiedades (RealEstateListing)
- [x] Schema.org para agentes (RealEstateAgent)
- [x] Sitemap XML dinámico
- [x] Robots.txt configurado
- [x] Alt text en imágenes (implementado en componentes)
- [x] URLs limpias y descriptivas

---

## Corrección de unitCode en JSON-LD

**Fecha**: 2025-11-14

Se corrigió el código de unidad (`unitCode`) en el JSON-LD de propiedades para reflejar correctamente el uso de metros cuadrados:

- **Antes**: `unitCode: "FTK"` (square feet / pies cuadrados)
- **Después**: `unitCode: "MTK"` (square meters / metros cuadrados)

**Ubicación**: `src/utils/structuredData.ts` → función `generatePropertyStructuredData`

**Justificación**: Todas las propiedades en Kentra utilizan metros cuadrados como unidad de medida de área. El uso de MTK garantiza que los motores de búsqueda interpreten correctamente la información estructurada según el estándar [UN/CEFACT Common Codes](https://schema.org/unitCode).

**Impacto SEO**: Los rich snippets de Google mostrarán ahora la unidad correcta (m²) en los resultados de búsqueda, mejorando la precisión de la información para usuarios mexicanos.

---

**Última actualización**: 2025-11-14
