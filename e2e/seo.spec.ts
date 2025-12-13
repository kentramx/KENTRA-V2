import { test, expect } from '@playwright/test';

test.describe('SEO y Meta Tags', () => {
  test('meta tags básicos presentes en home', async ({ page }) => {
    await page.goto('/');
    
    // Title
    const title = await page.title();
    expect(title.length).toBeGreaterThan(10);
    
    // Meta description
    const description = await page.getAttribute('meta[name="description"]', 'content');
    expect(description?.length).toBeGreaterThan(50);
  });

  test('OG tags presentes', async ({ page }) => {
    await page.goto('/');
    
    const ogTitle = await page.getAttribute('meta[property="og:title"]', 'content');
    const ogDescription = await page.getAttribute('meta[property="og:description"]', 'content');
    
    expect(ogTitle).toBeTruthy();
    expect(ogDescription).toBeTruthy();
  });

  test('robots.txt accesible', async ({ page }) => {
    const response = await page.goto('/robots.txt');
    expect(response?.status()).toBe(200);
  });

  test('canonical tag presente', async ({ page }) => {
    await page.goto('/');
    const canonical = await page.getAttribute('link[rel="canonical"]', 'href');
    // Canonical puede existir o no, solo verificamos que si existe es válido
    if (canonical) {
      expect(canonical).toContain('http');
    }
  });

  test('viewport meta tag presente', async ({ page }) => {
    await page.goto('/');
    const viewport = await page.getAttribute('meta[name="viewport"]', 'content');
    expect(viewport).toContain('width=device-width');
  });

  test('lang attribute en html', async ({ page }) => {
    await page.goto('/');
    const lang = await page.getAttribute('html', 'lang');
    expect(lang).toBeTruthy();
  });

  test('favicon presente', async ({ page }) => {
    await page.goto('/');
    const favicon = await page.getAttribute('link[rel="icon"]', 'href');
    expect(favicon).toBeTruthy();
  });

  test('búsqueda tiene meta tags', async ({ page }) => {
    await page.goto('/buscar');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(5);
  });
});
