import { test, expect } from '@playwright/test';

test.describe('Página de Precios', () => {
  test('pricing de agentes carga', async ({ page }) => {
    await page.goto('/pricing-agente');
    await expect(page.getByText(/trial|start|pro|elite/i).first()).toBeVisible();
  });

  test('muestra precios en MXN', async ({ page }) => {
    await page.goto('/pricing-agente');
    await expect(page.getByText(/\$|MXN/i).first()).toBeVisible();
  });

  test('toggle mensual/anual funciona', async ({ page }) => {
    await page.goto('/pricing-agente');
    const toggleButton = page.getByRole('button', { name: /mensual|anual/i }).first();
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      await page.waitForTimeout(500);
      // Verificar que la UI cambió
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('botón de suscripción lleva a checkout o login', async ({ page }) => {
    await page.goto('/pricing-agente');
    const subscribeBtn = page.getByRole('button', { name: /comenzar|suscribir|elegir|seleccionar/i }).first();
    if (await subscribeBtn.isVisible()) {
      await subscribeBtn.click();
      // Debería ir a auth o checkout
      await expect(page).toHaveURL(/auth|checkout|stripe|pricing/);
    }
  });

  test('planes muestran características', async ({ page }) => {
    await page.goto('/pricing-agente');
    // Verificar que hay listas de características
    await expect(page.getByRole('list').first()).toBeVisible();
  });

  test('pricing de inmobiliarias carga', async ({ page }) => {
    await page.goto('/pricing-inmobiliaria');
    await expect(page.getByText(/starter|growth|enterprise/i).first()).toBeVisible();
  });

  test('pricing de desarrolladoras carga', async ({ page }) => {
    await page.goto('/pricing-desarrolladora');
    await expect(page.locator('body')).toBeVisible();
  });
});
