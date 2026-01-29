/**
 * CSRF Protection utilities for state-changing operations
 *
 * In SPAs with Bearer token authentication, CSRF is largely mitigated because:
 * 1. Tokens are sent in Authorization header, not cookies
 * 2. Cross-origin requests cannot read/set custom headers
 *
 * This module adds additional defense-in-depth:
 * 1. Origin header validation
 * 2. X-Requested-With header validation for AJAX requests
 */

// Allowed origins for CSRF validation
const ALLOWED_ORIGINS = [
  'https://kentra.com.mx',
  'https://www.kentra.com.mx',
  'https://app.kentra.com.mx',
];

// Development origins (only allowed in non-production)
const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];

// Lovable preview patterns
const LOVABLE_PATTERN = /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.lovable\.app$/i;
const GPT_PATTERN = /^https:\/\/[a-z0-9-]+\.gptengineer\.app$/i;

/**
 * Check if an origin is allowed
 */
function isAllowedOrigin(origin: string, allowDev = false): boolean {
  // Check static production list
  if (ALLOWED_ORIGINS.includes(origin)) return true;

  // Check development origins
  if (allowDev && DEV_ORIGINS.includes(origin)) return true;

  // Check Lovable preview patterns
  if (LOVABLE_PATTERN.test(origin)) return true;
  if (GPT_PATTERN.test(origin)) return true;

  return false;
}

export interface CsrfValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate CSRF protection for state-changing operations
 *
 * @param req - The incoming request
 * @param options - Validation options
 * @returns Validation result
 */
export function validateCsrf(
  req: Request,
  options: {
    requireXRequestedWith?: boolean;
    allowDev?: boolean;
  } = {}
): CsrfValidationResult {
  const { requireXRequestedWith = true, allowDev = false } = options;

  // 1. Validate Origin header
  const origin = req.headers.get('origin');

  if (!origin) {
    // Some legitimate requests might not have Origin header (same-origin)
    // But for state-changing operations, we should require it
    return {
      valid: false,
      error: 'Missing Origin header',
    };
  }

  if (!isAllowedOrigin(origin, allowDev)) {
    return {
      valid: false,
      error: 'Invalid Origin header',
    };
  }

  // 2. Validate X-Requested-With header (optional but recommended)
  if (requireXRequestedWith) {
    const xRequestedWith = req.headers.get('x-requested-with');

    // Common values: XMLHttpRequest, fetch
    // Browsers won't send this header from cross-origin <form> submissions
    if (!xRequestedWith) {
      return {
        valid: false,
        error: 'Missing X-Requested-With header',
      };
    }
  }

  return { valid: true };
}

/**
 * Create a CSRF error response
 */
export function csrfErrorResponse(
  error: string,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: 'CSRF validation failed',
      details: error,
    }),
    {
      status: 403,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Middleware-style CSRF validation
 * Returns null if valid, or a Response if invalid
 */
export function validateCsrfMiddleware(
  req: Request,
  corsHeaders: Record<string, string>,
  options: {
    requireXRequestedWith?: boolean;
    allowDev?: boolean;
  } = {}
): Response | null {
  const result = validateCsrf(req, options);

  if (!result.valid) {
    console.warn(`CSRF validation failed: ${result.error}`);
    return csrfErrorResponse(result.error || 'Unknown error', corsHeaders);
  }

  return null;
}
