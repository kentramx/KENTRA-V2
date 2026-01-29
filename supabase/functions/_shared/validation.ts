/**
 * Request validation schemas using Zod-like validation
 * (Simplified version that doesn't require external dependencies)
 */

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

// Simple validation helpers - exported for use in other modules
export const isString = (v: unknown): v is string => typeof v === 'string';
export const isNumber = (v: unknown): v is number => typeof v === 'number' && !isNaN(v);
export const isInteger = (v: unknown): v is number => isNumber(v) && Number.isInteger(v);
export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
export const isUUID = (v: unknown): boolean =>
  isString(v) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const isEmail = (v: unknown): boolean =>
  isString(v) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export const isPositiveInteger = (v: unknown): boolean => isInteger(v) && v > 0;
export const isInRange = (v: unknown, min: number, max: number): boolean =>
  isNumber(v) && v >= min && v <= max;

// Checkout request validation
export interface CheckoutRequest {
  planSlug: string;
  billingCycle: 'monthly' | 'yearly';
  couponCode?: string;
  upsellOnly?: boolean;
  upsells?: Array<{ id: string; quantity: number }>;
}

export function validateCheckoutRequest(body: unknown): ValidationResult<CheckoutRequest> {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { success: false, errors: ['Request body must be an object'] };
  }

  const b = body as Record<string, unknown>;

  // planSlug - can be empty for upsellOnly
  if (b.upsellOnly !== true) {
    if (!isString(b.planSlug) || (b.planSlug as string).length === 0) {
      errors.push('planSlug is required and must be a non-empty string');
    } else if (!/^(agente|inmobiliaria|desarrolladora)_/.test(b.planSlug as string)) {
      errors.push('planSlug must start with agente_, inmobiliaria_, or desarrolladora_');
    }
  }

  // billingCycle
  if (!['monthly', 'yearly'].includes(b.billingCycle as string)) {
    errors.push('billingCycle must be "monthly" or "yearly"');
  }

  // couponCode (optional)
  if (b.couponCode !== undefined && b.couponCode !== null && !isString(b.couponCode)) {
    errors.push('couponCode must be a string');
  }

  // upsellOnly (optional)
  if (b.upsellOnly !== undefined && !isBoolean(b.upsellOnly)) {
    errors.push('upsellOnly must be a boolean');
  }

  // upsells (optional)
  if (b.upsells !== undefined && b.upsells !== null) {
    if (!Array.isArray(b.upsells)) {
      errors.push('upsells must be an array');
    } else {
      (b.upsells as unknown[]).forEach((upsell: unknown, index: number) => {
        const upsellObj = upsell as Record<string, unknown> | null;
        if (!isUUID(upsellObj?.id)) {
          errors.push(`upsells[${index}].id must be a valid UUID`);
        }
        if (!isNumber(upsellObj?.quantity) || (upsellObj?.quantity as number) < 1 || (upsellObj?.quantity as number) > 10) {
          errors.push(`upsells[${index}].quantity must be a number between 1 and 10`);
        }
      });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      planSlug: (b.planSlug as string) || '',
      billingCycle: b.billingCycle as 'monthly' | 'yearly',
      couponCode: b.couponCode as string | undefined,
      upsellOnly: b.upsellOnly as boolean | undefined,
      upsells: b.upsells as Array<{ id: string; quantity: number }> | undefined,
    },
  };
}

// Change plan request validation
export interface ChangePlanRequest {
  newPlanId: string;
  billingCycle: 'monthly' | 'yearly';
  previewOnly?: boolean;
  bypassCooldown?: boolean;
}

export function validateChangePlanRequest(body: unknown): ValidationResult<ChangePlanRequest> {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { success: false, errors: ['Request body must be an object'] };
  }

  const b = body as Record<string, unknown>;

  if (!isString(b.newPlanId) || (b.newPlanId as string).length === 0) {
    errors.push('newPlanId is required and must be a non-empty string');
  }

  if (!['monthly', 'yearly'].includes(b.billingCycle as string)) {
    errors.push('billingCycle must be "monthly" or "yearly"');
  }

  if (b.previewOnly !== undefined && !isBoolean(b.previewOnly)) {
    errors.push('previewOnly must be a boolean');
  }

  if (b.bypassCooldown !== undefined && !isBoolean(b.bypassCooldown)) {
    errors.push('bypassCooldown must be a boolean');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      newPlanId: b.newPlanId as string,
      billingCycle: b.billingCycle as 'monthly' | 'yearly',
      previewOnly: b.previewOnly as boolean | undefined,
      bypassCooldown: b.bypassCooldown as boolean | undefined,
    },
  };
}

// Admin action request validation
export interface AdminActionRequest {
  action: 'cancel' | 'reactivate' | 'change-plan' | 'extend-trial';
  userId: string;
  params?: Record<string, unknown>;
}

export function validateAdminActionRequest(body: unknown): ValidationResult<AdminActionRequest> {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { success: false, errors: ['Request body must be an object'] };
  }

  const b = body as Record<string, unknown>;

  const validActions = ['cancel', 'reactivate', 'change-plan', 'extend-trial'];
  if (!validActions.includes(b.action as string)) {
    errors.push(`action must be one of: ${validActions.join(', ')}`);
  }

  if (!isUUID(b.userId)) {
    errors.push('userId must be a valid UUID');
  }

  if (b.params !== undefined && typeof b.params !== 'object') {
    errors.push('params must be an object');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      action: b.action as 'cancel' | 'reactivate' | 'change-plan' | 'extend-trial',
      userId: b.userId as string,
      params: b.params as Record<string, unknown> | undefined,
    },
  };
}

// Notification request validation
export interface NotificationRequest {
  userId: string;
  type: string;
  metadata?: Record<string, unknown>;
}

export function validateNotificationRequest(body: unknown): ValidationResult<NotificationRequest> {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { success: false, errors: ['Request body must be an object'] };
  }

  const b = body as Record<string, unknown>;

  if (!isUUID(b.userId)) {
    errors.push('userId must be a valid UUID');
  }

  if (!isString(b.type) || (b.type as string).length === 0) {
    errors.push('type is required and must be a non-empty string');
  }

  if (b.metadata !== undefined && typeof b.metadata !== 'object') {
    errors.push('metadata must be an object');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      userId: b.userId as string,
      type: b.type as string,
      metadata: b.metadata as Record<string, unknown> | undefined,
    },
  };
}

/**
 * Helper to create error response for validation failures
 */
export function validationErrorResponse(errors: string[], corsHeaders: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({
      error: 'Validation failed',
      details: errors,
    }),
    {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}

/**
 * SECURITY: Body size limits to prevent DoS attacks
 */
export const BODY_SIZE_LIMITS = {
  DEFAULT: 1024 * 100,      // 100KB default for most endpoints
  WEBHOOK: 1024 * 500,       // 500KB for webhooks (Stripe events can be large)
  PROPERTY: 1024 * 200,      // 200KB for property submissions
  MESSAGE: 1024 * 50,        // 50KB for chat messages
  EMAIL: 1024 * 100,         // 100KB for email content
} as const;

/**
 * Check if request body size is within limits
 * SECURITY: Prevents DoS attacks via large request bodies
 *
 * @param req - The request object
 * @param maxSize - Maximum allowed body size in bytes (default 100KB)
 * @returns Object with allowed flag and error message if exceeded
 */
export async function checkBodySize(
  req: Request,
  maxSize: number = BODY_SIZE_LIMITS.DEFAULT
): Promise<{ allowed: boolean; size?: number; error?: string }> {
  // Check Content-Length header first (faster, but can be spoofed)
  const contentLength = req.headers.get('Content-Length');
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > maxSize) {
      return {
        allowed: false,
        size,
        error: `Request body too large: ${size} bytes (max: ${maxSize} bytes)`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Create a response for body size limit exceeded
 */
export function bodySizeLimitResponse(corsHeaders: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ error: 'Request body too large' }),
    {
      status: 413,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}

/**
 * SECURITY: Stripe metadata validation and sanitization
 *
 * Stripe metadata has constraints:
 * - Keys: max 40 characters, alphanumeric + underscore
 * - Values: max 500 characters, strings only
 * - Max 50 key-value pairs
 *
 * This function also prevents injection attacks by:
 * - Stripping HTML/script tags
 * - Removing control characters
 * - Limiting value length
 */
const STRIPE_METADATA_LIMITS = {
  MAX_KEY_LENGTH: 40,
  MAX_VALUE_LENGTH: 500,
  MAX_PAIRS: 50,
} as const;

/**
 * Sanitize a string value for use in Stripe metadata
 * Removes potentially dangerous content
 */
export function sanitizeMetadataValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);

  // Remove HTML tags
  str = str.replace(/<[^>]*>/g, '');

  // Remove script content
  str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove control characters (except newlines and tabs)
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Remove potential null bytes
  str = str.replace(/\0/g, '');

  // Trim and limit length
  str = str.trim().substring(0, STRIPE_METADATA_LIMITS.MAX_VALUE_LENGTH);

  return str;
}

/**
 * Sanitize a metadata key
 * Stripe keys must be alphanumeric + underscore, max 40 chars
 */
export function sanitizeMetadataKey(key: string): string {
  // Replace invalid characters with underscore
  let sanitized = key.replace(/[^a-zA-Z0-9_]/g, '_');

  // Limit length
  sanitized = sanitized.substring(0, STRIPE_METADATA_LIMITS.MAX_KEY_LENGTH);

  // Ensure it doesn't start with a number
  if (/^[0-9]/.test(sanitized)) {
    sanitized = '_' + sanitized.substring(1);
  }

  return sanitized;
}

/**
 * Validate and sanitize an entire metadata object for Stripe
 *
 * @param metadata - The metadata object to sanitize
 * @param allowedKeys - Optional whitelist of allowed keys (for stricter validation)
 * @returns Sanitized metadata object safe for Stripe API
 */
export function sanitizeStripeMetadata(
  metadata: Record<string, unknown> | undefined | null,
  allowedKeys?: string[]
): Record<string, string> {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  const sanitized: Record<string, string> = {};
  let pairCount = 0;

  for (const [key, value] of Object.entries(metadata)) {
    // Enforce max pairs limit
    if (pairCount >= STRIPE_METADATA_LIMITS.MAX_PAIRS) {
      console.warn(`Stripe metadata exceeded max pairs (${STRIPE_METADATA_LIMITS.MAX_PAIRS}), truncating`);
      break;
    }

    // Sanitize key
    const sanitizedKey = sanitizeMetadataKey(key);

    // Skip empty keys
    if (!sanitizedKey) {
      continue;
    }

    // If allowedKeys is provided, enforce whitelist
    if (allowedKeys && !allowedKeys.includes(sanitizedKey)) {
      console.warn(`Stripe metadata key "${key}" not in allowed list, skipping`);
      continue;
    }

    // Sanitize value
    const sanitizedValue = sanitizeMetadataValue(value);

    // Only add non-empty values
    if (sanitizedValue) {
      sanitized[sanitizedKey] = sanitizedValue;
      pairCount++;
    }
  }

  return sanitized;
}

/**
 * Create safe Stripe metadata for checkout sessions
 * Uses whitelist approach for maximum security
 */
export function createSafeCheckoutMetadata(params: {
  userId: string;
  planId?: string;
  planSlug?: string;
  billingCycle?: string;
  upsellOnly?: boolean;
  upsellIds?: string[];
  upsellQuantities?: number[];
  couponCode?: string;
  environment?: string;
}): Record<string, string> {
  const metadata: Record<string, string> = {};

  // User ID - validate UUID format
  if (params.userId && isUUID(params.userId)) {
    metadata.user_id = params.userId;
  }

  // Plan ID - validate UUID format
  if (params.planId && isUUID(params.planId)) {
    metadata.plan_id = params.planId;
  }

  // Plan slug - sanitize and limit
  if (params.planSlug) {
    const sanitizedSlug = sanitizeMetadataValue(params.planSlug);
    // Additional validation: must match plan slug pattern
    if (/^(agente|inmobiliaria|desarrolladora)_[a-z0-9_]+$/i.test(sanitizedSlug)) {
      metadata.plan_slug = sanitizedSlug;
    }
  }

  // Billing cycle - enum validation
  if (params.billingCycle && ['monthly', 'yearly'].includes(params.billingCycle)) {
    metadata.billing_cycle = params.billingCycle;
  }

  // Upsell only - boolean to string
  if (typeof params.upsellOnly === 'boolean') {
    metadata.upsell_only = params.upsellOnly.toString();
  }

  // Upsell IDs - validate each is UUID
  if (Array.isArray(params.upsellIds) && params.upsellIds.length > 0) {
    const validIds = params.upsellIds.filter(id => isUUID(id));
    if (validIds.length > 0) {
      metadata.upsell_ids = validIds.slice(0, 10).join(','); // Max 10 upsells
    }
  }

  // Upsell quantities - validate each is positive integer
  if (Array.isArray(params.upsellQuantities) && params.upsellQuantities.length > 0) {
    const validQuantities = params.upsellQuantities
      .filter(q => isPositiveInteger(q) && q <= 100)
      .slice(0, 10);
    if (validQuantities.length > 0) {
      metadata.upsell_quantities = validQuantities.join(',');
    }
  }

  // Coupon code - alphanumeric only
  if (params.couponCode) {
    const sanitizedCoupon = sanitizeMetadataValue(params.couponCode);
    if (/^[A-Z0-9_-]+$/i.test(sanitizedCoupon) && sanitizedCoupon.length <= 50) {
      metadata.coupon_code = sanitizedCoupon.toUpperCase();
    }
  }

  // Environment - enum validation
  if (params.environment && ['production', 'staging', 'development'].includes(params.environment)) {
    metadata.environment = params.environment;
  }

  return metadata;
}
