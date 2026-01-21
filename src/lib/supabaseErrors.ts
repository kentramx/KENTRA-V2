/**
 * Supabase Error Handling Utilities
 * Handles common errors including RLS violations
 */

import { monitoring } from './monitoring';

// PostgreSQL error codes
export const PG_ERROR_CODES = {
  // Permission errors
  INSUFFICIENT_PRIVILEGE: '42501',
  RLS_VIOLATION: 'P0001', // Custom RLS exception
  PERMISSION_DENIED: '42501',

  // Constraint violations
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  NOT_NULL_VIOLATION: '23502',

  // Data errors
  INVALID_TEXT_REPRESENTATION: '22P02',
  NUMERIC_VALUE_OUT_OF_RANGE: '22003',

  // Connection errors
  CONNECTION_FAILURE: '08006',
  CONNECTION_DOES_NOT_EXIST: '08003',

  // Custom app errors (from RAISE EXCEPTION)
  RATE_LIMIT_EXCEEDED: 'P0002',
  MAX_REDEMPTIONS_REACHED: 'P0003',
} as const;

export interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Check if the error is an RLS/permission violation
 */
export function isRLSViolation(error: SupabaseError | null): boolean {
  if (!error?.code) return false;
  const rlsCodes: string[] = [
    PG_ERROR_CODES.INSUFFICIENT_PRIVILEGE,
    PG_ERROR_CODES.RLS_VIOLATION,
    PG_ERROR_CODES.PERMISSION_DENIED,
  ];
  return rlsCodes.includes(error.code);
}

/**
 * Check if the error is a constraint violation
 */
export function isConstraintViolation(error: SupabaseError | null): boolean {
  if (!error?.code) return false;
  const constraintCodes: string[] = [
    PG_ERROR_CODES.UNIQUE_VIOLATION,
    PG_ERROR_CODES.FOREIGN_KEY_VIOLATION,
    PG_ERROR_CODES.CHECK_VIOLATION,
    PG_ERROR_CODES.NOT_NULL_VIOLATION,
  ];
  return constraintCodes.includes(error.code);
}

/**
 * Check if the error is a rate limit error
 */
export function isRateLimitError(error: SupabaseError | null): boolean {
  return error?.code === PG_ERROR_CODES.RATE_LIMIT_EXCEEDED;
}

/**
 * Get a user-friendly error message
 */
export function getUserFriendlyError(error: SupabaseError | null): string {
  if (!error) return 'Error desconocido';

  // RLS violations
  if (isRLSViolation(error)) {
    monitoring.warn('RLS violation detected', { error });
    return 'No tienes permiso para realizar esta acción. Por favor inicia sesión o contacta soporte.';
  }

  // Rate limiting
  if (isRateLimitError(error)) {
    return 'Has excedido el límite de solicitudes. Por favor espera un momento antes de intentar de nuevo.';
  }

  // Unique constraint (duplicate)
  if (error.code === PG_ERROR_CODES.UNIQUE_VIOLATION) {
    return 'Este registro ya existe. Por favor verifica los datos.';
  }

  // Foreign key violation
  if (error.code === PG_ERROR_CODES.FOREIGN_KEY_VIOLATION) {
    return 'No se puede completar la operación porque hay datos relacionados.';
  }

  // Custom app errors
  if (error.code === PG_ERROR_CODES.MAX_REDEMPTIONS_REACHED) {
    return 'Este cupón ha alcanzado el máximo de usos permitidos.';
  }

  // Check constraint
  if (error.code === PG_ERROR_CODES.CHECK_VIOLATION) {
    return 'Los datos proporcionados no son válidos.';
  }

  // Generic message fallback
  return error.message || 'Ha ocurrido un error. Por favor intenta de nuevo.';
}

/**
 * Handle and log a Supabase error
 * Returns a user-friendly message
 */
export function handleSupabaseError(
  error: SupabaseError | null,
  context: string,
  additionalData?: Record<string, unknown>
): string {
  if (!error) return '';

  // Log the error with full context
  const isPermissionError = isRLSViolation(error);
  const logLevel = isPermissionError ? 'warn' : 'error';

  monitoring[logLevel](`Supabase error in ${context}`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
    isRLSViolation: isPermissionError,
    ...additionalData,
  });

  return getUserFriendlyError(error);
}

/**
 * Type guard to check if an error is a Supabase PostgrestError
 */
export function isSupabaseError(error: unknown): error is SupabaseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as SupabaseError).message === 'string'
  );
}
