/**
 * Security utilities for sanitizing user-generated content
 */

/**
 * SECURITY: Validates and sanitizes URLs to prevent XSS via javascript: or data: URLs
 * Only allows http:, https:, and blob: protocols (blob: for local file previews)
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const allowedProtocols = ['http:', 'https:', 'blob:'];

    if (!allowedProtocols.includes(parsed.protocol)) {
      console.warn('[SECURITY] Blocked potentially malicious URL protocol:', parsed.protocol);
      return null;
    }

    return url;
  } catch {
    // If URL is relative or malformed, check for dangerous patterns
    if (url.trim().toLowerCase().startsWith('javascript:') ||
        url.trim().toLowerCase().startsWith('data:') ||
        url.trim().toLowerCase().startsWith('vbscript:')) {
      console.warn('[SECURITY] Blocked dangerous URL scheme');
      return null;
    }
    // Allow relative URLs
    return url;
  }
}

/**
 * SECURITY: Sanitizes an image URL specifically
 * Returns a placeholder if the URL is invalid
 */
export function sanitizeImageUrl(url: string | null | undefined, fallback = '/placeholder.svg'): string {
  const sanitized = sanitizeUrl(url);
  return sanitized || fallback;
}

/**
 * SECURITY: Escapes HTML special characters to prevent XSS in text content
 * Use this when you need to display user text in non-React contexts (e.g., emails)
 */
export function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

/**
 * SECURITY: Escapes regex special characters to prevent ReDoS attacks
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * SECURITY: Validates that a string is a valid UUID v4 format
 * Prevents malformed IDs from being used in database queries
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(id: string | null | undefined): boolean {
  if (!id) return false;
  return UUID_REGEX.test(id);
}

/**
 * SECURITY: Validates and returns the UUID if valid, null otherwise
 */
export function sanitizeUUID(id: string | null | undefined): string | null {
  if (!id || !isValidUUID(id)) return null;
  return id;
}
