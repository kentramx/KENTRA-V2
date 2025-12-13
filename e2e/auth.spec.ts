import { test, expect } from '@playwright/test';

test.describe('Autenticación', () => {
  test('página de login carga correctamente', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.getByRole('tab', { name: /iniciar sesión/i })).toBeVisible();
  });

  test('muestra error con credenciales inválidas', async ({ page }) => {
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'test@invalid.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.getByText(/error|inválid|incorrecto/i)).toBeVisible({ timeout: 10000 });
  });

  test('registro muestra formulario completo', async ({ page }) => {
    await page.goto('/auth');
    await page.getByRole('tab', { name: /registrar/i }).click();
    await expect(page.getByPlaceholder(/correo/i)).toBeVisible();
    await expect(page.getByPlaceholder(/contraseña/i).first()).toBeVisible();
  });

  test('navegación entre tabs funciona', async ({ page }) => {
    await page.goto('/auth');
    
    // Click en Registrarse
    await page.getByRole('tab', { name: /registrar/i }).click();
    await expect(page.getByPlaceholder(/nombre/i)).toBeVisible();
    
    // Click en Iniciar Sesión
    await page.getByRole('tab', { name: /iniciar sesión/i }).click();
    await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible();
  });
});
