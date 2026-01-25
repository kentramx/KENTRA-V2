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
