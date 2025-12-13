import { test, expect } from '@playwright/test';

test.describe('Página Principal', () => {
  test('carga correctamente', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/kentra/i);
  });

  test('hero section visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('buscador de propiedades visible', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByPlaceholder(/ciudad|colonia|código postal|ubicación/i)
    ).toBeVisible();
  });

  test('navegación a búsqueda funciona', async ({ page }) => {
    await page.goto('/');
    const searchLink = page.getByRole('link', { name: /buscar|explorar|propiedades/i }).first();
    if (await searchLink.isVisible()) {
      await searchLink.click();
      await expect(page).toHaveURL(/buscar/);
    }
  });

  test('footer visible', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator('footer')).toBeVisible();
  });

  test('CTA móvil visible en mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    // Verificar que hay un CTA visible para contactar o buscar
    const cta = page.getByRole('button').or(page.getByRole('link'));
    await expect(cta.first()).toBeVisible();
  });

  test('responsive design funciona', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible();

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });
});
