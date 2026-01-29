/**
 * Security Audit Logging for sensitive operations
 *
 * Logs security-relevant events to the database for compliance and monitoring:
 * - Authentication events (login, logout, failed attempts)
 * - Password changes
 * - Email changes
 * - Subscription changes
 * - Permission changes
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type AuditEventType =
  | 'auth.login.success'
  | 'auth.login.failed'
  | 'auth.logout'
  | 'auth.password_change'
  | 'auth.password_reset_request'
  | 'auth.password_reset_complete'
  | 'auth.email_verification_sent'
  | 'auth.email_verification_complete'
  | 'auth.email_change'
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.canceled'
  | 'subscription.reactivated'
  | 'payment.checkout_started'
  | 'payment.checkout_completed'
  | 'payment.failed'
  | 'account.lockout'
  | 'account.unlock'
  | 'security.csrf_failed'
  | 'security.rate_limit_exceeded';

export interface AuditLogEntry {
  event_type: AuditEventType;
  user_id?: string;
  email?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
  success: boolean;
  error_message?: string;
}

/**
 * Get client IP from request headers
 */
export function getClientIP(req: Request): string {
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  const xForwardedFor = req.headers.get('x-forwarded-for');
  const xRealIp = req.headers.get('x-real-ip');

  return cfConnectingIp || xRealIp || xForwardedFor?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Mask sensitive data for logging
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const maskedLocal = local.length > 2
    ? local[0] + '***' + local[local.length - 1]
    : '***';
  return `${maskedLocal}@${domain}`;
}

/**
 * Log a security audit event
 */
export async function logAuditEvent(
  entry: AuditLogEntry,
  supabaseAdmin?: SupabaseClient
): Promise<void> {
  try {
    // Create admin client if not provided
    const client = supabaseAdmin || createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Log to console first (always succeeds)
    const logEntry = {
      timestamp: new Date().toISOString(),
      event_type: entry.event_type,
      user_id: entry.user_id || null,
      email: entry.email ? maskEmail(entry.email) : null,
      ip_address: entry.ip_address || null,
      success: entry.success,
      metadata: entry.metadata || {},
    };

    if (entry.success) {
      console.log(`[AUDIT] ${entry.event_type}:`, JSON.stringify(logEntry));
    } else {
      console.warn(`[AUDIT] ${entry.event_type} FAILED:`, JSON.stringify(logEntry));
    }

    // Insert into audit_logs table
    const { error } = await client
      .from('security_audit_logs')
      .insert({
        event_type: entry.event_type,
        user_id: entry.user_id || null,
        email: entry.email || null,
        ip_address: entry.ip_address || null,
        user_agent: entry.user_agent || null,
        success: entry.success,
        error_message: entry.error_message || null,
        metadata: entry.metadata || {},
        created_at: new Date().toISOString(),
      });

    if (error) {
      // Don't fail the main operation if audit logging fails
      // But log the error for debugging
      console.error('[AUDIT] Failed to write audit log:', error);
    }
  } catch (err) {
    // Never let audit logging break the main flow
    console.error('[AUDIT] Exception in audit logging:', err);
  }
}

/**
 * Helper to create audit log from request
 */
export function createAuditEntry(
  req: Request,
  eventType: AuditEventType,
  options: {
    userId?: string;
    email?: string;
    success: boolean;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }
): AuditLogEntry {
  return {
    event_type: eventType,
    user_id: options.userId,
    email: options.email,
    ip_address: getClientIP(req),
    user_agent: req.headers.get('user-agent') || undefined,
    success: options.success,
    error_message: options.errorMessage,
    metadata: options.metadata,
  };
}
