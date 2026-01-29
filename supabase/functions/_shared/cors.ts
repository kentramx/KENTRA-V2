// Allowed origins for CORS - restrict to production and development domains
const ALLOWED_ORIGINS = [
  'https://kentra.com.mx',
  'https://www.kentra.com.mx',
  'https://app.kentra.com.mx',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  // Lovable development/preview domains
  'https://lovable.dev',
  'https://gptengineer.app',
];

// Pattern for Lovable preview URLs (e.g., https://id--project.lovable.app)
// Using case-insensitive flag for flexibility
const LOVABLE_PATTERN = /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.lovable\.app$/i;
const GPT_PATTERN = /^https:\/\/[a-z0-9-]+\.gptengineer\.app$/i;

/**
 * Check if origin is allowed
 */
const isAllowedOrigin = (origin: string): boolean => {
  // Check static list
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Check Lovable preview patterns
  if (LOVABLE_PATTERN.test(origin)) return true;
  if (GPT_PATTERN.test(origin)) return true;
  return false;
};

/**
 * Get CORS headers with origin validation and security headers
 * Only allows requests from whitelisted domains
 * Includes OWASP recommended security headers
 */
export const getCorsHeaders = (requestOrigin: string | null): Record<string, string> => {
  const origin = requestOrigin && isAllowedOrigin(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0]; // Default to production domain

  return {
    // CORS headers
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    // Security headers
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.stripe.com",
  };
};

// Legacy export for backwards compatibility - DEPRECATED, use getCorsHeaders()
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://kentra.com.mx',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
