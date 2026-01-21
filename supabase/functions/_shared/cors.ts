// Allowed origins for CORS - restrict to production and development domains
const ALLOWED_ORIGINS = [
  'https://kentra.com.mx',
  'https://www.kentra.com.mx',
  'https://app.kentra.com.mx',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];

/**
 * Get CORS headers with origin validation
 * Only allows requests from whitelisted domains
 */
export const getCorsHeaders = (requestOrigin: string | null): Record<string, string> => {
  const origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0]; // Default to production domain

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
};

// Legacy export for backwards compatibility - DEPRECATED, use getCorsHeaders()
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://kentra.com.mx',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
