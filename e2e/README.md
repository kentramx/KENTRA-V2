# Tests E2E con Playwright

Suite de tests end-to-end para validar los flujos críticos de Kentra antes de cada deploy.

## Requisitos

```bash
# Instalar navegadores de Playwright (solo primera vez)
npx playwright install
```

## Ejecutar Tests

```bash
# Todos los tests
npm run test:e2e

# Con UI interactiva (recomendado para desarrollo)
npm run test:e2e:ui

# Ver el navegador mientras ejecuta
npm run test:e2e:headed

# Solo un archivo específico
npx playwright test e2e/auth.spec.ts

# Solo un test específico
npx playwright test -g "página de login carga correctamente"
```

## Estructura de Tests

| Archivo | Cobertura |
|---------|-----------|
| `auth.spec.ts` | Login, registro, validación de formularios |
| `home.spec.ts` | Página principal, hero, buscador, navegación, responsive |
| `properties.spec.ts` | Búsqueda, filtros, mapa, lista de propiedades |
| `pricing.spec.ts` | Planes de agentes/inmobiliarias, precios MXN, checkout flow |
| `seo.spec.ts` | Meta tags, OG tags, robots.txt, accesibilidad |

## Reportes

Después de ejecutar los tests, se genera un reporte HTML:

```bash
# Ver el reporte
npx playwright show-report
```

## Configuración

La configuración está en `playwright.config.ts`:

- **Navegadores**: Chrome (desktop) + iPhone 13 (mobile)
- **Base URL**: `http://localhost:5173` (o `BASE_URL` env var)
- **Screenshots**: Solo en fallos
- **Traces**: En primer retry
- **Retries**: 2 en CI, 0 en local

## CI/CD

En entorno de CI:
- Los tests corren en modo headless
- Se usa 1 worker para estabilidad
- Se aplican 2 retries automáticos
- La variable `CI=true` activa estos comportamientos

## Tips

1. **Debugging**: Usa `await page.pause()` para pausar la ejecución
2. **Selectores**: Prefiere `getByRole()` y `getByText()` sobre selectores CSS
3. **Timeouts**: Los tests tienen timeout de 30s por defecto
4. **Parallel**: Los tests corren en paralelo por defecto

## Agregar Nuevos Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Mi Feature', () => {
  test('descripción del test', async ({ page }) => {
    await page.goto('/mi-ruta');
    await expect(page.getByText('Esperado')).toBeVisible();
  });
});
```
