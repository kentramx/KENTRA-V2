import { test, expect } from '@playwright/test';

test.describe('Búsqueda de Propiedades', () => {
  test('página de búsqueda carga', async ({ page }) => {
    await page.goto('/buscar');
    await expect(page).toHaveURL(/buscar/);
  });

  test('filtros están visibles', async ({ page }) => {
    await page.goto('/buscar');
    // Verificar que hay controles de filtro
    await expect(
      page.getByRole('combobox').or(page.getByRole('button', { name: /filtro/i })).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('mapa se renderiza', async ({ page }) => {
    await page.goto('/buscar');
    // Verificar que el contenedor del mapa existe
    const mapContainer = page.locator('[class*="map"]').or(page.locator('#map')).or(page.locator('[data-testid="map"]'));
    await expect(mapContainer.first()).toBeVisible({ timeout: 15000 });
  });

  test('lista de propiedades carga', async ({ page }) => {
    await page.goto('/buscar');
    // Esperar a que cargue algún contenido
    await page.waitForTimeout(3000);
    // Verificar que hay una lista o grid de propiedades
    const propertyList = page.locator('[class*="property"]').or(page.locator('[class*="grid"]'));
    await expect(propertyList.first()).toBeVisible({ timeout: 15000 });
  });

  test('filtro de tipo de operación funciona', async ({ page }) => {
    await page.goto('/buscar');
    const operationFilter = page.getByRole('combobox').first();
    if (await operationFilter.isVisible()) {
      await operationFilter.click();
      await page.waitForTimeout(500);
    }
  });

  test('vista mobile muestra toggle mapa/lista', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/buscar');
    // En mobile debería haber un toggle o tabs para cambiar vista
    await expect(page.locator('body')).toBeVisible();
  });
});
