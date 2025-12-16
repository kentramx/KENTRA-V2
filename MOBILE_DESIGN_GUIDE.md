# 📱 Kentra Mobile Design Guide
## Prompt Maestro de Diseño Móvil

Este documento establece las reglas permanentes de diseño mobile-first para el proyecto Kentra. Todas las implementaciones deben seguir estas directrices.

---

## 🎯 Principio Fundamental: Mobile-First

```
SIEMPRE diseñar primero para móvil, luego escalar a desktop.
Usar clases base para móvil y prefijos (md:, lg:) para pantallas grandes.
```

**Ejemplo correcto:**
```tsx
// ✅ Mobile-first
<div className="p-4 md:p-6 lg:p-8">
<h1 className="text-2xl md:text-4xl lg:text-5xl">

// ❌ Incorrecto (desktop-first)
<div className="p-8 sm:p-4">
```

---

## 📐 Sistema de Breakpoints

| Breakpoint | Tamaño | Uso Principal |
|------------|--------|---------------|
| `default` | 0-639px | Móviles |
| `sm` | 640px+ | Móviles grandes |
| `md` | 768px+ | Tablets / Desktop pequeño |
| `lg` | 1024px+ | Desktop |
| `xl` | 1280px+ | Desktop grande |
| `2xl` | 1536px+ | Pantallas extra grandes |

**Breakpoint principal móvil/desktop: `md` (768px)**

---

## 📏 Espaciado Mobile-First

### Padding de contenedores

| Contexto | Móvil | Tablet+ | Desktop+ |
|----------|-------|---------|----------|
| Página principal | `px-4` | `md:px-6` | `lg:px-8` |
| Secciones | `py-8` | `md:py-12` | `lg:py-16` |
| Cards | `p-4` | `md:p-5` | `lg:p-6` |
| Modales/Sheets | `p-4` | `md:p-6` | - |

### Gaps entre elementos

| Contexto | Móvil | Tablet+ |
|----------|-------|---------|
| Grid de cards | `gap-4` | `md:gap-6` |
| Formularios | `space-y-4` | `md:space-y-6` |
| Botones en fila | `gap-2` | `md:gap-3` |
| Secciones | `space-y-6` | `md:space-y-8` |

### Margen inferior para BottomNav

```css
/* Ya implementado en index.css */
@media (max-width: 767px) {
  main, .main-content {
    padding-bottom: 80px;
  }
  footer {
    margin-bottom: 64px;
  }
}
```

---

## 🔤 Escala Tipográfica Responsiva

### Títulos

| Elemento | Móvil | Tablet+ | Desktop+ |
|----------|-------|---------|----------|
| Hero H1 | `text-3xl` | `md:text-4xl` | `lg:text-5xl` |
| Page H1 | `text-2xl` | `md:text-3xl` | `lg:text-4xl` |
| Section H2 | `text-xl` | `md:text-2xl` | `lg:text-3xl` |
| Card H3 | `text-lg` | `md:text-xl` | - |
| Subtítulos | `text-base` | `md:text-lg` | - |

### Cuerpo de texto

| Contexto | Móvil | Tablet+ |
|----------|-------|---------|
| Párrafos | `text-sm` | `md:text-base` |
| Descripciones | `text-xs` | `md:text-sm` |
| Labels | `text-sm` | - |
| Captions | `text-xs` | - |

### Line Heights para legibilidad móvil

```tsx
// ✅ Usar leading más espaciado en móvil
<p className="leading-relaxed md:leading-normal">
```

---

## 👆 Touch Targets (Áreas Táctiles)

### Tamaños mínimos obligatorios

| Elemento | Mínimo | Recomendado |
|----------|--------|-------------|
| Botones | 44x44px | 48x48px |
| Links en listas | 44px altura | 48px altura |
| Iconos clickeables | 44x44px | 48x48px |
| Checkboxes/Radios | 44x44px | - |

### Implementación

```tsx
// ✅ Botón con touch target adecuado
<Button className="min-h-[44px] px-4">

// ✅ Icono con área táctil expandida
<button className="p-3 -m-3"> {/* padding expande, margin negativo mantiene visual */}
  <Icon className="h-5 w-5" />
</button>

// ✅ Link en lista con altura mínima
<Link className="flex items-center min-h-[44px] py-3">
```

### Espaciado entre elementos táctiles

```tsx
// ✅ Mínimo 8px entre elementos clickeables
<div className="space-y-2"> {/* 8px */}
  <Button>Acción 1</Button>
  <Button>Acción 2</Button>
</div>
```

---

## 📱 Patrones de Layout Móvil

### Stack vertical → Horizontal

```tsx
// ✅ Patrón estándar
<div className="flex flex-col md:flex-row gap-4">
```

### Grid responsivo

```tsx
// ✅ Cards de propiedades
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

// ✅ Grid de 2 columnas en móvil
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
```

### Ocultar/Mostrar elementos

```tsx
// ✅ Solo móvil
<div className="md:hidden">

// ✅ Solo desktop
<div className="hidden md:block">

// ✅ Navbar móvil vs desktop
<MobileMenu className="md:hidden" />
<DesktopNav className="hidden md:flex" />
```

### Sidebar → Sheet en móvil

```tsx
// ✅ Patrón para filtros
{isMobile ? (
  <Sheet>
    <SheetContent side="bottom">
      <Filters />
    </SheetContent>
  </Sheet>
) : (
  <aside className="w-64">
    <Filters />
  </aside>
)}
```

---

## 🎨 Design Tokens para Móvil

### Usar siempre tokens semánticos

```tsx
// ✅ Correcto - tokens del sistema
className="bg-background text-foreground"
className="bg-primary text-primary-foreground"
className="bg-muted text-muted-foreground"
className="border-border"

// ❌ Incorrecto - colores directos
className="bg-white text-black"
className="bg-[#4a5d23]"
```

### Sombras responsivas

```tsx
// ✅ Sombras más sutiles en móvil
<Card className="shadow-sm md:shadow-md">
```

### Border radius

```tsx
// ✅ Radius consistente
className="rounded-lg" // var(--radius) = 0.75rem
className="rounded-xl" // Para cards destacadas
```

---

## 📋 Checklist de Validación Móvil

### Antes de cada PR, verificar:

#### Layout
- [ ] ¿Los elementos se apilan verticalmente en móvil?
- [ ] ¿No hay scroll horizontal?
- [ ] ¿El contenido no se corta ni desborda?
- [ ] ¿Hay espacio para el BottomNav (80px padding-bottom)?

#### Touch
- [ ] ¿Todos los botones tienen mínimo 44x44px?
- [ ] ¿Hay espacio suficiente entre elementos clickeables?
- [ ] ¿Los iconos tienen área táctil expandida?

#### Tipografía
- [ ] ¿El texto es legible sin zoom? (mínimo 14px)
- [ ] ¿Los títulos escalan apropiadamente?
- [ ] ¿El line-height es adecuado para lectura?

#### Formularios
- [ ] ¿Los inputs tienen altura mínima de 44px?
- [ ] ¿Los labels son visibles y claros?
- [ ] ¿El teclado no oculta campos importantes?

#### Imágenes
- [ ] ¿Las imágenes tienen aspect-ratio definido?
- [ ] ¿Se usa lazy loading?
- [ ] ¿Los placeholders tienen el mismo ratio?

#### Performance
- [ ] ¿Se usa `useIsMobile()` consistentemente?
- [ ] ¿Los componentes pesados se cargan condicionalmente?
- [ ] ¿Las animaciones son suaves (60fps)?

---

## 🛠️ Componentes con Adaptación Móvil Especial

### Navbar
- Desktop: Links horizontales
- Móvil: Hamburger menu (MobileMenu.tsx)

### BottomNav
- Solo visible en móvil (`md:hidden`)
- Fixed bottom con safe-area-inset

### SearchBar
- Desktop: Inline en header
- Móvil: Expandible o Sheet

### PropertyCard
- Desktop: Puede mostrar más info
- Móvil: Info condensada, imagen prominente

### Filtros de búsqueda
- Desktop: Sidebar o inline
- Móvil: Sheet desde bottom

### Mapa
- Desktop: Split view con lista
- Móvil: Toggle entre mapa y lista

---

## 🔧 Hooks Útiles

### useIsMobile

```tsx
import { useIsMobile } from "@/hooks/use-mobile";

const Component = () => {
  const isMobile = useIsMobile();
  
  return isMobile ? <MobileVersion /> : <DesktopVersion />;
};
```

### useWindowSize (cuando necesitas dimensiones exactas)

```tsx
import { useWindowSize } from "@/hooks/useWindowSize";

const Component = () => {
  const { width, height } = useWindowSize();
  // ...
};
```

---

## 📝 Ejemplos de Código

### Card responsiva completa

```tsx
<Card className="p-4 md:p-6 shadow-sm md:shadow-md">
  <div className="flex flex-col md:flex-row gap-4">
    <div className="w-full md:w-48 aspect-video md:aspect-square">
      <img className="object-cover rounded-lg" />
    </div>
    <div className="flex-1 space-y-2">
      <h3 className="text-lg md:text-xl font-semibold">Título</h3>
      <p className="text-sm md:text-base text-muted-foreground">
        Descripción
      </p>
      <Button className="w-full md:w-auto min-h-[44px]">
        Acción
      </Button>
    </div>
  </div>
</Card>
```

### Formulario mobile-first

```tsx
<form className="space-y-4 md:space-y-6">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div className="space-y-2">
      <Label className="text-sm">Nombre</Label>
      <Input className="h-11 md:h-10" /> {/* 44px en móvil */}
    </div>
    <div className="space-y-2">
      <Label className="text-sm">Email</Label>
      <Input className="h-11 md:h-10" type="email" />
    </div>
  </div>
  <Button className="w-full md:w-auto min-h-[44px]">
    Enviar
  </Button>
</form>
```

### Página con layout responsivo

```tsx
<div className="min-h-screen pb-20 md:pb-0"> {/* Espacio para BottomNav */}
  <header className="sticky top-0 z-50 bg-background border-b">
    <div className="container px-4 md:px-6 h-14 md:h-16 flex items-center">
      {/* ... */}
    </div>
  </header>
  
  <main className="container px-4 md:px-6 py-6 md:py-8">
    <h1 className="text-2xl md:text-3xl lg:text-4xl font-display mb-4 md:mb-6">
      Título de página
    </h1>
    {/* Contenido */}
  </main>
</div>
```

---

## ⚠️ Anti-patrones a Evitar

```tsx
// ❌ Texto muy pequeño
<p className="text-[10px]">

// ❌ Botones sin altura mínima
<button className="px-2 py-1">

// ❌ Espaciado fijo que no escala
<div className="p-8"> {/* Muy grande para móvil */}

// ❌ Width fijo que causa overflow
<div className="w-[500px]">

// ❌ Uso de colores directos
<div className="bg-white text-gray-900">

// ❌ Ocultar contenido importante en móvil
<div className="hidden md:block">{/* Información crítica */}</div>

// ❌ Hover-only interactions sin alternativa táctil
<div className="opacity-0 hover:opacity-100">
```

---

## 🔄 Proceso de Desarrollo

1. **Diseñar móvil primero** en Figma/sketch
2. **Implementar base móvil** sin prefijos de breakpoint
3. **Agregar adaptaciones** para tablet (md:) y desktop (lg:)
4. **Probar en dispositivos reales** o emulador
5. **Validar con checklist** antes de merge

---

*Última actualización: Diciembre 2024*
*Versión: 1.0*
