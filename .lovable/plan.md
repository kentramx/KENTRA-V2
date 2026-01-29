
# Plan: Reposicionar Kentra como Plataforma de Inmuebles Generales

## Resumen Ejecutivo
Kentra ya soporta **8 tipos de propiedades** (casa, departamento, terreno, oficina, local, bodega, edificio, rancho), pero el copy de marketing y SEO todavía enfatiza "casas" y "hogar". Este plan cambia el posicionamiento de "especializada en casas" a **"marketplace inmobiliario integral"**.

---

## Cambios Identificados

### 1. Página Principal (Home.tsx)

| Elemento | Actual | Propuesto |
|----------|--------|-----------|
| Trust Badge | "Plataforma inmobiliaria #1 en México" | ✅ Ya es genérico, mantener |
| Headline H1 | "Tu próximo **hogar**, a un clic" | "Tu próximo **inmueble**, a un clic" |
| Subtítulo | "Miles de propiedades verificadas en todo México" | ✅ Ya es genérico, mantener |
| SEO Title | "...Casas, Departamentos y más" | "Propiedades en Venta y Renta" |
| SEO Description | "...casas, departamentos, terrenos, oficinas" | "Cualquier tipo de inmueble..." |

### 2. index.html (Meta Tags Globales)

| Meta | Actual | Propuesto |
|------|--------|-----------|
| `<title>` | "El Marketplace Inmobiliario de México" | ✅ Mantener |
| `<description>` | "...Miles de casas, departamentos y terrenos..." | "Miles de propiedades: residenciales, comerciales e industriales" |
| OG description | Similar | Mismo cambio |
| Twitter description | Similar | Mismo cambio |

### 3. Datos Estructurados (structuredData.ts)

| Campo | Actual | Propuesto |
|-------|--------|-----------|
| WebSite description | "...casas, departamentos, terrenos..." | "...cualquier tipo de inmueble: residencial, comercial, industrial y terrenos" |
| Organization description | "Plataforma inmobiliaria líder en México" | ✅ Ya es genérico |

### 4. Footer.tsx

| Texto | Actual | Propuesto |
|-------|--------|-----------|
| Descripción | "...para comprar, vender y rentar propiedades" | ✅ Ya es genérico, mantener |

### 5. Testimonials.tsx
Los testimonios actuales ya mencionan "propiedades" y "departamentos" de forma genérica. ✅ No requiere cambios.

---

## Archivos a Modificar

```text
1. src/pages/Home.tsx
   - Línea 92-93: SEO title/description
   - Línea 127: Cambiar "hogar" → "inmueble"

2. index.html
   - Línea 11: Meta description
   - Línea 21: OG description
   - Línea 32: Twitter description

3. src/utils/structuredData.ts
   - Línea 107: WebSite description
```

---

## Impacto SEO

**Palabras clave objetivo ampliadas:**
- Antes: "casas en venta México", "casas en renta"
- Ahora: "inmuebles en venta", "propiedades comerciales", "oficinas en renta", "bodegas industriales", "terrenos"

**Beneficios:**
- Mayor alcance de búsquedas long-tail
- Posicionamiento en segmentos comerciales/industriales
- Consistencia entre funcionalidad (8 tipos) y marketing

---

## Sección Técnica

### Cambios en código

**Home.tsx (líneas 91-94, 127):**
```tsx
// SEO
<SEOHead 
  title="Kentra - Encuentra tu Propiedad Ideal en México | Venta y Renta" 
  description="El marketplace inmobiliario de México. Propiedades residenciales, comerciales e industriales. Contacta agentes certificados." 
  ...
/>

// Headline
<h1 ...>
  Tu próximo inmueble,
  <span ...> a un clic</span>
</h1>
```

**index.html (líneas 10-12, 21, 32):**
```html
<meta
  name="description"
  content="El marketplace inmobiliario de México. Miles de propiedades residenciales, comerciales e industriales en venta y renta. Agentes certificados y mapa interactivo."
/>
<meta property="og:description" content="Miles de propiedades: casas, departamentos, oficinas, bodegas y terrenos. Agentes certificados." />
<meta name="twitter:description" content="Miles de propiedades residenciales y comerciales. Agentes certificados." />
```

**structuredData.ts (línea 107):**
```typescript
description: 'El marketplace inmobiliario de México. Propiedades residenciales, comerciales, industriales y terrenos en venta y renta.',
```

---

## Cambios NO Necesarios

Los siguientes elementos **ya son genéricos** y no requieren modificación:

- ✅ PropertyTypeSelector.tsx - Ya muestra los 8 tipos
- ✅ MapFilters.tsx - Ya tiene todos los tipos en dropdown
- ✅ types/property.ts - PropertyType ya incluye todos los tipos
- ✅ Footer.tsx - Dice "propiedades" no "casas"
- ✅ StatsCounter.tsx - Dice "Propiedades Activas"
- ✅ Testimonials.tsx - Textos genéricos
- ✅ Ayuda.tsx - FAQs ya mencionan "propiedades" genéricamente
- ✅ PricingAgente.tsx - No menciona tipos específicos

---

## Estimación
- **Archivos a modificar:** 3
- **Líneas de código:** ~15
- **Riesgo:** Bajo (solo cambios de texto/copy)
- **Tiempo estimado:** 5-10 minutos
