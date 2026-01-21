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
export const isString = (v: any): v is string => typeof v === 'string';
export const isNumber = (v: any): v is number => typeof v === 'number' && !isNaN(v);
export const isInteger = (v: any): v is number => isNumber(v) && Number.isInteger(v);
export const isBoolean = (v: any): v is boolean => typeof v === 'boolean';
export const isUUID = (v: any): boolean =>
  isString(v) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const isEmail = (v: any): boolean =>
  isString(v) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export const isPositiveInteger = (v: any): boolean => isInteger(v) && v > 0;
export const isInRange = (v: any, min: number, max: number): boolean =>
  isNumber(v) && v >= min && v <= max;

// Checkout request validation
export interface CheckoutRequest {
  planSlug: string;
  billingCycle: 'monthly' | 'yearly';
  couponCode?: string;
  upsellOnly?: boolean;
  upsells?: Array<{ id: string; quantity: number }>;
}

export function validateCheckoutRequest(body: any): ValidationResult<CheckoutRequest> {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { success: false, errors: ['Request body must be an object'] };
  }

  // planSlug - can be empty for upsellOnly
  if (body.upsellOnly !== true) {
    if (!isString(body.planSlug) || body.planSlug.length === 0) {
      errors.push('planSlug is required and must be a non-empty string');
    } else if (!/^(agente|inmobiliaria|desarrolladora)_/.test(body.planSlug)) {
      errors.push('planSlug must start with agente_, inmobiliaria_, or desarrolladora_');
    }
  }

  // billingCycle
  if (!['monthly', 'yearly'].includes(body.billingCycle)) {
    errors.push('billingCycle must be "monthly" or "yearly"');
  }

  // couponCode (optional)
  if (body.couponCode !== undefined && body.couponCode !== null && !isString(body.couponCode)) {
    errors.push('couponCode must be a string');
  }

  // upsellOnly (optional)
  if (body.upsellOnly !== undefined && !isBoolean(body.upsellOnly)) {
    errors.push('upsellOnly must be a boolean');
  }

  // upsells (optional)
  if (body.upsells !== undefined && body.upsells !== null) {
    if (!Array.isArray(body.upsells)) {
      errors.push('upsells must be an array');
    } else {
      body.upsells.forEach((upsell: any, index: number) => {
        if (!isUUID(upsell?.id)) {
          errors.push(`upsells[${index}].id must be a valid UUID`);
        }
        if (!isNumber(upsell?.quantity) || upsell.quantity < 1 || upsell.quantity > 10) {
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
      planSlug: body.planSlug || '',
      billingCycle: body.billingCycle,
      couponCode: body.couponCode,
      upsellOnly: body.upsellOnly,
      upsells: body.upsells,
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

export function validateChangePlanRequest(body: any): ValidationResult<ChangePlanRequest> {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { success: false, errors: ['Request body must be an object'] };
  }

  if (!isString(body.newPlanId) || body.newPlanId.length === 0) {
    errors.push('newPlanId is required and must be a non-empty string');
  }

  if (!['monthly', 'yearly'].includes(body.billingCycle)) {
    errors.push('billingCycle must be "monthly" or "yearly"');
  }

  if (body.previewOnly !== undefined && !isBoolean(body.previewOnly)) {
    errors.push('previewOnly must be a boolean');
  }

  if (body.bypassCooldown !== undefined && !isBoolean(body.bypassCooldown)) {
    errors.push('bypassCooldown must be a boolean');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      newPlanId: body.newPlanId,
      billingCycle: body.billingCycle,
      previewOnly: body.previewOnly,
      bypassCooldown: body.bypassCooldown,
    },
  };
}

// Admin action request validation
export interface AdminActionRequest {
  action: 'cancel' | 'reactivate' | 'change-plan' | 'extend-trial';
  userId: string;
  params?: Record<string, any>;
}

export function validateAdminActionRequest(body: any): ValidationResult<AdminActionRequest> {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { success: false, errors: ['Request body must be an object'] };
  }

  const validActions = ['cancel', 'reactivate', 'change-plan', 'extend-trial'];
  if (!validActions.includes(body.action)) {
    errors.push(`action must be one of: ${validActions.join(', ')}`);
  }

  if (!isUUID(body.userId)) {
    errors.push('userId must be a valid UUID');
  }

  if (body.params !== undefined && typeof body.params !== 'object') {
    errors.push('params must be an object');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      action: body.action,
      userId: body.userId,
      params: body.params,
    },
  };
}

// Notification request validation
export interface NotificationRequest {
  userId: string;
  type: string;
  metadata?: Record<string, any>;
}

export function validateNotificationRequest(body: any): ValidationResult<NotificationRequest> {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { success: false, errors: ['Request body must be an object'] };
  }

  if (!isUUID(body.userId)) {
    errors.push('userId must be a valid UUID');
  }

  if (!isString(body.type) || body.type.length === 0) {
    errors.push('type is required and must be a non-empty string');
  }

  if (body.metadata !== undefined && typeof body.metadata !== 'object') {
    errors.push('metadata must be an object');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      userId: body.userId,
      type: body.type,
      metadata: body.metadata,
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
