/**
 * Centralized application constants
 * These values are shared across multiple modules
 */

// ============================================================================
// IMPERSONATION / ADMIN
// ============================================================================

/**
 * SECURITY: Key prefix for impersonation localStorage
 * Actual key includes user ID to prevent cross-user data leakage
 * Format: `${IMPERSONATION_KEY_PREFIX}_${userId}`
 */
export const IMPERSONATION_KEY_PREFIX = 'kentra_impersonated_role';

/**
 * Valid roles that can be impersonated by super admins
 */
export const VALID_IMPERSONATION_ROLES = ['buyer', 'agent', 'agency', 'developer', 'moderator'] as const;

/**
 * Demo user IDs for impersonation mode
 * These are placeholder UUIDs that map to fake demo data
 */
export const DEMO_USER_IDS = {
  agent: '00000000-0000-0000-0000-000000000001',
  agency: '00000000-0000-0000-0000-000000000010',
  developer: '00000000-0000-0000-0000-000000000020',
} as const;

export const DEMO_AGENCY_ID = '20000000-0000-0000-0000-000000000001';
export const DEMO_DEVELOPER_ID = '30000000-0000-0000-0000-000000000001';

// ============================================================================
// STORAGE KEYS
// ============================================================================

/**
 * LocalStorage keys for various features
 */
export const STORAGE_KEYS = {
  PROPERTY_FORM_DRAFT: 'propertyFormDraft',
  COMPARE_LIST: 'kentra_compare_list',
  ANALYTICS_SESSION_ID: 'analytics_session_id',
  THEME: 'kentra_theme',
  RECENT_SEARCHES: 'kentra_recent_searches',
} as const;

// ============================================================================
// API / RATE LIMITS
// ============================================================================

/**
 * Default pagination limits
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  ADMIN_PAGE_SIZE: 50,
} as const;

/**
 * Cache durations in milliseconds
 */
export const CACHE_DURATIONS = {
  SHORT: 60_000, // 1 minute
  MEDIUM: 5 * 60_000, // 5 minutes
  LONG: 30 * 60_000, // 30 minutes
  EXCHANGE_RATE_REFRESH: 5 * 60_000, // 5 minutes
} as const;

// ============================================================================
// FILE UPLOAD
// ============================================================================

/**
 * Image upload constraints
 */
export const IMAGE_UPLOAD = {
  MAX_FILE_SIZE_MB: 5,
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024,
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  MAX_CONCURRENT_UPLOADS: 3,
  MAX_IMAGES_PER_PROPERTY: 20,
} as const;

// ============================================================================
// UI / DEBOUNCE
// ============================================================================

/**
 * Debounce delays in milliseconds
 */
export const DEBOUNCE = {
  SEARCH: 300,
  RESIZE: 150,
  MAP_VIEWPORT: 200,
  FORM_AUTOSAVE: 30_000, // 30 seconds
} as const;
